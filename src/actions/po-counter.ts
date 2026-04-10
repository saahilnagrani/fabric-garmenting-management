"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/require-permission";
import { logAction } from "@/lib/audit";
import { currentFiscalYear } from "@/lib/po-numbering";

async function requireAdmin() {
  const session = await requireAuth();
  if (session.user?.role !== "ADMIN") {
    throw new Error("Admin access required");
  }
  return session;
}

export type PoCounterRow = {
  fiscalYear: string;
  lastNumber: number;
  poCount: number;
  updatedAt: Date;
};

/**
 * List PoCounter rows joined with the count of fabric orders that currently
 * carry a PO number for that fiscal year. Used by the admin counter page so
 * the user can see "what would be deleted if I reset this FY".
 */
export async function getPoCounters(): Promise<PoCounterRow[]> {
  await requireAdmin();
  const counters = await db.poCounter.findMany({
    orderBy: { fiscalYear: "desc" },
  });

  // Get poNumber counts grouped by FY prefix
  const orders = await db.fabricOrder.findMany({
    where: { poNumber: { not: null } },
    select: { poNumber: true },
  });
  const countsByFy = new Map<string, number>();
  for (const o of orders) {
    if (!o.poNumber) continue;
    // poNumber format: HYP/PO/<fy>/<seq>  →  parts[2] is the FY
    const parts = o.poNumber.split("/");
    const fy = parts[2];
    if (fy) countsByFy.set(fy, (countsByFy.get(fy) ?? 0) + 1);
  }

  return counters.map((c) => ({
    fiscalYear: c.fiscalYear,
    lastNumber: c.lastNumber,
    poCount: countsByFy.get(c.fiscalYear) ?? 0,
    updatedAt: c.updatedAt,
  }));
}

/**
 * Get the current fiscal year (the one new POs would be allocated under).
 * Useful for the admin UI to highlight the active row.
 */
export async function getCurrentFiscalYear(): Promise<string> {
  await requireAdmin();
  return currentFiscalYear();
}

/**
 * Reset PO numbering for a fiscal year. Intended for pre-go-live cleanup
 * after testing has burned a few numbers.
 *
 * Side effects (DESTRUCTIVE — show clear warning in UI):
 *  1. Clears `poNumber` on every FabricOrder whose PO number falls in that FY.
 *  2. Deletes the PoCounter row for that FY, so the next allocation starts at 0101.
 *
 * Reasoning for clearing the orders too: if we only deleted the counter and
 * left the existing numbers in place, the next allocation would re-issue 0101
 * and immediately violate the unique-poNumber index. The two operations are
 * inseparable.
 */
export async function resetPoCounterForFy(fiscalYear: string) {
  const session = await requireAdmin();

  // Sanity-check the FY format ("YYYY-YY") to avoid wildcards in the LIKE clause.
  if (!/^\d{4}-\d{2}$/.test(fiscalYear)) {
    throw new Error(`Invalid fiscal year format: ${fiscalYear}`);
  }

  const prefix = `HYP/PO/${fiscalYear}/`;

  const cleared = await db.fabricOrder.updateMany({
    where: { poNumber: { startsWith: prefix } },
    data: { poNumber: null },
  });

  await db.poCounter.delete({ where: { fiscalYear } }).catch(() => {
    // No counter row yet — nothing to delete; that's fine.
  });

  logAction(
    session.user!.id!,
    session.user!.name!,
    "DELETE",
    "PoCounter",
    fiscalYear,
    {
      reset: { old: `cleared ${cleared.count} fabric order PO numbers`, new: "counter deleted" },
    }
  );

  revalidatePath("/admin/po-counter");
  revalidatePath("/fabric-orders");

  return { clearedOrders: cleared.count };
}
