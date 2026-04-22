"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/require-permission";
import { logAction } from "@/lib/audit";
import { currentFiscalYear, fiscalYearFromNumber } from "@/lib/po-numbering";

async function requireAdmin() {
  const session = await requireAuth();
  if (session.user?.role !== "ADMIN") {
    throw new Error("Admin access required");
  }
  return session;
}

export type CounterType = "FABRIC_PO" | "ACCESSORY_PO" | "ACCESSORY_DN";

export type PoCounterRow = {
  type: CounterType;
  fiscalYear: string;
  // The row id in PoCounter (different key format per type).
  counterKey: string;
  lastNumber: number;
  issuedCount: number;
  updatedAt: Date;
};

/**
 * Counter-key convention in the shared PoCounter table:
 *   Fabric PO    → "{fy}"           (e.g. 2026-27)  → emits HYP/FPO/{fy}/NNNN
 *   Accessory PO → "ACC-{fy}"                      → emits HYP/APO/{fy}/NNNN
 *   Accessory DN → "DN-{fy}"                       → emits HYP/ADN/{fy}/NNNN
 */
function counterTypeFromKey(key: string): CounterType {
  if (key.startsWith("DN-")) return "ACCESSORY_DN";
  if (key.startsWith("ACC-")) return "ACCESSORY_PO";
  return "FABRIC_PO";
}

function fyFromKey(key: string): string {
  if (key.startsWith("DN-")) return key.slice(3);
  if (key.startsWith("ACC-")) return key.slice(4);
  return key;
}

function counterKey(type: CounterType, fy: string): string {
  switch (type) {
    case "FABRIC_PO": return fy;
    case "ACCESSORY_PO": return `ACC-${fy}`;
    case "ACCESSORY_DN": return `DN-${fy}`;
  }
}

/**
 * List every counter row — fabric POs, accessory POs, accessory DNs — along
 * with the count of documents currently carrying a number for that FY. Used
 * by the admin counter page so the user can see "what would be deleted if I
 * reset this FY / type".
 */
export async function getPoCounters(): Promise<PoCounterRow[]> {
  await requireAdmin();
  const allCounters = await db.poCounter.findMany({
    orderBy: { fiscalYear: "desc" },
  });

  // Count issued numbers per (type, fy). We scan each source table once and
  // parse the FY from the poNumber/dnNumber — cheaper than three LIKE queries
  // per FY.
  const countsByKey = new Map<string, number>();
  function bump(key: string) {
    countsByKey.set(key, (countsByKey.get(key) ?? 0) + 1);
  }

  const fabricOrders = await db.fabricOrder.findMany({
    where: { poNumber: { not: null } },
    select: { poNumber: true },
  });
  for (const o of fabricOrders) {
    const fy = o.poNumber ? fiscalYearFromNumber(o.poNumber) : null;
    if (fy) bump(counterKey("FABRIC_PO", fy));
  }

  const accessoryPurchases = await db.accessoryPurchase.findMany({
    where: { poNumber: { not: null } },
    select: { poNumber: true },
  });
  for (const p of accessoryPurchases) {
    const fy = p.poNumber ? fiscalYearFromNumber(p.poNumber) : null;
    if (fy) bump(counterKey("ACCESSORY_PO", fy));
  }

  const dispatches = await db.accessoryDispatch.findMany({
    where: { dnNumber: { not: null } },
    select: { dnNumber: true },
  });
  for (const d of dispatches) {
    const fy = d.dnNumber ? fiscalYearFromNumber(d.dnNumber) : null;
    if (fy) bump(counterKey("ACCESSORY_DN", fy));
  }

  return allCounters.map((c) => ({
    type: counterTypeFromKey(c.fiscalYear),
    fiscalYear: fyFromKey(c.fiscalYear),
    counterKey: c.fiscalYear,
    lastNumber: c.lastNumber,
    issuedCount: countsByKey.get(c.fiscalYear) ?? 0,
    updatedAt: c.updatedAt,
  }));
}

export async function getCurrentFiscalYear(): Promise<string> {
  await requireAdmin();
  return currentFiscalYear();
}

/**
 * Reset numbering for a (type, fiscal year). DESTRUCTIVE:
 *  - clears the poNumber / dnNumber on every matching source row in that FY
 *  - deletes the counter row so the next allocation starts at 0101
 *
 * Intended for pre-go-live cleanup after test allocations. Never run against a
 * live FY where real documents have already been sent out.
 */
export async function resetPoCounterForFy(type: CounterType, fiscalYear: string) {
  const session = await requireAdmin();

  if (!/^\d{4}-\d{2}$/.test(fiscalYear)) {
    throw new Error(`Invalid fiscal year format: ${fiscalYear}`);
  }

  let cleared = 0;
  let entityType = "";
  switch (type) {
    case "FABRIC_PO": {
      entityType = "PoCounter/FABRIC_PO";
      const res = await db.fabricOrder.updateMany({
        where: { poNumber: { startsWith: `HYP/FPO/${fiscalYear}/` } },
        data: { poNumber: null },
      });
      cleared = res.count;
      break;
    }
    case "ACCESSORY_PO": {
      entityType = "PoCounter/ACCESSORY_PO";
      const res = await db.accessoryPurchase.updateMany({
        where: { poNumber: { startsWith: `HYP/APO/${fiscalYear}/` } },
        data: { poNumber: null },
      });
      cleared = res.count;
      break;
    }
    case "ACCESSORY_DN": {
      entityType = "PoCounter/ACCESSORY_DN";
      const res = await db.accessoryDispatch.updateMany({
        where: { dnNumber: { startsWith: `HYP/ADN/${fiscalYear}/` } },
        data: { dnNumber: null },
      });
      cleared = res.count;
      break;
    }
  }

  const key = counterKey(type, fiscalYear);
  await db.poCounter.delete({ where: { fiscalYear: key } }).catch(() => {
    // No counter row yet — nothing to delete; that's fine.
  });

  logAction(
    session.user!.id!,
    session.user!.name!,
    "DELETE",
    entityType,
    key,
    {
      reset: { old: `cleared ${cleared} numbers`, new: "counter deleted" },
    }
  );

  revalidatePath("/admin/po-counter");
  revalidatePath("/fabric-orders");
  revalidatePath("/accessories");

  return { clearedCount: cleared };
}
