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
    include: { vendor: true },
    orderBy: [{ category: "asc" }, { displayName: "asc" }],
  });
});

export type AccessoryMasterInput = {
  category: string;
  attributes: Record<string, unknown>;
  unit: AccessoryUnit;
  vendorId?: string | null;
  vendorPageRef?: string | null;
  defaultCostPerUnit?: number | null;
  priceTiers?: PriceTier[];
  hsnCode?: string | null;
  comments?: string | null;
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
 * Create a single AccessoryMaster from structured input. The display name is
 * composed from the category config so every row has a consistent label.
 */
export async function createAccessoryMaster(input: AccessoryMasterInput) {
  const session = await requirePermission("inventory:accessories:create");

  if (!input.category.trim()) throw new Error("Category is required");

  const attributes = normalizeAttributes(input.attributes);
  const displayName = composeDisplayName(input.category, attributes);
  if (!displayName.trim()) throw new Error("Accessory has no identifying attributes");

  const master = await db.accessoryMaster.create({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: {
      displayName,
      category: input.category.trim(),
      attributes: attributes as any,
      priceTiers: (input.priceTiers ?? []) as any,
      vendorPageRef: input.vendorPageRef?.trim() || null,
      unit: input.unit,
      vendorId: input.vendorId || null,
      defaultCostPerUnit: input.defaultCostPerUnit ?? null,
      hsnCode: input.hsnCode?.trim() || null,
      comments: input.comments?.trim() || null,
    } as any,
  });

  logAction(session.user!.id!, session.user!.name!, "CREATE", "AccessoryMaster", master.id);
  revalidatePath("/accessory-masters");
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
      const attributes = normalizeAttributes(p.attributes);
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

  // If attributes or category changed, recompute displayName.
  const nextCategory = data.category ?? previous.category;
  const nextAttributes =
    data.attributes !== undefined
      ? normalizeAttributes(data.attributes)
      : (previous.attributes as Record<string, unknown>);
  const shouldRecompute =
    data.attributes !== undefined || data.category !== undefined;
  const nextDisplayName = shouldRecompute
    ? composeDisplayName(nextCategory, nextAttributes)
    : previous.displayName;

  const master = await db.accessoryMaster.update({
    where: { id },
    data: {
      ...data,
      ...(data.attributes !== undefined ? { attributes: nextAttributes } : {}),
      ...(shouldRecompute ? { displayName: nextDisplayName } : {}),
    },
  });

  const action = data.isStrikedThrough !== undefined ? "ARCHIVE" : "UPDATE";
  const changes = computeDiff(
    previous as unknown as Record<string, unknown>,
    master as unknown as Record<string, unknown>,
  );
  logAction(session.user!.id!, session.user!.name!, action, "AccessoryMaster", id, changes);
  revalidatePath("/accessory-masters");
  revalidatePath("/accessory-purchases");
  revalidatePath("/accessory-dispatches");
  revalidatePath("/accessory-balance");
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
