"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function getGarmentingLocations() {
  return db.garmentingLocation.findMany({
    orderBy: { name: "asc" },
  });
}

export async function createGarmentingLocation(name: string) {
  const location = await db.garmentingLocation.create({
    data: { name: name.trim() },
  });
  revalidatePath("/lists/garmenting-locations");
  return location;
}

export async function updateGarmentingLocation(id: string, name: string) {
  const location = await db.garmentingLocation.update({
    where: { id },
    data: { name: name.trim() },
  });
  revalidatePath("/lists/garmenting-locations");
  return location;
}

export async function deleteGarmentingLocation(id: string) {
  await db.garmentingLocation.delete({ where: { id } });
  revalidatePath("/lists/garmenting-locations");
}

export async function seedGarmentingLocations(names: string[]) {
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
