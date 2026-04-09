"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/require-permission";
import { logAction } from "@/lib/audit";

export async function getPhaseCosts(entityType: string, entityId: string) {
  await requirePermission("inventory:masters:view");
  const costs = await db.phaseCost.findMany({
    where: { entityType, entityId },
    orderBy: { phaseId: "asc" },
  });
  return costs;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function upsertPhaseCost(phaseId: string, entityType: string, entityId: string, data: any) {
  const session = await requirePermission("inventory:masters:edit");
  const result = await db.phaseCost.upsert({
    where: {
      phaseId_entityType_entityId: { phaseId, entityType, entityId },
    },
    update: data,
    create: { phaseId, entityType, entityId, ...data },
  });
  logAction(session.user!.id!, session.user!.name!, "UPDATE", "PhaseCost", result.id);
  revalidatePath("/fabric-masters");
  revalidatePath("/product-masters");
  return result;
}

/**
 * Returns effective costs for a given phase and entity.
 * Falls back to base master costs if no phase override exists.
 */
export async function getEffectiveCosts(
  phaseId: string,
  entityType: "FABRIC_MASTER" | "PRODUCT_MASTER",
  entityId: string
): Promise<Record<string, number | null>> {
  await requirePermission("inventory:masters:view");

  const phaseCost = await db.phaseCost.findUnique({
    where: {
      phaseId_entityType_entityId: { phaseId, entityType, entityId },
    },
  });

  if (entityType === "FABRIC_MASTER") {
    const master = await db.fabricMaster.findUnique({
      where: { id: entityId },
      select: { mrp: true },
    });
    return {
      fabricCostPerKg: phaseCost?.fabricCostPerKg != null
        ? Number(phaseCost.fabricCostPerKg)
        : master?.mrp != null ? Number(master.mrp) : null,
    };
  }

  // PRODUCT_MASTER
  const master = await db.productMaster.findUnique({
    where: { id: entityId },
    select: {
      fabricCostPerKg: true,
      fabric2CostPerKg: true,
      stitchingCost: true,
      brandLogoCost: true,
      neckTwillCost: true,
      reflectorsCost: true,
      fusingCost: true,
      accessoriesCost: true,
      brandTagCost: true,
      sizeTagCost: true,
      packagingCost: true,
      inwardShipping: true,
    },
  });

  const fields = [
    "fabricCostPerKg", "fabric2CostPerKg", "stitchingCost", "brandLogoCost",
    "neckTwillCost", "reflectorsCost", "fusingCost", "accessoriesCost",
    "brandTagCost", "sizeTagCost", "packagingCost", "inwardShipping",
  ] as const;

  const result: Record<string, number | null> = {};
  for (const field of fields) {
    const override = phaseCost?.[field];
    const base = master?.[field];
    result[field] = override != null ? Number(override) : base != null ? Number(base) : null;
  }

  return result;
}
