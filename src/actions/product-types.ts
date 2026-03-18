"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function getProductTypes() {
  return db.productType.findMany({
    orderBy: { name: "asc" },
  });
}

export async function createProductType(name: string) {
  const productType = await db.productType.create({
    data: { name: name.trim() },
  });
  revalidatePath("/lists/types");
  return productType;
}

export async function updateProductType(id: string, name: string) {
  const productType = await db.productType.update({
    where: { id },
    data: { name: name.trim() },
  });
  revalidatePath("/lists/types");
  return productType;
}

export async function deleteProductType(id: string) {
  await db.productType.delete({ where: { id } });
  revalidatePath("/lists/types");
}

export async function seedProductTypes(names: string[]) {
  const existing = await db.productType.findMany();
  const existingNames = new Set(existing.map((t) => t.name));
  const toCreate = names.filter((n) => !existingNames.has(n));
  if (toCreate.length > 0) {
    await db.productType.createMany({
      data: toCreate.map((name) => ({ name })),
      skipDuplicates: true,
    });
  }
  revalidatePath("/lists/types");
}
