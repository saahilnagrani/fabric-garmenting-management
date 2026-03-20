"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function getProductMasters(includeArchived = false) {
  return db.productMaster.findMany({
    where: includeArchived ? {} : { isStrikedThrough: false },
    orderBy: { skuCode: "asc" },
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createProductMaster(data: any) {
  const master = await db.productMaster.create({ data });
  revalidatePath("/product-masters");
  return master;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function updateProductMaster(id: string, data: any) {
  const master = await db.productMaster.update({ where: { id }, data });
  revalidatePath("/product-masters");
  return master;
}

export async function deleteProductMaster(id: string) {
  await db.productMaster.delete({ where: { id } });
  revalidatePath("/product-masters");
}
