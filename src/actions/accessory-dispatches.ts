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

export type AutoDispatchResult = {
  productId: string;
  articleNumber: string | null;
  colour: string;
  created: number;
  skipped: number;
  warning: string | null;
};

/**
 * Generate draft accessory dispatch rows for an article order based on its
 * BOM. Used when an article transitions into CUTTING_REPORT_RECEIVED.
 *
 * Behaviour:
 * - Resolves the article's ProductMaster (by skuCode, then style+article).
 * - Reads every ProductMasterAccessory line (the BOM).
 * - For each BOM line, creates an AccessoryDispatch with:
 *     phaseId       = product.phaseId
 *     productId     = product.id
 *     accessoryId   = bom.accessoryId
 *     quantity      = pieces × quantityPerPiece (pieces from inwardTotal,
 *                     falling back to garmentNumber)
 *     destinationGarmenter = product.garmentingAt
 *     dispatchDate  = null (drafts; warehouse fills in actual date)
 * - Idempotent: if a dispatch row already exists for (productId, accessoryId),
 *   that BOM line is skipped instead of duplicated.
 *
 * Returns a result object the caller can use to surface a toast.
 */
export async function autoCreateDispatchesForProduct(
  productId: string,
  actor: { id: string; name: string } | null
): Promise<AutoDispatchResult> {
  const product = await db.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      phaseId: true,
      skuCode: true,
      styleNumber: true,
      articleNumber: true,
      colourOrdered: true,
      garmentingAt: true,
      garmentNumber: true,
      actualInwardTotal: true,
    },
  });
  if (!product) {
    return {
      productId,
      articleNumber: null,
      colour: "",
      created: 0,
      skipped: 0,
      warning: "Article not found",
    };
  }

  const baseResult = {
    productId,
    articleNumber: product.articleNumber,
    colour: product.colourOrdered,
  };

  // Resolve the matching ProductMaster
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
  if (!master) {
    return {
      ...baseResult,
      created: 0,
      skipped: 0,
      warning: "No matching ProductMaster — cannot derive BOM",
    };
  }

  const bomLines = await db.productMasterAccessory.findMany({
    where: { productMasterId: master.id },
    select: { accessoryId: true, quantityPerPiece: true },
  });
  if (bomLines.length === 0) {
    return {
      ...baseResult,
      created: 0,
      skipped: 0,
      warning: "ProductMaster has no accessory BOM — nothing to dispatch",
    };
  }

  const pieces =
    product.actualInwardTotal && product.actualInwardTotal > 0
      ? product.actualInwardTotal
      : product.garmentNumber || 0;
  if (pieces <= 0) {
    return {
      ...baseResult,
      created: 0,
      skipped: 0,
      warning: "Article has no piece count (garmentNumber / actualInwardTotal both zero)",
    };
  }

  // Find existing dispatch rows for this product so we don't double-create
  const existing = await db.accessoryDispatch.findMany({
    where: { productId, accessoryId: { in: bomLines.map((b) => b.accessoryId) } },
    select: { accessoryId: true },
  });
  const existingAccessoryIds = new Set(existing.map((e) => e.accessoryId));

  let created = 0;
  let skipped = 0;
  for (const line of bomLines) {
    if (existingAccessoryIds.has(line.accessoryId)) {
      skipped++;
      continue;
    }
    const qty = pieces * Number(line.quantityPerPiece);
    const row = await db.accessoryDispatch.create({
      data: {
        phaseId: product.phaseId,
        productId: product.id,
        accessoryId: line.accessoryId,
        quantity: qty,
        destinationGarmenter: product.garmentingAt || null,
        dispatchDate: null,
      },
    });
    if (actor) {
      logAction(actor.id, actor.name, "CREATE", "AccessoryDispatch", row.id, {
        autoGenerated: { old: null, new: `from cutting report on article ${product.articleNumber || product.id}` },
      });
    }
    created++;
  }

  revalidatePath("/accessory-dispatches");
  revalidatePath("/accessory-balance");

  return {
    ...baseResult,
    created,
    skipped,
    warning: null,
  };
}
