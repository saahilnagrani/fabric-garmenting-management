"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/require-permission";
import { logAction, computeDiff } from "@/lib/audit";
import { ensurePoNumberForAccessoryGroup, fiscalYearFromNumber } from "@/lib/po-numbering";
import type { AccessoryPurchaseStatus } from "@/generated/prisma/client";

export async function getAccessoryPurchases(phaseId: string) {
  await requirePermission("inventory:accessories:view");
  return db.accessoryPurchase.findMany({
    where: { phaseId },
    include: { accessory: true, vendor: true, shipToVendor: true },
    orderBy: [{ purchaseDate: "desc" }, { createdAt: "desc" }],
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createAccessoryPurchase(data: any) {
  const session = await requirePermission("inventory:accessories:create");
  const row = await db.accessoryPurchase.create({ data });
  logAction(session.user!.id!, session.user!.name!, "CREATE", "AccessoryPurchase", row.id);
  revalidatePath("/accessory-purchases");
  revalidatePath("/accessory-balance");
  return row;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createAccessoryPurchasesBatch(rows: any[]) {
  const session = await requirePermission("inventory:accessories:create");
  if (!rows.length) return [];
  const created = await db.$transaction(
    rows.map((data) => db.accessoryPurchase.create({ data })),
  );
  for (const row of created) {
    logAction(session.user!.id!, session.user!.name!, "CREATE", "AccessoryPurchase", row.id);
  }
  revalidatePath("/accessory-purchases");
  revalidatePath("/accessory-balance");
  return created;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function updateAccessoryPurchase(id: string, data: any) {
  const session = await requirePermission("inventory:accessories:edit");
  const previous = await db.accessoryPurchase.findUnique({ where: { id } });
  const row = await db.accessoryPurchase.update({ where: { id }, data });
  const changes = previous
    ? computeDiff(previous as unknown as Record<string, unknown>, row as unknown as Record<string, unknown>)
    : undefined;
  logAction(session.user!.id!, session.user!.name!, "UPDATE", "AccessoryPurchase", id, changes);
  revalidatePath("/accessory-purchases");
  revalidatePath("/accessory-balance");
  return row;
}

export async function deleteAccessoryPurchase(id: string) {
  const session = await requirePermission("inventory:accessories:delete");
  await db.accessoryPurchase.delete({ where: { id } });
  logAction(session.user!.id!, session.user!.name!, "DELETE", "AccessoryPurchase", id);
  revalidatePath("/accessory-purchases");
  revalidatePath("/accessory-balance");
}

/**
 * Stamp poNumber + shipToVendorId onto selected rows (grouped by supplier).
 * Does NOT change status — user controls that manually.
 * Returns the PO numbers allocated per supplier vendor.
 */
export async function generateAccessoryPurchaseOrders(
  ids: string[],
  shipToVendorId: string,
): Promise<Record<string, string>> {
  await requirePermission("inventory:accessories:edit");
  if (!ids.length) return {};

  const purchases = await db.accessoryPurchase.findMany({
    where: { id: { in: ids }, vendorId: { not: null } },
    select: { id: true, vendorId: true, poNumber: true },
  });

  const byVendor = new Map<string, string[]>();
  for (const p of purchases) {
    if (!p.vendorId) continue;
    const list = byVendor.get(p.vendorId) ?? [];
    list.push(p.id);
    byVendor.set(p.vendorId, list);
  }

  const poNumbersByVendorId: Record<string, string> = {};
  for (const [vendorId, vendorIds] of byVendor.entries()) {
    const poNumber = await ensurePoNumberForAccessoryGroup(vendorIds);
    poNumbersByVendorId[vendorId] = poNumber;
  }

  // Stamp shipToVendorId on all rows.
  await db.accessoryPurchase.updateMany({
    where: { id: { in: ids } },
    data: { shipToVendorId },
  });

  revalidatePath("/accessory-purchases");
  return poNumbersByVendorId;
}

/**
 * Cancel a PO: marks every row in the group as CANCELLED. The PO number and
 * ship-to are kept on the rows so the cancelled PO still surfaces in the PO
 * list for audit. The number is never reused — cancelled rows cannot be
 * "re-activated". Only allowed while every row is still DRAFT_ORDER; once any
 * row has advanced, the vendor has been notified and the PO can't be
 * unilaterally voided.
 */
export async function cancelAccessoryPurchaseOrder(poNumber: string) {
  const session = await requirePermission("inventory:accessories:edit");
  const rows = await db.accessoryPurchase.findMany({
    where: { poNumber },
    select: { id: true, status: true },
  });
  if (rows.length === 0) throw new Error(`No rows found for PO ${poNumber}`);
  const advanced = rows.filter((r) => r.status !== "DRAFT_ORDER");
  if (advanced.length > 0) {
    throw new Error(
      `Cannot cancel PO ${poNumber}: ${advanced.length} row(s) are past Draft status. Revert their status first.`
    );
  }
  await db.accessoryPurchase.updateMany({
    where: { poNumber },
    data: { status: "CANCELLED", statusChangedAt: new Date() },
  });
  logAction(session.user!.id!, session.user!.name!, "UPDATE", "AccessoryPurchase", rows.map((r) => r.id).join(","), {
    status: { old: "DRAFT_ORDER", new: "CANCELLED" },
  });
  revalidatePath("/accessories");
  return rows.length;
}

/**
 * List all generated POs grouped by poNumber. Each row represents one PO with
 * its aggregate details. Status is read off the first row — the group-sync
 * prompt in the edit sheet keeps all rows in a PO at the same status in
 * practice, so picking the first row's status is accurate.
 */
export async function getAccessoryPurchaseOrders(fiscalYear?: string) {
  await requirePermission("inventory:accessories:view");
  const rows = await db.accessoryPurchase.findMany({
    where: {
      poNumber: fiscalYear
        ? { contains: `/${fiscalYear}/` }
        : { not: null },
    },
    include: { vendor: true, shipToVendor: true },
    orderBy: [{ createdAt: "desc" }],
  });

  type Agg = {
    poNumber: string;
    vendorId: string | null;
    vendorName: string | null;
    shipToVendorName: string | null;
    lineCount: number;
    totalAmount: number;
    status: string;
    statusChangedAt: Date | null;
    generatedAt: Date;
  };

  const byPo = new Map<string, Agg>();
  for (const r of rows) {
    const po = r.poNumber!;
    const qty = Number(r.quantity ?? 0);
    const cost = r.costPerUnit ? Number(r.costPerUnit) : 0;
    const lineTotal = qty * cost;
    const existing = byPo.get(po);
    if (existing) {
      existing.lineCount += 1;
      existing.totalAmount += lineTotal;
      // Earliest createdAt = when the PO was generated.
      if (r.createdAt < existing.generatedAt) existing.generatedAt = r.createdAt;
    } else {
      byPo.set(po, {
        poNumber: po,
        vendorId: r.vendorId,
        vendorName: r.vendor?.name ?? null,
        shipToVendorName: r.shipToVendor?.name ?? null,
        lineCount: 1,
        totalAmount: lineTotal,
        status: r.status,
        statusChangedAt: r.statusChangedAt ?? null,
        generatedAt: r.createdAt,
      });
    }
  }

  return Array.from(byPo.values()).sort(
    (a, b) => b.generatedAt.getTime() - a.generatedAt.getTime(),
  );
}

/** Distinct fiscal years present in the accessory PO data, newest first. */
export async function getAccessoryPurchaseOrderFiscalYears(): Promise<string[]> {
  await requirePermission("inventory:accessories:view");
  const rows = await db.accessoryPurchase.findMany({
    where: { poNumber: { not: null } },
    select: { poNumber: true },
    distinct: ["poNumber"],
  });
  const fys = new Set<string>();
  for (const r of rows) {
    const fy = r.poNumber ? fiscalYearFromNumber(r.poNumber) : null;
    if (fy) fys.add(fy);
  }
  return [...fys].sort((a, b) => b.localeCompare(a));
}

/** Fetch all rows sharing a given PO number (for the group-update prompt). */
export async function getPurchasesByPoNumber(poNumber: string) {
  await requirePermission("inventory:accessories:view");
  return db.accessoryPurchase.findMany({
    where: { poNumber },
    select: { id: true, status: true },
  });
}

/** Bulk-update status for a set of rows (used for PO-group sync). */
export async function bulkUpdateAccessoryPurchaseStatus(
  ids: string[],
  status: AccessoryPurchaseStatus,
) {
  const session = await requirePermission("inventory:accessories:edit");
  await db.accessoryPurchase.updateMany({
    where: { id: { in: ids } },
    data: { status, statusChangedAt: new Date() },
  });
  logAction(session.user!.id!, session.user!.name!, "UPDATE", "AccessoryPurchase", ids.join(","), {
    status: { old: "various", new: status },
  });
  revalidatePath("/accessory-purchases");
}

/**
 * Data for the PO print page. Accepts either a list of IDs or a single
 * poNumber. Does not allocate PO numbers — call generateAccessoryPurchaseOrders
 * first to stamp them.
 */
export async function getAccessoryPurchaseOrderData(
  param: { ids: string[] } | { poNumber: string },
) {
  await requirePermission("inventory:accessories:edit");

  const where =
    "poNumber" in param
      ? { poNumber: param.poNumber, vendorId: { not: null } }
      : { id: { in: param.ids }, vendorId: { not: null } };

  const purchases = await db.accessoryPurchase.findMany({
    where,
    include: { accessory: true, vendor: true, shipToVendor: true, phase: true },
    orderBy: [{ vendorId: "asc" }, { createdAt: "asc" }],
  });

  const poNumbersByVendorId: Record<string, string> = {};
  for (const p of purchases) {
    if (p.vendorId && p.poNumber) poNumbersByVendorId[p.vendorId] = p.poNumber;
  }

  return { purchases, poNumbersByVendorId };
}
