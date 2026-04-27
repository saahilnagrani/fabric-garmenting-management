"use server";

import { cache } from "react";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/require-permission";
import { logAction } from "@/lib/audit";

export const getGarmentingLocations = cache(async () => {
  await requirePermission("inventory:lists:view");
  return db.garmentingLocation.findMany({
    orderBy: { name: "asc" },
  });
});

export async function createGarmentingLocation(name: string) {
  const session = await requirePermission("inventory:lists:edit");
  const location = await db.garmentingLocation.create({
    data: { name: name.trim() },
  });
  logAction(session.user!.id!, session.user!.name!, "CREATE", "GarmentingLocation", location.id);
  revalidatePath("/lists/garmenting-locations");
  return location;
}

export async function updateGarmentingLocation(id: string, name: string) {
  const session = await requirePermission("inventory:lists:edit");
  const newName = name.trim();

  const existing = await db.garmentingLocation.findUnique({ where: { id } });
  if (!existing) throw new Error("Garmenting location not found");
  const oldName = existing.name;
  const renamed = oldName !== newName;

  const location = await db.$transaction(async (tx) => {
    const updated = await tx.garmentingLocation.update({
      where: { id },
      data: { name: newName },
    });
    if (renamed) {
      await tx.product.updateMany({ where: { garmentingAt: oldName }, data: { garmentingAt: newName } });
      await tx.productMaster.updateMany({ where: { garmentingAt: oldName }, data: { garmentingAt: newName } });
      await tx.fabricOrder.updateMany({ where: { garmentingAt: oldName }, data: { garmentingAt: newName } });
      await tx.accessoryDispatch.updateMany({ where: { destinationGarmenter: oldName }, data: { destinationGarmenter: newName } });
      await tx.fabricBalance.updateMany({ where: { garmentingLocation: oldName }, data: { garmentingLocation: newName } });
    }
    return updated;
  }, { timeout: 30_000, maxWait: 10_000 });

  logAction(session.user!.id!, session.user!.name!, "UPDATE", "GarmentingLocation", id);
  revalidatePath("/lists/garmenting-locations");
  if (renamed) {
    revalidatePath("/", "layout");
  }
  return location;
}

export async function deleteGarmentingLocation(id: string) {
  const session = await requirePermission("inventory:lists:edit");
  await db.garmentingLocation.delete({ where: { id } });
  logAction(session.user!.id!, session.user!.name!, "DELETE", "GarmentingLocation", id);
  revalidatePath("/lists/garmenting-locations");
}

export async function seedGarmentingLocations(names: string[]) {
  await requirePermission("inventory:lists:edit");
  const existing = await db.garmentingLocation.findMany();
  const existingNames = new Set(existing.map((t) => t.name));
  const toCreate = names.filter((n) => !existingNames.has(n));
  if (toCreate.length > 0) {
    await db.garmentingLocation.createMany({
      data: toCreate.map((name) => ({ name })),
      skipDuplicates: true,
    });
  }
  revalidatePath("/lists/garmenting-locations");
}
