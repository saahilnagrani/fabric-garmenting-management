"use server";

import { cache } from "react";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/require-permission";
import { logAction, computeDiff } from "@/lib/audit";
import type { AccessoryUnit } from "@/generated/prisma/client";
import { composeDisplayName, type PriceTier } from "@/lib/accessory-categories";

export const getAccessoryMasters = cache(async (includeArchived = false) => {
  await requirePermission("inventory:accessories:view");
  return db.accessoryMaster.findMany({
    where: includeArchived ? {} : { isStrikedThrough: false },
    include: {
      vendor: true,
      productLinks: {
        include: {
          productMaster: { select: { id: true, skuCode: true } },
        },
      },
    },
    orderBy: [{ category: "asc" }, { displayName: "asc" }],
  });
});

export type ArticleCodeUnit = { code: string; units: number };

export type AccessoryMasterInput = {
  category: string;
  // When provided, used directly as the displayName (new simplified flow).
  name?: string;
  attributes?: Record<string, unknown>;
  unit: AccessoryUnit;
  vendorId?: string | null;
  defaultCostPerUnit?: number | null;
  priceTiers?: PriceTier[];
  hsnCode?: string | null;
  comments?: string | null;
  imageUrl?: string | null;
  articleCodeUnits?: ArticleCodeUnit[];
};

function normalizeAttributes(attrs: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === "") continue;
    out[k] = v;
  }
  return out;
}

/**
 * Sync article-code BOM entries for an accessory into ProductMasterAccessory.
 * Replaces all existing BOM links for this accessory with the new set.
 */
async function syncArticleCodes(accessoryId: string, entries: ArticleCodeUnit[]) {
  await db.productMasterAccessory.deleteMany({ where: { accessoryId } });
  if (entries.length === 0) return;

  const skuCodes = [...new Set(entries.map((e) => e.code).filter(Boolean))];
  const productMasters = await db.productMaster.findMany({
    where: { skuCode: { in: skuCodes } },
    select: { id: true, skuCode: true },
  });
  const skuToId = new Map(productMasters.map((pm) => [pm.skuCode, pm.id]));

  const rows = entries
    .filter((e) => e.code && skuToId.has(e.code) && e.units > 0)
    .map((e) => ({
      productMasterId: skuToId.get(e.code)!,
      accessoryId,
      quantityPerPiece: e.units,
    }));

  if (rows.length === 0) return;
  await db.productMasterAccessory.createMany({ data: rows, skipDuplicates: true });
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
 * Create a single AccessoryMaster from structured input. The display name is
 * composed from the category config so every row has a consistent label.
 */
export async function createAccessoryMaster(input: AccessoryMasterInput) {
  const session = await requirePermission("inventory:accessories:create");

  if (!input.category.trim()) throw new Error("Category is required");

  let displayName: string;
  let attributes: Record<string, unknown>;

  if (input.name?.trim()) {
    // Simplified flow: user-entered name is the display name.
    displayName = input.name.trim();
    attributes = { name: displayName };
  } else {
    attributes = normalizeAttributes(input.attributes ?? {});
    displayName = composeDisplayName(input.category, attributes);
    if (!displayName.trim()) throw new Error("Accessory has no identifying attributes");
  }

  const master = await db.accessoryMaster.create({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: {
      displayName,
      category: input.category.trim(),
      attributes: attributes as any,
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

/**
 * Backwards-compat wrapper: the old UI created Cartesian products of
 * (colours × sizes) under a baseName. Kept so existing callers in the sheet
 * continue to work while we migrate the UI. Each combination becomes an
 * independent AccessoryMaster row.
 */
export type CreateAccessoryMastersInput = {
  baseName: string;
  category: string;
  unit: AccessoryUnit;
  vendorId?: string | null;
  defaultCostPerUnit?: number | null;
  hsnCode?: string | null;
  comments?: string | null;
  colours: string[];
  sizes: string[];
};

export async function createAccessoryMasters(input: CreateAccessoryMastersInput) {
  const session = await requirePermission("inventory:accessories:create");

  const baseName = input.baseName.trim();
  if (!baseName) throw new Error("Base name is required");
  if (!input.category.trim()) throw new Error("Category is required");

  const colours = input.colours.length > 0 ? input.colours : [null];
  const sizes = input.sizes.length > 0 ? input.sizes : [null];

  const payloads: AccessoryMasterInput[] = [];
  for (const c of colours) {
    for (const s of sizes) {
      const attributes: Record<string, unknown> = { baseName };
      if (c) attributes.colour = c;
      if (s) attributes.size = s;
      payloads.push({
        category: input.category,
        attributes,
        unit: input.unit,
        vendorId: input.vendorId,
        defaultCostPerUnit: input.defaultCostPerUnit,
        hsnCode: input.hsnCode,
        comments: input.comments,
      });
    }
  }

  const created = await db.$transaction(
    payloads.map((p) => {
      const attributes = normalizeAttributes(p.attributes ?? {});
      const displayName = composeDisplayName(p.category, attributes);
      return db.accessoryMaster.create({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: {
          displayName,
          category: p.category.trim(),
          attributes: attributes as any,
          priceTiers: [] as any,
          unit: p.unit,
          vendorId: p.vendorId || null,
          defaultCostPerUnit: p.defaultCostPerUnit ?? null,
          hsnCode: p.hsnCode?.trim() || null,
          comments: p.comments?.trim() || null,
        } as any,
      });
    })
  );

  for (const m of created) {
    logAction(session.user!.id!, session.user!.name!, "CREATE", "AccessoryMaster", m.id);
  }

  revalidatePath("/accessory-masters");
  return created;
}

/**
 * Bulk-create multiple accessories sharing the same category, unit, vendor,
 * cost, and HSN. Each entry provides its own attribute map. Used by the
 * "Bulk Add" CSV-paste flow in the master sheet.
 */
export async function bulkCreateAccessoryMasters(
  shared: Omit<AccessoryMasterInput, "attributes">,
  rows: Array<{ attributes: Record<string, unknown> }>
) {
  const session = await requirePermission("inventory:accessories:create");
  if (!shared.category.trim()) throw new Error("Category is required");
  if (rows.length === 0) throw new Error("No rows to create");

  const created = await db.$transaction(
    rows.map((row) => {
      const attributes = normalizeAttributes(row.attributes);
      const displayName = composeDisplayName(shared.category, attributes);
      return db.accessoryMaster.create({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: {
          displayName,
          category: shared.category.trim(),
          attributes: attributes as any,
          priceTiers: (shared.priceTiers ?? []) as any,
          vendorPageRef: shared.vendorPageRef?.trim() || null,
          unit: shared.unit,
          vendorId: shared.vendorId || null,
          defaultCostPerUnit: shared.defaultCostPerUnit ?? null,
          hsnCode: shared.hsnCode?.trim() || null,
          comments: shared.comments?.trim() || null,
        } as any,
      });
    })
  );

  for (const m of created) {
    logAction(session.user!.id!, session.user!.name!, "CREATE", "AccessoryMaster", m.id);
  }

  revalidatePath("/accessory-masters");
  return created;
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

  // If a direct name is provided, use it; otherwise recompute from attributes/category.
  const nextCategory = updateData.category ?? previous.category;
  const nextAttributes =
    updateData.attributes !== undefined
      ? normalizeAttributes(updateData.attributes)
      : (previous.attributes as Record<string, unknown>);
  let nextDisplayName: string;
  let attrsToWrite: Record<string, unknown> | undefined;

  if (updateData.name?.trim()) {
    nextDisplayName = updateData.name.trim();
    attrsToWrite = { name: nextDisplayName };
    delete updateData.name;
  } else {
    const shouldRecompute = updateData.attributes !== undefined || updateData.category !== undefined;
    nextDisplayName = shouldRecompute
      ? composeDisplayName(nextCategory, nextAttributes)
      : previous.displayName;
    attrsToWrite = updateData.attributes !== undefined ? nextAttributes : undefined;
  }

  const master = await db.accessoryMaster.update({
    where: { id },
    data: {
      ...updateData,
      ...(attrsToWrite !== undefined ? { attributes: attrsToWrite } : {}),
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
    db.productMasterAccessory.count({ where: { accessoryId: id } }),
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
    comments: string | null;
  },
  entries: Array<{
    name: string;
    defaultCostPerUnit: number | null;
    imageUrl: string | null;
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
          comments: shared.comments?.trim() || null,
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

/** Lightweight list of article codes for the accessory master form comboboxes. */
export async function getArticleCodes(): Promise<{ value: string; label: string }[]> {
  await requirePermission("inventory:accessories:view");
  const rows = await db.productMaster.findMany({
    where: { isStrikedThrough: false },
    select: { skuCode: true, articleNumber: true, productName: true, styleNumber: true },
    orderBy: { skuCode: "asc" },
  });
  return rows.map((r) => {
    const parts = [r.skuCode];
    if (r.articleNumber) parts.push(r.articleNumber);
    if (r.productName) parts.push(r.productName);
    return { value: r.skuCode, label: parts.join(" — ") };
  });
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
