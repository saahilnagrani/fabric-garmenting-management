"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { Gender, ProductStatus } from "@/generated/prisma/client";

export type ProductFilters = {
  isRepeat?: boolean;
  gender?: Gender;
  status?: ProductStatus;
  vendorId?: string;
  search?: string;
};

export async function getProducts(phaseId: string, filters?: ProductFilters) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { phaseId };

  if (filters?.isRepeat !== undefined) where.isRepeat = filters.isRepeat;
  if (filters?.gender) where.gender = filters.gender;
  if (filters?.status) where.status = filters.status;
  if (filters?.vendorId) where.vendorId = filters.vendorId;
  if (filters?.search) {
    where.OR = [
      { styleNumber: { contains: filters.search, mode: "insensitive" } },
      { skuCode: { contains: filters.search, mode: "insensitive" } },
      { productName: { contains: filters.search, mode: "insensitive" } },
      { colour: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  return db.product.findMany({
    where,
    include: { vendor: true },
    orderBy: [{ styleNumber: "asc" }, { colour: "asc" }],
  });
}

export async function getProduct(id: string) {
  return db.product.findUnique({
    where: { id },
    include: { vendor: true, phase: true },
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createProduct(data: any) {
  const product = await db.product.create({ data });
  revalidatePath("/products");
  return product;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function updateProduct(id: string, data: any) {
  const product = await db.product.update({ where: { id }, data });
  revalidatePath("/products");
  revalidatePath(`/products/${id}`);
  return product;
}

export async function deleteProduct(id: string) {
  await db.product.delete({ where: { id } });
  revalidatePath("/products");
}

export async function bulkUpdateProductStatus(
  ids: string[],
  status: ProductStatus
) {
  await db.product.updateMany({
    where: { id: { in: ids } },
    data: { status },
  });
  revalidatePath("/products");
}
