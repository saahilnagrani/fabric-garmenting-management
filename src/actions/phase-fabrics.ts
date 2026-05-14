"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/require-permission";
import { logAction } from "@/lib/audit";
import { resolveFabricAtPhase, resolveCostAtPhase, resyncProductMasterCache } from "@/lib/phase-spec-resolver";

export async function getPhaseFabrics(productMasterId: string) {
  await requirePermission("inventory:masters:view");
  return db.phaseFabric.findMany({
    where: { productMasterId },
    orderBy: { phaseId: "asc" },
  });
}

export async function upsertPhaseFabric(
  phaseId: string,
  productMasterId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any,
) {
  const session = await requirePermission("inventory:masters:edit");
  const result = await db.phaseFabric.upsert({
    where: { phaseId_productMasterId: { phaseId, productMasterId } },
    update: data,
    create: { phaseId, productMasterId, ...data },
  });
  await resyncProductMasterCache(db, productMasterId);
  logAction(session.user!.id!, session.user!.name!, "UPDATE", "PhaseFabric", result.id);
  revalidatePath("/product-masters");
  revalidatePath("/products");
  return result;
}

export async function deletePhaseFabric(phaseId: string, productMasterId: string) {
  const session = await requirePermission("inventory:masters:edit");
  const existing = await db.phaseFabric.findUnique({
    where: { phaseId_productMasterId: { phaseId, productMasterId } },
  });
  if (!existing) return null;
  await db.phaseFabric.delete({
    where: { phaseId_productMasterId: { phaseId, productMasterId } },
  });
  await resyncProductMasterCache(db, productMasterId);
  logAction(session.user!.id!, session.user!.name!, "DELETE", "PhaseFabric", existing.id);
  revalidatePath("/product-masters");
  revalidatePath("/products");
  return existing;
}

/**
 * Combined per-phase inheritance for a new article order. Uses the changelog
 * resolver: walks all PhaseFabric / PhaseCost rows with phase.number <= the
 * order's phase, applies non-null fields cumulatively, and falls back to
 * master defaults for any field never set in the changelog.
 */
export async function getPhaseInheritanceForOrder(productMasterId: string, phaseId: string) {
  await requirePermission("inventory:masters:view");
  const [fabric, cost] = await Promise.all([
    resolveFabricAtPhase(db, productMasterId, phaseId),
    resolveCostAtPhase(db, productMasterId, phaseId),
  ]);
  return { fabric, cost };
}

/**
 * Convenience: resolve fabric spec for many (master, phase) pairs at once.
 * Used by grids that need to compute the "current fabric" of each master.
 */
export async function resolveFabricForMasters(
  pairs: Array<{ productMasterId: string; phaseId: string }>,
) {
  await requirePermission("inventory:masters:view");
  const out: Record<string, Record<string, unknown>> = {};
  for (const { productMasterId, phaseId } of pairs) {
    out[`${productMasterId}:${phaseId}`] = await resolveFabricAtPhase(db, productMasterId, phaseId);
  }
  return out;
}
