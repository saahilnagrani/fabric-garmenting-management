"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export type PlannedSKUOrder = {
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
};

export type PlannedFabricOrder = {
  fabricName: string;
  fabricVendorId: string;
  styleNumbers: string;
  colour: string;
  fabricOrderedQuantityKg: number;
  costPerUnit: number | null;
  isRepeat: boolean;
  gender: string | null;
  orderStatus: string;
  garmentingAt: string | null;
};

export async function createPlanOrders(
  phaseId: string,
  skuOrders: PlannedSKUOrder[],
  fabricOrders: PlannedFabricOrder[]
) {
  await db.$transaction(async (tx) => {
    for (const sku of skuOrders) {
      await tx.product.create({
        data: {
          phaseId,
          orderDate: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
          styleNumber: sku.styleNumber,
          articleNumber: sku.articleNumber,
          skuCode: sku.skuCode,
          colourOrdered: sku.colourOrdered,
          garmentNumber: sku.garmentNumber,
          isRepeat: sku.isRepeat,
          type: sku.type,
          gender: sku.gender as "MENS" | "WOMENS" | "KIDS",
          productName: sku.productName || null,
          fabricVendorId: sku.fabricVendorId,
          fabricName: sku.fabricName,
          fabric2Name: sku.fabric2Name,
          fabric2VendorId: sku.fabric2VendorId,
          fabricCostPerKg: sku.fabricCostPerKg,
          fabric2CostPerKg: sku.fabric2CostPerKg,
          assumedFabricGarmentsPerKg: sku.assumedFabricGarmentsPerKg,
          assumedFabric2GarmentsPerKg: sku.assumedFabric2GarmentsPerKg,
          fabricOrderedQuantityKg: sku.assumedFabricGarmentsPerKg
            ? sku.garmentNumber / Number(sku.assumedFabricGarmentsPerKg)
            : null,
          fabric2OrderedQuantityKg: sku.assumedFabric2GarmentsPerKg
            ? sku.garmentNumber / Number(sku.assumedFabric2GarmentsPerKg)
            : null,
          stitchingCost: sku.stitchingCost,
          brandLogoCost: sku.brandLogoCost,
          neckTwillCost: sku.neckTwillCost,
          reflectorsCost: sku.reflectorsCost,
          fusingCost: sku.fusingCost,
          accessoriesCost: sku.accessoriesCost,
          brandTagCost: sku.brandTagCost,
          sizeTagCost: sku.sizeTagCost,
          packagingCost: sku.packagingCost,
          outwardShippingCost: sku.outwardShippingCost,
          proposedMrp: sku.proposedMrp,
          onlineMrp: sku.onlineMrp,
          status: "PROCESSING",
        },
      });
    }
    for (const fabric of fabricOrders) {
      await tx.fabricOrder.create({
        data: {
          phaseId,
          orderDate: new Date(),
          fabricName: fabric.fabricName,
          fabricVendorId: fabric.fabricVendorId,
          styleNumbers: fabric.styleNumbers,
          colour: fabric.colour,
          fabricOrderedQuantityKg: fabric.fabricOrderedQuantityKg,
          costPerUnit: fabric.costPerUnit,
          isRepeat: fabric.isRepeat,
          gender: fabric.gender as "MENS" | "WOMENS" | "KIDS" | null,
          orderStatus: (fabric.orderStatus || "DRAFT_ORDER") as "DRAFT_ORDER" | "ORDERED" | "PARTIALLY_SHIPPED" | "SHIPPED" | "RECEIVED",
          garmentingAt: fabric.garmentingAt,
        },
      });
    }
  });
  revalidatePath("/products");
  revalidatePath("/fabric-orders");
  revalidatePath("/phase-planning");
}

// Check if an article was produced in any previous phase
export async function getArticlesInPreviousPhases(currentPhaseId: string): Promise<Set<string>> {
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
