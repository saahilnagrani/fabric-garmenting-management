import type { PrismaClient } from "@/generated/prisma/client";

/**
 * Changelog resolution for per-phase product-master spec (fabric + cost).
 *
 * Each `PhaseFabric` / `PhaseCost` row is a *change* at a phase. To resolve
 * the spec at any phase N, walk all rows with `phase.number <= N` in
 * ascending order and apply each row's non-null fields cumulatively. For
 * any field never set in the changelog, fall back to the master's default
 * value on `ProductMaster`.
 *
 * Null in a changelog row = "no change to this field at this phase, inherit
 * the prior value." This lets the user record partial changes (only Fabric 2
 * changed in Phase 4) without restating every slot.
 */

type Tx = Pick<PrismaClient, "phaseFabric" | "phaseCost" | "phase" | "productMaster">;

export const FABRIC_FIELDS = [
  "fabricName", "fabricVendorId", "fabricCostPerKg", "garmentsPerKg",
  "fabric2Name", "fabric2VendorId", "fabric2CostPerKg", "garmentsPerKg2",
  "fabric3Name", "fabric3VendorId", "fabric3CostPerKg", "garmentsPerKg3",
  "fabric4Name", "fabric4VendorId", "fabric4CostPerKg", "garmentsPerKg4",
] as const;

export const COST_FIELDS = [
  "fabricCostPerKg", "fabric2CostPerKg",
  "stitchingCost", "brandLogoCost", "neckTwillCost", "reflectorsCost",
  "fusingCost", "accessoriesCost", "brandTagCost", "sizeTagCost",
  "packagingCost", "inwardShipping",
] as const;

export function applyChangelog(
  rows: Record<string, unknown>[],
  fields: readonly string[],
  fallback: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...fallback };
  for (const row of rows) {
    for (const f of fields) {
      const v = row[f];
      if (v !== null && v !== undefined) out[f] = v;
    }
  }
  return out;
}

export async function fabricMasterDefaults(tx: Tx, productMasterId: string) {
  const m = await tx.productMaster.findUnique({
    where: { id: productMasterId },
    select: {
      fabricName: true, fabricCostPerKg: true, garmentsPerKg: true,
      fabric2Name: true, fabric2CostPerKg: true, garmentsPerKg2: true,
      fabric3Name: true, fabric3CostPerKg: true, garmentsPerKg3: true,
      fabric4Name: true, fabric4CostPerKg: true, garmentsPerKg4: true,
    },
  });
  return {
    fabricName: m?.fabricName ?? null,
    fabricVendorId: null,
    fabricCostPerKg: m?.fabricCostPerKg ?? null,
    garmentsPerKg: m?.garmentsPerKg ?? null,
    fabric2Name: m?.fabric2Name ?? null,
    fabric2VendorId: null,
    fabric2CostPerKg: m?.fabric2CostPerKg ?? null,
    garmentsPerKg2: m?.garmentsPerKg2 ?? null,
    fabric3Name: m?.fabric3Name ?? null,
    fabric3VendorId: null,
    fabric3CostPerKg: m?.fabric3CostPerKg ?? null,
    garmentsPerKg3: m?.garmentsPerKg3 ?? null,
    fabric4Name: m?.fabric4Name ?? null,
    fabric4VendorId: null,
    fabric4CostPerKg: m?.fabric4CostPerKg ?? null,
    garmentsPerKg4: m?.garmentsPerKg4 ?? null,
  };
}

export async function costMasterDefaults(tx: Tx, productMasterId: string) {
  const m = await tx.productMaster.findUnique({
    where: { id: productMasterId },
    select: {
      fabricCostPerKg: true, fabric2CostPerKg: true,
      stitchingCost: true, brandLogoCost: true, neckTwillCost: true,
      reflectorsCost: true, fusingCost: true, accessoriesCost: true,
      brandTagCost: true, sizeTagCost: true, packagingCost: true,
      inwardShipping: true,
    },
  });
  return {
    fabricCostPerKg: m?.fabricCostPerKg ?? null,
    fabric2CostPerKg: m?.fabric2CostPerKg ?? null,
    stitchingCost: m?.stitchingCost ?? null,
    brandLogoCost: m?.brandLogoCost ?? null,
    neckTwillCost: m?.neckTwillCost ?? null,
    reflectorsCost: m?.reflectorsCost ?? null,
    fusingCost: m?.fusingCost ?? null,
    accessoriesCost: m?.accessoriesCost ?? null,
    brandTagCost: m?.brandTagCost ?? null,
    sizeTagCost: m?.sizeTagCost ?? null,
    packagingCost: m?.packagingCost ?? null,
    inwardShipping: m?.inwardShipping ?? null,
  };
}

async function phaseNumberMap(tx: Tx): Promise<Map<string, number>> {
  const phases = await tx.phase.findMany({ select: { id: true, number: true } });
  return new Map(phases.map((p: { id: string; number: number }) => [p.id, p.number]));
}

/** Resolve fabric spec at a given phase. */
export async function resolveFabricAtPhase(
  tx: Tx,
  productMasterId: string,
  phaseId: string,
): Promise<Record<string, unknown>> {
  const [defaults, rows, phases] = await Promise.all([
    fabricMasterDefaults(tx, productMasterId),
    tx.phaseFabric.findMany({ where: { productMasterId } }),
    phaseNumberMap(tx),
  ]);
  const targetNumber = phases.get(phaseId);
  if (targetNumber === undefined) return defaults;
  const filtered = (rows as Record<string, unknown>[])
    .filter((r) => (phases.get(String(r.phaseId)) ?? Infinity) <= targetNumber)
    .sort((a, b) => (phases.get(String(a.phaseId)) ?? 0) - (phases.get(String(b.phaseId)) ?? 0));
  return applyChangelog(filtered, FABRIC_FIELDS as readonly string[], defaults);
}

/**
 * Resync ProductMaster's cached fabric/cost columns to the latest-phase
 * resolved values. Call after any PhaseFabric / PhaseCost write so the
 * master row continues to reflect "current" state. No-op if no phases
 * exist yet.
 */
export async function resyncProductMasterCache(
  tx: Tx,
  productMasterId: string,
): Promise<void> {
  const latest = await tx.phase.findFirst({
    orderBy: { number: "desc" },
    select: { id: true },
  });
  if (!latest) return;
  const [fabric, cost] = await Promise.all([
    resolveFabricAtPhase(tx, productMasterId, latest.id),
    resolveCostAtPhase(tx, productMasterId, latest.id),
  ]);
  // ProductMaster columns: fabric*Name, fabric*CostPerKg, garmentsPerKg*,
  // plus the non-fabric cost fields. vendorId fields on the changelog have
  // no master-column equivalent and are skipped.
  const masterUpdate: Record<string, unknown> = {
    fabricName: fabric.fabricName ?? null,
    fabricCostPerKg: fabric.fabricCostPerKg ?? null,
    garmentsPerKg: fabric.garmentsPerKg ?? null,
    fabric2Name: fabric.fabric2Name ?? null,
    fabric2CostPerKg: fabric.fabric2CostPerKg ?? null,
    garmentsPerKg2: fabric.garmentsPerKg2 ?? null,
    fabric3Name: fabric.fabric3Name ?? null,
    fabric3CostPerKg: fabric.fabric3CostPerKg ?? null,
    garmentsPerKg3: fabric.garmentsPerKg3 ?? null,
    fabric4Name: fabric.fabric4Name ?? null,
    fabric4CostPerKg: fabric.fabric4CostPerKg ?? null,
    garmentsPerKg4: fabric.garmentsPerKg4 ?? null,
    stitchingCost: cost.stitchingCost ?? null,
    brandLogoCost: cost.brandLogoCost ?? null,
    neckTwillCost: cost.neckTwillCost ?? null,
    reflectorsCost: cost.reflectorsCost ?? null,
    fusingCost: cost.fusingCost ?? null,
    accessoriesCost: cost.accessoriesCost ?? null,
    brandTagCost: cost.brandTagCost ?? null,
    sizeTagCost: cost.sizeTagCost ?? null,
    packagingCost: cost.packagingCost ?? null,
    inwardShipping: cost.inwardShipping ?? null,
  };
  await tx.productMaster.update({ where: { id: productMasterId }, data: masterUpdate });
}

/** Resolve cost spec at a given phase. */
export async function resolveCostAtPhase(
  tx: Tx,
  productMasterId: string,
  phaseId: string,
): Promise<Record<string, unknown>> {
  const [defaults, rows, phases] = await Promise.all([
    costMasterDefaults(tx, productMasterId),
    tx.phaseCost.findMany({
      where: { entityType: "PRODUCT_MASTER", entityId: productMasterId },
    }),
    phaseNumberMap(tx),
  ]);
  const targetNumber = phases.get(phaseId);
  if (targetNumber === undefined) return defaults;
  const filtered = (rows as Record<string, unknown>[])
    .filter((r) => (phases.get(String(r.phaseId)) ?? Infinity) <= targetNumber)
    .sort((a, b) => (phases.get(String(a.phaseId)) ?? 0) - (phases.get(String(b.phaseId)) ?? 0));
  return applyChangelog(filtered, COST_FIELDS as readonly string[], defaults);
}
