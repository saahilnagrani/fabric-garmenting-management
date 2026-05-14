"use server";

import { cache } from "react";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/require-permission";
import { logAction, computeDiff } from "@/lib/audit";
import type { AccessoryUnit } from "@/generated/prisma/client";
import type { PriceTier } from "@/lib/accessory-categories";

export const getAccessoryMasters = cache(async (includeArchived = false) => {
  await requirePermission("inventory:accessories:view");
  return db.accessoryMaster.findMany({
    where: includeArchived ? {} : { isStrikedThrough: false },
    include: {
      vendor: true,
      articleLinks: true,
    },
    orderBy: [{ category: "asc" }, { displayName: "asc" }],
  });
});

export type ArticleCodeUnit = { code: string; units: number };

export type AccessoryMasterInput = {
  category: string;
  name: string;
  unit: AccessoryUnit;
  vendorId?: string | null;
  defaultCostPerUnit?: number | null;
  priceTiers?: PriceTier[];
  hsnCode?: string | null;
  comments?: string | null;
  imageUrl?: string | null;
  articleCodeUnits?: ArticleCodeUnit[];
};

/**
 * Sync article-level BOM entries for an accessory into ArticleAccessory.
 * Replaces all existing links for this accessory with the new set. `code`
 * here is the articleNumber (not the SKU code) — BOM lives at article level.
 */
async function syncArticleCodes(accessoryId: string, entries: ArticleCodeUnit[]) {
  await db.articleAccessory.deleteMany({ where: { accessoryId } });
  if (entries.length === 0) return;

  // Collapse duplicates by article (last write wins).
  const byArticle = new Map<string, number>();
  for (const e of entries) {
    if (!e.code || e.units <= 0) continue;
    byArticle.set(e.code, e.units);
  }
  if (byArticle.size === 0) return;

  await db.articleAccessory.createMany({
    data: [...byArticle.entries()].map(([articleNumber, units]) => ({
      articleNumber,
      accessoryId,
      quantityPerPiece: units,
    })),
    skipDuplicates: true,
  });
}

function revalidateAccessoryPaths() {
  revalidatePath("/accessory-masters");
  revalidatePath("/accessory-purchases");
  revalidatePath("/accessory-dispatches");
  revalidatePath("/accessory-balance");
  revalidatePath("/accessories");
  revalidatePath("/product-masters");
}

/**
 * Create a single AccessoryMaster. The user-entered `name` is the display name.
 */
export async function createAccessoryMaster(input: AccessoryMasterInput) {
  const session = await requirePermission("inventory:accessories:create");

  if (!input.category.trim()) throw new Error("Category is required");
  const displayName = input.name?.trim();
  if (!displayName) throw new Error("Name is required");

  const master = await db.accessoryMaster.create({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: {
      displayName,
      category: input.category.trim(),
      priceTiers: (input.priceTiers ?? []) as any,
      unit: input.unit,
      vendorId: input.vendorId || null,
      defaultCostPerUnit: input.defaultCostPerUnit ?? null,
      hsnCode: input.hsnCode?.trim() || null,
      comments: input.comments?.trim() || null,
      imageUrl: input.imageUrl?.trim() || null,
    } as any,
  });

  if (input.articleCodeUnits?.length) {
    await syncArticleCodes(master.id, input.articleCodeUnits);
  }

  logAction(session.user!.id!, session.user!.name!, "CREATE", "AccessoryMaster", master.id);
  revalidateAccessoryPaths();
  return master;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function updateAccessoryMaster(id: string, data: any) {
  const session = await requirePermission("inventory:accessories:edit");
  const previous = await db.accessoryMaster.findUnique({ where: { id } });
  if (!previous) throw new Error("Accessory not found");

  // Extract articleCodeUnits before passing to Prisma (no longer a DB column).
  const articleCodeUnits: ArticleCodeUnit[] | undefined = data.articleCodeUnits;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { articleCodeUnits: _acu, ...updateData } = data;

  const nextDisplayName = updateData.name?.trim() || previous.displayName;
  delete updateData.name;

  const master = await db.accessoryMaster.update({
    where: { id },
    data: {
      ...updateData,
      displayName: nextDisplayName,
    },
  });

  // Sync article codes into ProductMasterAccessory when provided.
  if (articleCodeUnits !== undefined) {
    await syncArticleCodes(id, articleCodeUnits);
  }

  const action = updateData.isStrikedThrough !== undefined ? "ARCHIVE" : "UPDATE";
  const changes = computeDiff(
    previous as unknown as Record<string, unknown>,
    master as unknown as Record<string, unknown>,
  );
  logAction(session.user!.id!, session.user!.name!, action, "AccessoryMaster", id, changes);
  revalidateAccessoryPaths();
  return master;
}

export async function deleteAccessoryMaster(id: string) {
  const session = await requirePermission("inventory:accessories:delete");

  const master = await db.accessoryMaster.findUnique({ where: { id } });
  if (!master) throw new Error("Accessory not found");

  const [purchaseCount, dispatchCount, bomCount] = await Promise.all([
    db.accessoryPurchase.count({ where: { accessoryId: id } }),
    db.accessoryDispatch.count({ where: { accessoryId: id } }),
    db.articleAccessory.count({ where: { accessoryId: id } }),
  ]);

  if (purchaseCount > 0 || dispatchCount > 0 || bomCount > 0) {
    const refs: string[] = [];
    if (purchaseCount > 0) refs.push(`${purchaseCount} purchase${purchaseCount > 1 ? "s" : ""}`);
    if (dispatchCount > 0) refs.push(`${dispatchCount} dispatch${dispatchCount > 1 ? "es" : ""}`);
    if (bomCount > 0) refs.push(`${bomCount} BOM line${bomCount > 1 ? "s" : ""}`);
    throw new Error(`Cannot delete: this accessory is referenced by ${refs.join(", ")}.`);
  }

  await db.accessoryMaster.delete({ where: { id } });
  logAction(session.user!.id!, session.user!.name!, "DELETE", "AccessoryMaster", id);
  revalidatePath("/accessory-masters");
}

/**
 * Bulk-create one AccessoryMaster per type entry from the simplified form.
 * Shared fields (category, unit, vendorId, hsnCode) apply to every row.
 * Each entry provides its own name, cost, imageUrl, and articleCodeUnits.
 * Article codes are written into ProductMasterAccessory (the BOM join table).
 */
export async function createAccessoryMastersTyped(
  shared: {
    category: string;
    unit: AccessoryUnit;
    vendorId: string | null;
    hsnCode: string | null;
  },
  entries: Array<{
    name: string;
    defaultCostPerUnit: number | null;
    imageUrl: string | null;
    comments: string | null;
    articleCodeUnits: ArticleCodeUnit[];
  }>
) {
  const session = await requirePermission("inventory:accessories:create");
  if (!shared.category.trim()) throw new Error("Category is required");
  if (entries.length === 0) throw new Error("Add at least one type");

  const created = await db.$transaction(
    entries.map((entry) => {
      const name = entry.name.trim();
      return db.accessoryMaster.create({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: {
          displayName: name,
          category: shared.category.trim(),
          attributes: { name } as any,
          priceTiers: [] as any,
          unit: shared.unit,
          vendorId: shared.vendorId || null,
          defaultCostPerUnit: entry.defaultCostPerUnit ?? null,
          hsnCode: shared.hsnCode?.trim() || null,
          comments: entry.comments?.trim() || null,
          imageUrl: entry.imageUrl || null,
        } as any,
      });
    })
  );

  // Sync article codes for each created accessory (outside transaction — needs product lookup).
  for (let i = 0; i < created.length; i++) {
    const articleCodeUnits = entries[i].articleCodeUnits;
    if (articleCodeUnits.length > 0) {
      await syncArticleCodes(created[i].id, articleCodeUnits);
    }
  }

  for (const m of created) {
    logAction(session.user!.id!, session.user!.name!, "CREATE", "AccessoryMaster", m.id);
  }

  revalidateAccessoryPaths();
  return created;
}

/**
 * Lightweight list of article numbers for the accessory master form
 * comboboxes. Returns one row per distinct articleNumber, with a sample
 * productName so the user can recognise it in the dropdown.
 */
export async function getArticleCodes(): Promise<{ value: string; label: string }[]> {
  await requirePermission("inventory:accessories:view");
  const rows = await db.productMaster.findMany({
    where: { isStrikedThrough: false, articleNumber: { not: null } },
    select: { articleNumber: true, productName: true },
  });
  // Group by articleNumber, pick first non-empty productName as sample label.
  const byArticle = new Map<string, string | null>();
  for (const r of rows) {
    if (!r.articleNumber) continue;
    if (!byArticle.has(r.articleNumber)) {
      byArticle.set(r.articleNumber, r.productName ?? null);
    } else if (!byArticle.get(r.articleNumber) && r.productName) {
      byArticle.set(r.articleNumber, r.productName);
    }
  }
  return [...byArticle.entries()]
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    .map(([articleNumber, productName]) => ({
      value: articleNumber,
      label: productName ? `${articleNumber} — ${productName}` : articleNumber,
    }));
}

export async function getAccessoryCategories(): Promise<string[]> {
  await requirePermission("inventory:accessories:view");
  const rows = await db.accessoryMaster.findMany({
    where: { isStrikedThrough: false },
    select: { category: true },
    distinct: ["category"],
    orderBy: { category: "asc" },
  });
  return rows.map((r) => r.category);
}

export async function getAccessoryColours(): Promise<string[]> {
  await requirePermission("inventory:accessories:view");
  // Legacy API kept for components that still offer colour pickers. Reads
  // from both the legacy colour column and the new attributes.colour field.
  const rows = await db.accessoryMaster.findMany({
    where: { isStrikedThrough: false },
    select: { colour: true, attributes: true },
  });
  const set = new Set<string>();
  for (const r of rows) {
    if (r.colour) set.add(r.colour);
    const attr = r.attributes as Record<string, unknown> | null;
    if (attr && typeof attr.colour === "string" && attr.colour) set.add(attr.colour);
  }
  return [...set].sort();
}

export async function getAccessorySizes(): Promise<string[]> {
  await requirePermission("inventory:accessories:view");
  const rows = await db.accessoryMaster.findMany({
    where: { isStrikedThrough: false },
    select: { size: true, attributes: true },
  });
  const set = new Set<string>();
  for (const r of rows) {
    if (r.size) set.add(r.size);
    const attr = r.attributes as Record<string, unknown> | null;
    if (attr && typeof attr.size === "string" && attr.size) set.add(attr.size);
  }
  return [...set].sort();
}
