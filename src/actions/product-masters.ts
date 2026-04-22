"use server";

import { cache } from "react";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/require-permission";
import { logAction, computeDiff } from "@/lib/audit";

export const getProductMasters = cache(async (includeArchived = false) => {
  await requirePermission("inventory:masters:view");
  return db.productMaster.findMany({
    where: includeArchived ? {} : { isStrikedThrough: false },
    orderBy: { skuCode: "asc" },
  });
});

/** Fetch a single ProductMaster with its BOM lines and joined accessory rows. */
export async function getProductMasterBom(id: string) {
  await requirePermission("inventory:masters:view");
  const links = await db.productMasterAccessory.findMany({
    where: { productMasterId: id },
    include: { accessory: true },
    orderBy: { createdAt: "asc" },
  });
  return JSON.parse(JSON.stringify(links));
}

async function linkArticleToFabricMaster(fabricName: string | null | undefined, articleNumber: string) {
  if (!fabricName || !articleNumber || articleNumber === "-") return;
  const master = await db.fabricMaster.findFirst({
    where: { fabricName, isStrikedThrough: false },
    select: { id: true, articleNumbers: true, deletedArticleNumbers: true },
  });
  if (!master) return;
  if (!master.articleNumbers.includes(articleNumber)) {
    await db.fabricMaster.update({
      where: { id: master.id },
      data: {
        articleNumbers: { push: articleNumber },
        // Remove from deleted list if it was previously deleted
        deletedArticleNumbers: master.deletedArticleNumbers.filter((a) => a !== articleNumber),
      },
    });
    revalidatePath("/fabric-masters");
  }
}

async function unlinkArticleFromFabricMaster(fabricName: string | null | undefined, articleNumber: string, markAsDeleted = true) {
  if (!fabricName || !articleNumber || articleNumber === "-") return;
  const master = await db.fabricMaster.findFirst({
    where: { fabricName, isStrikedThrough: false },
    select: { id: true, articleNumbers: true, deletedArticleNumbers: true },
  });
  if (!master) return;
  if (master.articleNumbers.includes(articleNumber)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {
      articleNumbers: master.articleNumbers.filter((a) => a !== articleNumber),
    };
    // Only add to deleted list when the article is actually deleted, not just renamed
    if (markAsDeleted && !master.deletedArticleNumbers.includes(articleNumber)) {
      updateData.deletedArticleNumbers = [...master.deletedArticleNumbers, articleNumber];
    }
    await db.fabricMaster.update({ where: { id: master.id }, data: updateData });
    revalidatePath("/fabric-masters");
  }
}

type BomLine = { accessoryId: string; quantityPerPiece: number; notes?: string | null };

async function syncBomLines(productMasterId: string, lines: BomLine[]) {
  await db.productMasterAccessory.deleteMany({ where: { productMasterId } });
  if (lines.length > 0) {
    await db.productMasterAccessory.createMany({
      data: lines.map((l) => ({
        productMasterId,
        accessoryId: l.accessoryId,
        quantityPerPiece: l.quantityPerPiece,
        notes: l.notes ?? null,
      })),
      skipDuplicates: true,
    });
  }
  // Keep accessory master grid in sync so article counts stay current.
  revalidatePath("/accessory-masters");
  revalidatePath("/accessories");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createProductMaster(data: any) {
  const session = await requirePermission("inventory:masters:edit");
  // Pull bomLines off the payload before passing to Prisma
  const bomLines: BomLine[] | undefined = data.bomLines;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { bomLines: _bom, ...createData } = data;
  // If an archived row holds this skuCode, remove it so the unique constraint doesn't block.
  if (createData.skuCode) {
    await db.productMaster.deleteMany({
      where: { skuCode: createData.skuCode, isStrikedThrough: true },
    });
  }
  const master = await db.productMaster.create({ data: createData });
  if (bomLines) await syncBomLines(master.id, bomLines);
  await linkArticleToFabricMaster(data.fabricName, data.articleNumber);
  await linkArticleToFabricMaster(data.fabric2Name, data.articleNumber);
  logAction(session.user!.id!, session.user!.name!, "CREATE", "ProductMaster", master.id);
  revalidatePath("/product-masters");
  return JSON.parse(JSON.stringify(master));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function updateProductMaster(id: string, data: any) {
  const session = await requirePermission("inventory:masters:edit");
  const previous = await db.productMaster.findUnique({ where: { id } });
  // Pull bomLines off the payload before passing to Prisma
  const bomLines: BomLine[] | undefined = data.bomLines;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { bomLines: _bom, ...updateData } = data;
  const master = await db.productMaster.update({ where: { id }, data: updateData });
  if (bomLines !== undefined) await syncBomLines(id, bomLines);
  // Reverse sync: if article number changed (renamed), unlink old without marking as deleted
  if (previous && previous.articleNumber && previous.articleNumber !== master.articleNumber) {
    await unlinkArticleFromFabricMaster(previous.fabricName, previous.articleNumber, false);
    if (previous.fabric2Name) await unlinkArticleFromFabricMaster(previous.fabric2Name, previous.articleNumber, false);
  }
  // Forward sync: link new article number to fabric master
  if (data.fabricName && master.articleNumber) {
    await linkArticleToFabricMaster(data.fabricName, master.articleNumber);
  }
  if (data.fabric2Name && master.articleNumber) {
    await linkArticleToFabricMaster(data.fabric2Name, master.articleNumber);
  }
  const action = data.isStrikedThrough !== undefined ? "ARCHIVE" : "UPDATE";
  const changes = previous ? computeDiff(previous as unknown as Record<string, unknown>, master as unknown as Record<string, unknown>) : undefined;
  logAction(session.user!.id!, session.user!.name!, action, "ProductMaster", id, changes);
  revalidatePath("/product-masters");
  return JSON.parse(JSON.stringify(master));
}

export async function deleteProductMaster(id: string) {
  const session = await requirePermission("inventory:masters:edit");
  const existing = await db.productMaster.findUnique({ where: { id } });
  await db.productMaster.delete({ where: { id } });
  // Unlink article number from fabric masters
  if (existing?.articleNumber) {
    await unlinkArticleFromFabricMaster(existing.fabricName, existing.articleNumber);
    if (existing.fabric2Name) await unlinkArticleFromFabricMaster(existing.fabric2Name, existing.articleNumber);
  }
  logAction(session.user!.id!, session.user!.name!, "DELETE", "ProductMaster", id);
  revalidatePath("/product-masters");
}

/**
 * Get the next sequence number for a gender+typeCode combo.
 * Scans existing SKU codes matching the pattern "{G} {TC}##" and returns next number.
 * e.g., if M SH01, M SH02 exist, returns 3.
 */
export async function getNextStyleSequence(genderPrefix: string, typeCode: string): Promise<number> {
  await requirePermission("inventory:masters:view");
  const prefix = `${genderPrefix} ${typeCode}`;
  const existing = await db.productMaster.findMany({
    where: {
      skuCode: { startsWith: prefix },
      isStrikedThrough: false,
    },
    select: { skuCode: true },
  });
  let max = 0;
  for (const row of existing) {
    // SKU format: "M SH05 BLK" — extract the number after the type code
    const afterPrefix = row.skuCode.slice(prefix.length);
    const numMatch = afterPrefix.match(/^(\d+)/);
    if (numMatch) {
      const n = parseInt(numMatch[1], 10);
      if (n > max) max = n;
    }
  }
  return max + 1;
}

/**
 * Batch-create multiple product masters (one per colour for a style).
 * All share the same style details; each gets a unique SKU code and colour.
 */
/**
 * Toggle the manual-clean flag on every SKU of an article (identified by articleNumber OR
 * styleNumber when articleNumber is missing). Null = not cleaned, a timestamp = locked against
 * Excel import overwrites.
 */
export async function setArticleCleaned(articleKey: string, cleaned: boolean) {
  const session = await requirePermission("inventory:masters:edit");
  const when = cleaned ? new Date() : null;
  const result = await db.productMaster.updateMany({
    where: {
      OR: [{ articleNumber: articleKey }, { styleNumber: articleKey }],
    },
    data: { manuallyCleanedAt: when },
  });
  logAction(session.user!.id!, session.user!.name!, "UPDATE", "ProductMaster", articleKey, { manuallyCleanedAt: { old: null, new: when } });
  revalidatePath("/product-masters");
  return { count: result.count, manuallyCleanedAt: when };
}

export async function checkSkuCodeExists(skuCode: string): Promise<boolean> {
  await requirePermission("inventory:masters:view");
  const existing = await db.productMaster.findFirst({
    where: { skuCode, isStrikedThrough: false },
    select: { id: true },
  });
  return existing !== null;
}

export async function batchCreateProductMasters(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sharedData: Record<string, any>,
  skuEntries: { skuCode: string; colour: string; colour2?: string; colour3?: string; colour4?: string }[]
) {
  const session = await requirePermission("inventory:masters:edit");

  const created = [];
  for (const entry of skuEntries) {
    // If an archived row holds this skuCode, remove it so the unique constraint doesn't block.
    await db.productMaster.deleteMany({
      where: { skuCode: entry.skuCode, isStrikedThrough: true },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const master = await db.productMaster.create({
      data: {
        ...sharedData,
        skuCode: entry.skuCode,
        coloursAvailable: [entry.colour],
        colours2Available: entry.colour2 ? [entry.colour2] : [],
        colours3Available: entry.colour3 ? [entry.colour3] : [],
        colours4Available: entry.colour4 ? [entry.colour4] : [],
      } as any,
    });
    created.push(master);
    logAction(session.user!.id!, session.user!.name!, "CREATE", "ProductMaster", master.id);
  }

  // Link style to fabric masters
  if (sharedData.fabricName && sharedData.styleNumber) {
    await linkArticleToFabricMaster(sharedData.fabricName, sharedData.articleNumber);
  }
  if (sharedData.fabric2Name && sharedData.styleNumber) {
    await linkArticleToFabricMaster(sharedData.fabric2Name, sharedData.articleNumber);
  }
  if (sharedData.fabric3Name && sharedData.styleNumber) {
    await linkArticleToFabricMaster(sharedData.fabric3Name, sharedData.articleNumber);
  }
  if (sharedData.fabric4Name && sharedData.styleNumber) {
    await linkArticleToFabricMaster(sharedData.fabric4Name, sharedData.articleNumber);
  }

  revalidatePath("/product-masters");
  return JSON.parse(JSON.stringify(created));
}

/**
 * Get all product masters grouped by articleNumber.
 * Returns article-level data with the list of colour SKUs.
 */
export const getProductMastersGrouped = cache(async (includeArchived = false) => {
  await requirePermission("inventory:masters:view");
  const all = await db.productMaster.findMany({
    where: includeArchived ? {} : { isStrikedThrough: false },
    orderBy: [{ articleNumber: "asc" }, { skuCode: "asc" }],
  });

  // Group by articleNumber (fallback to styleNumber if no articleNumber)
  const groups = new Map<string, typeof all>();
  for (const row of all) {
    const key = row.articleNumber || row.styleNumber;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }

  // Fetch archived SKUs for the same articles so edit flows can un-archive rather than
  // collide on unique skuCode when a previously archived variant is re-added.
  const archivedByArticle = new Map<string, { id: string; skuCode: string; colour: string; colour2: string; colour3: string; colour4: string }[]>();
  if (!includeArchived) {
    const articleKeys = Array.from(groups.keys()).filter(Boolean);
    if (articleKeys.length > 0) {
      const archived = await db.productMaster.findMany({
        where: {
          isStrikedThrough: true,
          OR: [
            { articleNumber: { in: articleKeys } },
            { styleNumber: { in: articleKeys } },
          ],
        },
        select: { id: true, skuCode: true, articleNumber: true, styleNumber: true, coloursAvailable: true, colours2Available: true, colours3Available: true, colours4Available: true },
      });
      for (const a of archived) {
        const key = a.articleNumber || a.styleNumber;
        if (!key) continue;
        if (!archivedByArticle.has(key)) archivedByArticle.set(key, []);
        archivedByArticle.get(key)!.push({
          id: a.id,
          skuCode: a.skuCode,
          colour: a.coloursAvailable?.[0] || "",
          colour2: a.colours2Available?.[0] || "",
          colour3: a.colours3Available?.[0] || "",
          colour4: a.colours4Available?.[0] || "",
        });
      }
    }
  }

  const result = Array.from(groups.entries()).map(([articleNumber, rows]) => {
    const first = rows[0];
    // Build one label per SKU — full combo for multi-fabric variants (e.g. "Black / Lime / Red")
    const allColours = rows.map((r) => {
      const parts = [
        r.coloursAvailable?.[0],
        r.colours2Available?.[0],
        r.colours3Available?.[0],
        r.colours4Available?.[0],
      ].filter(Boolean) as string[];
      return parts.join(" / ");
    }).filter(Boolean);
    const n = (v: unknown) => (v != null ? Number(v) : null);
    return {
      articleNumber,
      styleNumber: first.styleNumber,
      fabricName: first.fabricName,
      fabric2Name: first.fabric2Name,
      fabric3Name: first.fabric3Name,
      fabric4Name: first.fabric4Name,
      type: first.type,
      gender: first.gender,
      productName: first.productName,
      colours: allColours,
      skuCount: rows.length,
      skus: rows.map((r) => ({
        id: r.id,
        skuCode: r.skuCode,
        colour: r.coloursAvailable?.[0] || "",
        colour2: r.colours2Available?.[0] || "",
        colour3: r.colours3Available?.[0] || "",
        colour4: r.colours4Available?.[0] || "",
        isStrikedThrough: r.isStrikedThrough,
      })),
      archivedSkus: archivedByArticle.get(articleNumber) || [],
      // Use first row for shared cost data — force plain numbers
      garmentsPerKg: n(first.garmentsPerKg),
      garmentsPerKg2: n(first.garmentsPerKg2),
      garmentsPerKg3: n(first.garmentsPerKg3),
      garmentsPerKg4: n(first.garmentsPerKg4),
      fabricCostPerKg: n(first.fabricCostPerKg),
      fabric2CostPerKg: n(first.fabric2CostPerKg),
      fabric3CostPerKg: n(first.fabric3CostPerKg),
      fabric4CostPerKg: n(first.fabric4CostPerKg),
      stitchingCost: n(first.stitchingCost),
      brandLogoCost: n(first.brandLogoCost),
      neckTwillCost: n(first.neckTwillCost),
      reflectorsCost: n(first.reflectorsCost),
      fusingCost: n(first.fusingCost),
      accessoriesCost: n(first.accessoriesCost),
      brandTagCost: n(first.brandTagCost),
      sizeTagCost: n(first.sizeTagCost),
      packagingCost: n(first.packagingCost),
      inwardShipping: n(first.inwardShipping),
      proposedMrp: n(first.proposedMrp),
      onlineMrp: n(first.onlineMrp),
      isStrikedThrough: first.isStrikedThrough,
      manuallyCleanedAt: first.manuallyCleanedAt,
    };
  });
  // Strip any remaining Prisma Decimal/Date objects for RSC serialization
  return JSON.parse(JSON.stringify(result));
});
