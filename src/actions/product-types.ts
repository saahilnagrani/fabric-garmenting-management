"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/require-permission";
import { logAction } from "@/lib/audit";

export async function getProductTypes() {
  await requirePermission("inventory:lists:view");
  return db.productType.findMany({
    orderBy: { name: "asc" },
  });
}

export async function createProductType(name: string, code?: string) {
  const session = await requirePermission("inventory:lists:edit");
  const productType = await db.productType.create({
    data: { name: name.trim(), code: (code || "").trim().toUpperCase() },
  });
  logAction(session.user!.id!, session.user!.name!, "CREATE", "ProductType", productType.id);
  revalidatePath("/lists/types");
  return productType;
}

export async function updateProductType(id: string, name: string, code?: string) {
  const session = await requirePermission("inventory:lists:edit");
  const data: { name: string; code?: string } = { name: name.trim() };
  if (code !== undefined) data.code = code.trim().toUpperCase();
  const productType = await db.productType.update({
    where: { id },
    data,
  });
  logAction(session.user!.id!, session.user!.name!, "UPDATE", "ProductType", id);
  revalidatePath("/lists/types");
  return productType;
}

export async function deleteProductType(id: string) {
  const session = await requirePermission("inventory:lists:edit");
  await db.productType.delete({ where: { id } });
  logAction(session.user!.id!, session.user!.name!, "DELETE", "ProductType", id);
  revalidatePath("/lists/types");
}

export async function seedProductTypes(names: string[]) {
  await requirePermission("inventory:lists:edit");
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
