"use server";

import { cache } from "react";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/require-permission";
import { logAction, computeDiff } from "@/lib/audit";
import type { Gender } from "@/generated/prisma/client";
import { createLookupResolver } from "@/lib/lookups";

async function syncFabricMasterColourLinks(fabricMasterId: string, data: Record<string, unknown>) {
  if (!("coloursAvailable" in data)) return;
  const arr = (data.coloursAvailable as Array<string | null | undefined> | null | undefined) ?? [];
  const resolver = createLookupResolver();
  const ids = await resolver.colourIds(arr);
  await db.fabricMasterColour.deleteMany({ where: { fabricMasterId } });
  if (ids.length > 0) {
    await db.fabricMasterColour.createMany({
      data: ids.map((colourId) => ({ fabricMasterId, colourId })),
      skipDuplicates: true,
    });
  }
}

export const getFabricMasters = cache(async (includeArchived = false) => {
  await requirePermission("inventory:masters:view");
  return db.fabricMaster.findMany({
    where: includeArchived ? {} : { isStrikedThrough: false },
    include: { vendor: true },
    orderBy: { fabricName: "asc" },
  });
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createFabricMaster(data: any) {
  const session = await requirePermission("inventory:masters:edit");
  const master = await db.fabricMaster.create({ data });
  await syncFabricMasterColourLinks(master.id, data);
  logAction(session.user!.id!, session.user!.name!, "CREATE", "FabricMaster", master.id);
  revalidatePath("/fabric-masters");
  return master;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function updateFabricMaster(id: string, data: any) {
  const session = await requirePermission("inventory:masters:edit");
  const previous = await db.fabricMaster.findUnique({ where: { id } });
  const master = await db.fabricMaster.update({ where: { id }, data });
  await syncFabricMasterColourLinks(id, data);
  const action = data.isStrikedThrough !== undefined ? "ARCHIVE" : "UPDATE";
  const changes = previous ? computeDiff(previous as unknown as Record<string, unknown>, master as unknown as Record<string, unknown>) : undefined;
  logAction(session.user!.id!, session.user!.name!, action, "FabricMaster", id, changes);
  revalidatePath("/fabric-masters");
  return master;
}

/**
 * Toggle the manual-clean flag on a fabric. Null = not cleaned (eligible for Excel overwrite),
 * a timestamp = user has manually cleaned it and imports must skip it.
 */
export async function setFabricMasterCleaned(id: string, cleaned: boolean) {
  const session = await requirePermission("inventory:masters:edit");
  const master = await db.fabricMaster.update({
    where: { id },
    data: { manuallyCleanedAt: cleaned ? new Date() : null },
  });
  logAction(session.user!.id!, session.user!.name!, "UPDATE", "FabricMaster", id, { manuallyCleanedAt: { old: null, new: master.manuallyCleanedAt } });
  revalidatePath("/fabric-masters");
  return JSON.parse(JSON.stringify(master));
}

export async function getFabricNames(): Promise<string[]> {
  await requirePermission("inventory:masters:view");
  const fabrics = await db.fabricMaster.findMany({
    where: { isStrikedThrough: false },
    select: { fabricName: true },
    orderBy: { fabricName: "asc" },
    distinct: ["fabricName"],
  });
  return fabrics.map((f) => f.fabricName);
}

export async function getFabricNamesMrp(): Promise<{ name: string; mrp: number | null }[]> {
  await requirePermission("inventory:masters:view");
  const fabrics = await db.fabricMaster.findMany({
    where: { isStrikedThrough: false },
    select: { fabricName: true, mrp: true },
    orderBy: { fabricName: "asc" },
  });
  // Deduplicate by name, keeping the first MRP found
  const seen = new Map<string, number | null>();
  for (const f of fabrics) {
    if (!seen.has(f.fabricName)) {
      seen.set(f.fabricName, f.mrp ? Number(f.mrp) : null);
    }
  }
  return Array.from(seen.entries()).map(([name, mrp]) => ({ name, mrp }));
}

export async function getStyleNumbersByGenders(genders: string[]): Promise<string[]> {
  await requirePermission("inventory:masters:view");
  if (genders.length === 0) return [];
  const products = await db.productMaster.findMany({
    where: { gender: { in: genders as Gender[] }, isStrikedThrough: false },
    select: { styleNumber: true },
    distinct: ["styleNumber"],
    orderBy: { styleNumber: "asc" },
  });
  return products.map((p) => p.styleNumber);
}

export async function getFabricMasterColours(fabricName: string): Promise<string[]> {
  await requirePermission("inventory:masters:view");
  const master = await db.fabricMaster.findFirst({
    where: { fabricName, isStrikedThrough: false },
    select: { coloursAvailable: true },
  });
  return master?.coloursAvailable ?? [];
}

export async function deleteFabricMaster(id: string) {
  const session = await requirePermission("inventory:masters:edit");

  // Check for references before deleting
  const fabric = await db.fabricMaster.findUnique({ where: { id }, select: { fabricName: true } });
  if (!fabric) throw new Error("Fabric not found");

  const [orderCount, productCount] = await Promise.all([
    db.fabricOrder.count({ where: { fabricName: fabric.fabricName } }),
    db.productMaster.count({ where: { fabricName: fabric.fabricName } }),
  ]);

  if (orderCount > 0 || productCount > 0) {
    const refs: string[] = [];
    if (orderCount > 0) refs.push(`${orderCount} fabric order${orderCount > 1 ? "s" : ""}`);
    if (productCount > 0) refs.push(`${productCount} style${productCount > 1 ? "s" : ""}`);
    throw new Error(`Cannot delete: this fabric is used by ${refs.join(" and ")}.`);
  }

  await db.fabricMaster.delete({ where: { id } });
  logAction(session.user!.id!, session.user!.name!, "DELETE", "FabricMaster", id);
  revalidatePath("/fabric-masters");
}
