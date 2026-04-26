"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/require-permission";
import { logAction, computeDiff } from "@/lib/audit";
import { ensureDnNumberForDispatchGroup, fiscalYearFromNumber } from "@/lib/po-numbering";
import type { AccessoryDispatchStatus } from "@/generated/prisma/client";
import { createLookupResolver } from "@/lib/lookups";

async function attachAccessoryDispatchLookupIds<T extends Record<string, unknown>>(data: T): Promise<T> {
  if ("destinationGarmenter" in data) {
    const resolver = createLookupResolver();
    (data as Record<string, unknown>).destinationGarmenterId = await resolver.garmentingLocationId(
      data.destinationGarmenter as string | null | undefined,
    );
  }
  return data;
}

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
  await attachAccessoryDispatchLookupIds(data);
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
  await attachAccessoryDispatchLookupIds(data);
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

/**
 * Resolve every BOM line for an article (via its matching ProductMaster).
 * Returns the accessory metadata plus per-piece quantity and the computed
 * total quantity for this article's piece count. Used by the article order
 * sheet to display the BOM alongside the order.
 */
export async function getBomForProduct(productId: string) {
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
  if (!product) return { lines: [], pieces: 0, masterFound: false };

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
  if (!master) return { lines: [], pieces: 0, masterFound: false };

  const bom = await db.productMasterAccessory.findMany({
    where: { productMasterId: master.id },
    include: { accessory: true },
  });

  const pieces =
    product.actualInwardTotal && product.actualInwardTotal > 0
      ? product.actualInwardTotal
      : product.garmentNumber || 0;

  const lines = bom.map((b) => ({
    accessoryId: b.accessoryId,
    baseName: b.accessory.baseName,
    colour: b.accessory.colour,
    size: b.accessory.size,
    category: b.accessory.category,
    unit: b.accessory.unit,
    quantityPerPiece: Number(b.quantityPerPiece),
    totalQuantity: pieces * Number(b.quantityPerPiece),
    notes: b.notes,
  }));

  return { lines, pieces, masterFound: true };
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
  const resolver = createLookupResolver();
  const destinationGarmenterId = await resolver.garmentingLocationId(product.garmentingAt);
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
        destinationGarmenterId,
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

/**
 * Stamp dnNumber onto selected dispatch rows (grouped by destinationGarmenter).
 * Does NOT change status — user drives that manually. Rows without a
 * destination are rejected because a DN has to have a recipient.
 */
export async function generateAccessoryDispatchNotes(
  ids: string[],
): Promise<Record<string, string>> {
  await requirePermission("inventory:accessories:edit");
  if (!ids.length) return {};

  const dispatches = await db.accessoryDispatch.findMany({
    where: { id: { in: ids } },
    select: { id: true, destinationGarmenter: true, dnNumber: true },
  });

  const missingDest = dispatches.filter((d) => !d.destinationGarmenter);
  if (missingDest.length > 0) {
    throw new Error(
      `${missingDest.length} dispatch row(s) have no destination garmenter. Set a destination before generating a DN.`
    );
  }

  const byGarmenter = new Map<string, string[]>();
  for (const d of dispatches) {
    const key = d.destinationGarmenter!;
    const list = byGarmenter.get(key) ?? [];
    list.push(d.id);
    byGarmenter.set(key, list);
  }

  const dnNumbersByGarmenter: Record<string, string> = {};
  for (const [garmenter, groupIds] of byGarmenter.entries()) {
    const dnNumber = await ensureDnNumberForDispatchGroup(groupIds);
    dnNumbersByGarmenter[garmenter] = dnNumber;
  }

  revalidatePath("/accessories");
  return dnNumbersByGarmenter;
}

/** Fetch all rows sharing a given DN number (for the group-update prompt). */
export async function getDispatchesByDnNumber(dnNumber: string) {
  await requirePermission("inventory:accessories:view");
  return db.accessoryDispatch.findMany({
    where: { dnNumber },
    select: { id: true, status: true },
  });
}

export async function bulkUpdateAccessoryDispatchStatus(
  ids: string[],
  status: AccessoryDispatchStatus,
) {
  const session = await requirePermission("inventory:accessories:edit");
  await db.accessoryDispatch.updateMany({
    where: { id: { in: ids } },
    data: { status, statusChangedAt: new Date() },
  });
  logAction(session.user!.id!, session.user!.name!, "UPDATE", "AccessoryDispatch", ids.join(","), {
    status: { old: "various", new: status },
  });
  revalidatePath("/accessories");
}

/**
 * Cancel a DN: mark every row in the group as CANCELLED. The DN number stays
 * on the rows so the cancelled note still shows in the DN list. Only allowed
 * while every row is still DRAFT; once the DN has been issued (DISPATCHED or
 * beyond) the garmenter has been notified and it can't be unilaterally voided.
 */
export async function cancelAccessoryDispatchNote(dnNumber: string) {
  const session = await requirePermission("inventory:accessories:edit");
  const rows = await db.accessoryDispatch.findMany({
    where: { dnNumber },
    select: { id: true, status: true },
  });
  if (rows.length === 0) throw new Error(`No rows found for DN ${dnNumber}`);
  const advanced = rows.filter((r) => r.status !== "DRAFT");
  if (advanced.length > 0) {
    throw new Error(
      `Cannot cancel DN ${dnNumber}: ${advanced.length} row(s) are past Draft status. Revert their status first.`
    );
  }
  await db.accessoryDispatch.updateMany({
    where: { dnNumber },
    data: { status: "CANCELLED", statusChangedAt: new Date() },
  });
  logAction(session.user!.id!, session.user!.name!, "UPDATE", "AccessoryDispatch", rows.map((r) => r.id).join(","), {
    status: { old: "DRAFT", new: "CANCELLED" },
  });
  revalidatePath("/accessories");
  return rows.length;
}

/**
 * Aggregated list of every generated DN. One row per dnNumber. Status is
 * read off the first row in the group; the group-sync prompt in the sheet
 * keeps them aligned in practice.
 */
export async function getAccessoryDispatchNotes(fiscalYear?: string) {
  await requirePermission("inventory:accessories:view");
  const rows = await db.accessoryDispatch.findMany({
    where: {
      dnNumber: fiscalYear
        ? { contains: `/${fiscalYear}/` }
        : { not: null },
    },
    include: { accessory: true },
    orderBy: [{ createdAt: "desc" }],
  });

  type Agg = {
    dnNumber: string;
    destinationGarmenter: string | null;
    lineCount: number;
    totalQuantity: number;
    status: string;
    generatedAt: Date;
  };

  const byDn = new Map<string, Agg>();
  for (const r of rows) {
    const dn = r.dnNumber!;
    const qty = Number(r.quantity ?? 0);
    const existing = byDn.get(dn);
    if (existing) {
      existing.lineCount += 1;
      existing.totalQuantity += qty;
      if (r.createdAt < existing.generatedAt) existing.generatedAt = r.createdAt;
    } else {
      byDn.set(dn, {
        dnNumber: dn,
        destinationGarmenter: r.destinationGarmenter,
        lineCount: 1,
        totalQuantity: qty,
        status: r.status,
        generatedAt: r.createdAt,
      });
    }
  }

  return Array.from(byDn.values()).sort(
    (a, b) => b.generatedAt.getTime() - a.generatedAt.getTime(),
  );
}

/** Distinct fiscal years present in the dispatch-note data, newest first. */
export async function getAccessoryDispatchNoteFiscalYears(): Promise<string[]> {
  await requirePermission("inventory:accessories:view");
  const rows = await db.accessoryDispatch.findMany({
    where: { dnNumber: { not: null } },
    select: { dnNumber: true },
    distinct: ["dnNumber"],
  });
  const fys = new Set<string>();
  for (const r of rows) {
    const fy = r.dnNumber ? fiscalYearFromNumber(r.dnNumber) : null;
    if (fy) fys.add(fy);
  }
  return [...fys].sort((a, b) => b.localeCompare(a));
}

/** Data for the DN print page. Accepts either ids or a dnNumber. */
export async function getAccessoryDispatchNoteData(
  param: { ids: string[] } | { dnNumber: string },
) {
  await requirePermission("inventory:accessories:edit");

  const where =
    "dnNumber" in param
      ? { dnNumber: param.dnNumber }
      : { id: { in: param.ids } };

  const dispatches = await db.accessoryDispatch.findMany({
    where,
    include: {
      accessory: true,
      product: {
        select: {
          id: true,
          articleNumber: true,
          styleNumber: true,
          colourOrdered: true,
          productName: true,
        },
      },
      phase: true,
    },
    orderBy: [{ destinationGarmenter: "asc" }, { createdAt: "asc" }],
  });

  const dnNumbersByGarmenter: Record<string, string> = {};
  for (const d of dispatches) {
    if (d.destinationGarmenter && d.dnNumber) {
      dnNumbersByGarmenter[d.destinationGarmenter] = d.dnNumber;
    }
  }

  return { dispatches, dnNumbersByGarmenter };
}
