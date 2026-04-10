"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/require-permission";
import { logAction, computeDiff } from "@/lib/audit";

export async function getAccessoryDispatches(phaseId: string) {
  await requirePermission("inventory:accessories:view");
  return db.accessoryDispatch.findMany({
    where: { phaseId },
    include: {
      accessory: true,
      product: {
        select: {
          id: true,
          articleNumber: true,
          colourOrdered: true,
          productName: true,
          garmentNumber: true,
        },
      },
    },
    orderBy: [{ dispatchDate: "desc" }, { createdAt: "desc" }],
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createAccessoryDispatch(data: any) {
  const session = await requirePermission("inventory:accessories:create");
  const row = await db.accessoryDispatch.create({ data });
  logAction(session.user!.id!, session.user!.name!, "CREATE", "AccessoryDispatch", row.id);
  revalidatePath("/accessory-dispatches");
  revalidatePath("/accessory-balance");
  return row;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function updateAccessoryDispatch(id: string, data: any) {
  const session = await requirePermission("inventory:accessories:edit");
  const previous = await db.accessoryDispatch.findUnique({ where: { id } });
  const row = await db.accessoryDispatch.update({ where: { id }, data });
  const changes = previous
    ? computeDiff(previous as unknown as Record<string, unknown>, row as unknown as Record<string, unknown>)
    : undefined;
  logAction(session.user!.id!, session.user!.name!, "UPDATE", "AccessoryDispatch", id, changes);
  revalidatePath("/accessory-dispatches");
  revalidatePath("/accessory-balance");
  return row;
}

export async function deleteAccessoryDispatch(id: string) {
  const session = await requirePermission("inventory:accessories:delete");
  await db.accessoryDispatch.delete({ where: { id } });
  logAction(session.user!.id!, session.user!.name!, "DELETE", "AccessoryDispatch", id);
  revalidatePath("/accessory-dispatches");
  revalidatePath("/accessory-balance");
}

/**
 * Look up the BOM-derived suggested dispatch quantity for (product, accessory).
 * Resolves the Product → matching ProductMaster (by skuCode, falling back to
 * styleNumber+articleNumber) → ProductMasterAccessory.quantityPerPiece.
 *
 * Multiplies by Product.actualInwardTotal if non-zero, else Product.garmentNumber.
 * Returns null if no BOM line exists or no piece count is set.
 */
export async function getDispatchSuggestionForProduct(
  productId: string,
  accessoryId: string
): Promise<{ quantity: number; basis: string } | null> {
  await requirePermission("inventory:accessories:view");

  const product = await db.product.findUnique({
    where: { id: productId },
    select: {
      skuCode: true,
      styleNumber: true,
      articleNumber: true,
      garmentNumber: true,
      actualInwardTotal: true,
    },
  });
  if (!product) return null;

  // Try skuCode match first, then styleNumber+articleNumber
  let master = product.skuCode
    ? await db.productMaster.findUnique({
        where: { skuCode: product.skuCode },
        select: { id: true },
      })
    : null;

  if (!master) {
    master = await db.productMaster.findFirst({
      where: {
        styleNumber: product.styleNumber,
        articleNumber: product.articleNumber || undefined,
      },
      select: { id: true },
    });
  }
  if (!master) return null;

  const bom = await db.productMasterAccessory.findUnique({
    where: {
      productMasterId_accessoryId: {
        productMasterId: master.id,
        accessoryId,
      },
    },
  });
  if (!bom) return null;

  const pieces =
    product.actualInwardTotal && product.actualInwardTotal > 0
      ? product.actualInwardTotal
      : product.garmentNumber || 0;
  if (pieces <= 0) return null;

  const perPiece = Number(bom.quantityPerPiece);
  return {
    quantity: pieces * perPiece,
    basis: `${pieces} pcs × ${perPiece}/pc`,
  };
}
