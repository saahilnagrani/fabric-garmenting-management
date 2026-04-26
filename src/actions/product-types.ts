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
  const newName = name.trim();
  const data: { name: string; code?: string } = { name: newName };
  if (code !== undefined) data.code = code.trim().toUpperCase();

  const existing = await db.productType.findUnique({ where: { id } });
  if (!existing) throw new Error("Product type not found");
  const oldName = existing.name;
  const renamed = oldName !== newName;

  const productType = await db.$transaction(async (tx) => {
    const updated = await tx.productType.update({ where: { id }, data });
    if (renamed) {
      await tx.product.updateMany({ where: { type: oldName }, data: { type: newName } });
      await tx.productMaster.updateMany({ where: { type: oldName }, data: { type: newName } });
    }
    return updated;
  }, { timeout: 30_000, maxWait: 10_000 });

  logAction(session.user!.id!, session.user!.name!, "UPDATE", "ProductType", id);
  revalidatePath("/lists/types");
  if (renamed) {
    revalidatePath("/", "layout");
  }
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
