"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/require-permission";
import { logAction, computeDiff } from "@/lib/audit";
import { createLookupResolver, type LookupResolver } from "@/lib/lookups";

async function attachFabricBalanceLookupIds<T extends Record<string, unknown>>(
  data: T,
  resolver: LookupResolver = createLookupResolver(),
): Promise<T> {
  if ("colour" in data) {
    (data as Record<string, unknown>).colourId = await resolver.colourId(
      data.colour as string | null | undefined,
    );
  }
  if ("garmentingLocation" in data) {
    (data as Record<string, unknown>).garmentingLocationId = await resolver.garmentingLocationId(
      data.garmentingLocation as string | null | undefined,
    );
  }
  return data;
}

/**
 * Manual surplus fabric ledger. Each row represents a leftover quantity of a
 * specific (FabricMaster, colour) the warehouse expects to consume in a future
 * phase, with the cost attributed at the time it was set aside. Computed
 * `costAttributed = remainingKg × costPerKg` is generated client-side.
 */
export async function getFabricBalances() {
  await requirePermission("inventory:fabric_orders:view");
  return db.fabricBalance.findMany({
    where: { isStrikedThrough: false },
    include: {
      fabricMaster: { select: { id: true, fabricName: true, vendorId: true, coloursAvailable: true } },
      vendor: { select: { id: true, name: true } },
      sourcePhase: { select: { id: true, number: true, name: true } },
      targetPhase: { select: { id: true, number: true, name: true } },
    },
    orderBy: [{ createdAt: "desc" }],
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createFabricBalance(data: any) {
  const session = await requirePermission("inventory:fabric_orders:create");
  await attachFabricBalanceLookupIds(data);
  const row = await db.fabricBalance.create({ data });
  logAction(session.user!.id!, session.user!.name!, "CREATE", "FabricBalance", row.id);
  revalidatePath("/fabric-balance");
  return row;
}

/**
 * Bulk-create one FabricBalance per (fabricMasterId, colour) entry in a single
 * submission. Shared fields (cost/kg, source/target phase, notes) are passed
 * once and stamped on every row. Used by the sheet's multi-colour create mode.
 */
export async function createFabricBalancesBulk(input: {
  fabricMasterId: string;
  vendorId: string;
  costPerKg: number;
  sourcePhaseId: string | null;
  targetPhaseId: string | null;
  notes: string | null;
  updateDate: Date | null;
  garmentingLocation: string | null;
  entries: Array<{ colour: string; remainingKg: number }>;
}) {
  const session = await requirePermission("inventory:fabric_orders:create");
  if (input.entries.length === 0) {
    throw new Error("At least one colour row is required");
  }
  const resolver = createLookupResolver();
  const garmentingLocationId = await resolver.garmentingLocationId(input.garmentingLocation);
  const rowsData = await Promise.all(
    input.entries.map(async (e) => ({
      fabricMasterId: input.fabricMasterId,
      vendorId: input.vendorId,
      colour: e.colour,
      colourId: await resolver.colourId(e.colour),
      remainingKg: e.remainingKg,
      costPerKg: input.costPerKg,
      sourcePhaseId: input.sourcePhaseId,
      targetPhaseId: input.targetPhaseId,
      notes: input.notes,
      updateDate: input.updateDate,
      garmentingLocation: input.garmentingLocation,
      garmentingLocationId,
    })),
  );
  const rows = await db.$transaction(rowsData.map((d) => db.fabricBalance.create({ data: d })));
  for (const row of rows) {
    logAction(session.user!.id!, session.user!.name!, "CREATE", "FabricBalance", row.id);
  }
  revalidatePath("/fabric-balance");
  return rows;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function updateFabricBalance(id: string, data: any) {
  const session = await requirePermission("inventory:fabric_orders:edit");
  const previous = await db.fabricBalance.findUnique({ where: { id } });
  await attachFabricBalanceLookupIds(data);
  const row = await db.fabricBalance.update({ where: { id }, data });
  const changes = previous
    ? computeDiff(previous as unknown as Record<string, unknown>, row as unknown as Record<string, unknown>)
    : undefined;
  logAction(session.user!.id!, session.user!.name!, "UPDATE", "FabricBalance", id, changes);
  revalidatePath("/fabric-balance");
  return row;
}

export async function deleteFabricBalance(id: string) {
  const session = await requirePermission("inventory:fabric_orders:delete");
  await db.fabricBalance.delete({ where: { id } });
  logAction(session.user!.id!, session.user!.name!, "DELETE", "FabricBalance", id);
  revalidatePath("/fabric-balance");
}
