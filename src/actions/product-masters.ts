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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createProductMaster(data: any) {
  const session = await requirePermission("inventory:masters:edit");
  const master = await db.productMaster.create({ data });
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
  const master = await db.productMaster.update({ where: { id }, data });
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
export async function batchCreateProductMasters(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sharedData: Record<string, any>,
  skuEntries: { skuCode: string; colour: string }[]
) {
  const session = await requirePermission("inventory:masters:edit");

  const created = [];
  for (const entry of skuEntries) {
    const master = await db.productMaster.create({
      data: {
        ...sharedData,
        skuCode: entry.skuCode,
        coloursAvailable: [entry.colour],
      },
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

  const result = Array.from(groups.entries()).map(([articleNumber, rows]) => {
    const first = rows[0];
    const allColours = rows.flatMap((r) => r.coloursAvailable);
    const n = (v: unknown) => (v != null ? Number(v) : null);
    return {
      articleNumber,
      styleNumber: first.styleNumber,
      fabricName: first.fabricName,
      fabric2Name: first.fabric2Name,
      type: first.type,
      gender: first.gender,
      productName: first.productName,
      colours: allColours,
      skuCount: rows.length,
      skus: rows.map((r) => ({
        id: r.id,
        skuCode: r.skuCode,
        colour: r.coloursAvailable[0] || "",
        isStrikedThrough: r.isStrikedThrough,
      })),
      // Use first row for shared cost data — force plain numbers
      garmentsPerKg: n(first.garmentsPerKg),
      garmentsPerKg2: n(first.garmentsPerKg2),
      fabricCostPerKg: n(first.fabricCostPerKg),
      fabric2CostPerKg: n(first.fabric2CostPerKg),
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
    };
  });
  // Strip any remaining Prisma Decimal/Date objects for RSC serialization
  return JSON.parse(JSON.stringify(result));
});
