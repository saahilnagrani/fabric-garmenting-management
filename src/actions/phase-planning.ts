"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/require-permission";
import { createLookupResolver } from "@/lib/lookups";

export type PlannedArticleOrder = {
  styleNumber: string;
  articleNumber: string;
  skuCode: string;
  colourOrdered: string;
  garmentNumber: number;
  isRepeat: boolean;
  type: string;
  gender: string;
  productName: string;
  fabricVendorId: string;
  fabricName: string;
  fabric2Name: string | null;
  fabric2VendorId: string | null;
  fabricCostPerKg: number | null;
  fabric2CostPerKg: number | null;
  assumedFabricGarmentsPerKg: number | null;
  assumedFabric2GarmentsPerKg: number | null;
  stitchingCost: number | null;
  brandLogoCost: number | null;
  neckTwillCost: number | null;
  reflectorsCost: number | null;
  fusingCost: number | null;
  accessoriesCost: number | null;
  brandTagCost: number | null;
  sizeTagCost: number | null;
  packagingCost: number | null;
  outwardShippingCost: number | null;
  proposedMrp: number | null;
  onlineMrp: number | null;
  garmentingAt: string | null;
};

export type PlannedFabricOrder = {
  fabricName: string;
  fabricVendorId: string;
  articleNumbers: string;
  colour: string;
  // Index of the article order this fabric order belongs to, within the
  // articleOrders array passed to createPlanOrders. Used to wire the
  // ProductFabricOrder join row by direct identity, with no string parsing
  // or colour-key matching, so multi-fabric article orders link correctly.
  articleOrderIndex: number;
  fabricOrderedQuantityKg: number;
  costPerUnit: number | null;
  isRepeat: boolean;
  gender: string | null;
  orderStatus: string;
  garmentingAt: string | null;
};

export async function createPlanOrders(
  phaseId: string,
  articleOrders: PlannedArticleOrder[],
  fabricOrders: PlannedFabricOrder[]
) {
  await requirePermission("inventory:phases:edit");
  const resolver = createLookupResolver();
  await db.$transaction(async (tx) => {
    // Parallel array to articleOrders: holds the created Product's id and the
    // fabric names for each slot, so we can resolve which slot a fabric order
    // belongs to without re-deriving identity from text fields.
    const createdArticleOrders: { id: string; fabricName: string; fabric2Name: string | null }[] = [];

    for (const ao of articleOrders) {
      const colourOrderedId = await resolver.colourId(ao.colourOrdered);
      const typeRefId = await resolver.productTypeId(ao.type);
      const garmentingAtId = await resolver.garmentingLocationId(ao.garmentingAt);
      const product = await tx.product.create({
        data: {
          phaseId,
          orderDate: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
          styleNumber: ao.styleNumber,
          articleNumber: ao.articleNumber,
          skuCode: ao.skuCode,
          colourOrdered: ao.colourOrdered,
          colourOrderedId,
          garmentNumber: ao.garmentNumber,
          isRepeat: ao.isRepeat,
          type: ao.type,
          typeRefId,
          garmentingAt: ao.garmentingAt,
          garmentingAtId,
          gender: ao.gender as "MENS" | "WOMENS" | "KIDS",
          productName: ao.productName || null,
          fabricVendorId: ao.fabricVendorId,
          fabricName: ao.fabricName,
          fabric2Name: ao.fabric2Name,
          fabric2VendorId: ao.fabric2VendorId,
          fabricCostPerKg: ao.fabricCostPerKg,
          fabric2CostPerKg: ao.fabric2CostPerKg,
          assumedFabricGarmentsPerKg: ao.assumedFabricGarmentsPerKg,
          assumedFabric2GarmentsPerKg: ao.assumedFabric2GarmentsPerKg,
          fabricOrderedQuantityKg: ao.assumedFabricGarmentsPerKg
            ? ao.garmentNumber / Number(ao.assumedFabricGarmentsPerKg)
            : null,
          fabric2OrderedQuantityKg: ao.assumedFabric2GarmentsPerKg
            ? ao.garmentNumber / Number(ao.assumedFabric2GarmentsPerKg)
            : null,
          stitchingCost: ao.stitchingCost,
          brandLogoCost: ao.brandLogoCost,
          neckTwillCost: ao.neckTwillCost,
          reflectorsCost: ao.reflectorsCost,
          fusingCost: ao.fusingCost,
          accessoriesCost: ao.accessoriesCost,
          brandTagCost: ao.brandTagCost,
          sizeTagCost: ao.sizeTagCost,
          packagingCost: ao.packagingCost,
          outwardShippingCost: ao.outwardShippingCost,
          proposedMrp: ao.proposedMrp,
          onlineMrp: ao.onlineMrp,
          status: "PLANNED",
        },
      });
      createdArticleOrders.push({
        id: product.id,
        fabricName: ao.fabricName,
        fabric2Name: ao.fabric2Name,
      });
    }

    for (const fabric of fabricOrders) {
      const colourId = await resolver.colourId(fabric.colour);
      const garmentingAtId = await resolver.garmentingLocationId(fabric.garmentingAt);
      const fabricOrder = await tx.fabricOrder.create({
        data: {
          phaseId,
          orderDate: new Date(),
          fabricName: fabric.fabricName,
          fabricVendorId: fabric.fabricVendorId,
          articleNumbers: fabric.articleNumbers,
          colour: fabric.colour,
          colourId,
          fabricOrderedQuantityKg: fabric.fabricOrderedQuantityKg,
          costPerUnit: fabric.costPerUnit,
          isRepeat: fabric.isRepeat,
          gender: fabric.gender as "MENS" | "WOMENS" | "KIDS" | null,
          orderStatus: (fabric.orderStatus || "DRAFT_ORDER") as "DRAFT_ORDER" | "PO_SENT" | "PI_RECEIVED" | "ADVANCE_PAID" | "PARTIALLY_SHIPPED" | "DISPATCHED" | "RECEIVED" | "FULLY_SETTLED",
          garmentingAt: fabric.garmentingAt,
          garmentingAtId,
        },
      });

      // Direct lookup by index — no colour parsing, no key collisions.
      const articleOrder = createdArticleOrders[fabric.articleOrderIndex];
      if (!articleOrder) continue;
      const slot =
        articleOrder.fabricName === fabric.fabricName ? 1 :
        articleOrder.fabric2Name === fabric.fabricName ? 2 : null;
      if (slot === null) continue;
      await tx.productFabricOrder.create({
        data: { productId: articleOrder.id, fabricOrderId: fabricOrder.id, fabricSlot: slot },
      });
    }
  });
  revalidatePath("/products");
  revalidatePath("/fabric-orders");
  revalidatePath("/phase-planning");
}

// Check if an article was produced in any previous phase
export async function getArticlesInPreviousPhases(currentPhaseId: string): Promise<Set<string>> {
  await requirePermission("inventory:phases:view");
  const products = await db.product.findMany({
    where: {
      phaseId: { not: currentPhaseId },
      articleNumber: { not: null },
    },
    select: { articleNumber: true },
    distinct: ["articleNumber"],
  });
  return new Set(products.map((p) => p.articleNumber).filter(Boolean) as string[]);
}
