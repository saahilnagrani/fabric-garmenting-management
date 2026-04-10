"use server";

import { cache } from "react";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/require-permission";
import { logAction, computeDiff } from "@/lib/audit";
import type { AccessoryUnit } from "@/generated/prisma/client";

export const getAccessoryMasters = cache(async (includeArchived = false) => {
  await requirePermission("inventory:accessories:view");
  return db.accessoryMaster.findMany({
    where: includeArchived ? {} : { isStrikedThrough: false },
    include: { vendor: true },
    orderBy: [{ category: "asc" }, { baseName: "asc" }, { colour: "asc" }, { size: "asc" }],
  });
});

export type CreateAccessoryMastersInput = {
  baseName: string;
  category: string;
  unit: AccessoryUnit;
  vendorId?: string | null;
  defaultCostPerUnit?: number | null;
  hsnCode?: string | null;
  comments?: string | null;
  colours: string[]; // empty → single null variant
  sizes: string[]; // empty → single null variant
};

/**
 * Create one or many accessory master rows from a Cartesian product of
 * (colours × sizes). Empty colour/size arrays produce a single row with that
 * axis null. Runs in a transaction so partial failures roll back.
 */
export async function createAccessoryMasters(input: CreateAccessoryMastersInput) {
  const session = await requirePermission("inventory:accessories:create");

  const baseName = input.baseName.trim();
  if (!baseName) throw new Error("Base name is required");
  if (!input.category.trim()) throw new Error("Category is required");

  const colours = input.colours.length > 0 ? input.colours : [null];
  const sizes = input.sizes.length > 0 ? input.sizes : [null];

  const rows = [] as Array<{
    baseName: string;
    colour: string | null;
    size: string | null;
    category: string;
    unit: AccessoryUnit;
    vendorId: string | null;
    defaultCostPerUnit: number | null;
    hsnCode: string | null;
    comments: string | null;
  }>;
  for (const c of colours) {
    for (const s of sizes) {
      rows.push({
        baseName,
        colour: c,
        size: s,
        category: input.category.trim(),
        unit: input.unit,
        vendorId: input.vendorId || null,
        defaultCostPerUnit: input.defaultCostPerUnit ?? null,
        hsnCode: input.hsnCode?.trim() || null,
        comments: input.comments?.trim() || null,
      });
    }
  }

  const created = await db.$transaction(
    rows.map((data) => db.accessoryMaster.create({ data }))
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
  const master = await db.accessoryMaster.update({ where: { id }, data });
  const action = data.isStrikedThrough !== undefined ? "ARCHIVE" : "UPDATE";
  const changes = previous
    ? computeDiff(previous as unknown as Record<string, unknown>, master as unknown as Record<string, unknown>)
    : undefined;
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
  const rows = await db.accessoryMaster.findMany({
    where: { isStrikedThrough: false, colour: { not: null } },
    select: { colour: true },
    distinct: ["colour"],
    orderBy: { colour: "asc" },
  });
  return rows.map((r) => r.colour as string);
}

export async function getAccessorySizes(): Promise<string[]> {
  await requirePermission("inventory:accessories:view");
  const rows = await db.accessoryMaster.findMany({
    where: { isStrikedThrough: false, size: { not: null } },
    select: { size: true },
    distinct: ["size"],
    orderBy: { size: "asc" },
  });
  return rows.map((r) => r.size as string);
}

