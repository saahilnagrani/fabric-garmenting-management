"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { Gender, ProductStatus } from "@/generated/prisma/client";
import { syncExpenseForInvoice } from "./invoice-expense-sync";

export type ProductFilters = {
  isRepeat?: boolean;
  gender?: Gender;
  status?: ProductStatus;
  fabricVendorId?: string;
  search?: string;
};

export async function getProducts(phaseId: string, filters?: ProductFilters) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { phaseId };

  if (filters?.isRepeat !== undefined) where.isRepeat = filters.isRepeat;
  if (filters?.gender) where.gender = filters.gender;
  if (filters?.status) where.status = filters.status;
  if (filters?.fabricVendorId) where.fabricVendorId = filters.fabricVendorId;
  if (filters?.search) {
    where.OR = [
      { styleNumber: { contains: filters.search, mode: "insensitive" } },
      { skuCode: { contains: filters.search, mode: "insensitive" } },
      { productName: { contains: filters.search, mode: "insensitive" } },
      { colourOrdered: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  return db.product.findMany({
    where,
    include: { fabricVendor: true, fabric2Vendor: true },
    orderBy: [{ styleNumber: "asc" }, { colourOrdered: "asc" }],
  });
}

export async function getProduct(id: string) {
  return db.product.findUnique({
    where: { id },
    include: { fabricVendor: true, fabric2Vendor: true, phase: true },
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createProduct(data: any) {
  const product = await db.product.create({ data });
  revalidatePath("/products");

  if (product.invoiceNumber) {
    await syncExpenseForInvoice({
      invoiceNumber: product.invoiceNumber,
      previousInvoiceNumber: null,
      sourceType: "PRODUCT_ORDER",
      phaseId: product.phaseId,
    });
  }

  return product;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function updateProduct(id: string, data: any) {
  // Fetch previous state to detect invoice number changes
  const previousProduct = await db.product.findUnique({ where: { id } });

  const product = await db.product.update({ where: { id }, data });
  revalidatePath("/products");
  revalidatePath(`/products/${id}`);

  // Sync expense if invoice number exists or changed
  const hasInvoice = !!product.invoiceNumber;
  const hadInvoice = !!previousProduct?.invoiceNumber;
  const invoiceChanged = previousProduct?.invoiceNumber !== product.invoiceNumber;
  // Also re-sync if cost/qty fields may have changed (product already has an invoice)
  if (hasInvoice || hadInvoice || invoiceChanged) {
    await syncExpenseForInvoice({
      invoiceNumber: product.invoiceNumber,
      previousInvoiceNumber: invoiceChanged ? previousProduct?.invoiceNumber : null,
      sourceType: "PRODUCT_ORDER",
      phaseId: product.phaseId,
    });
  }

  return product;
}

export async function deleteProduct(id: string) {
  const product = await db.product.findUnique({ where: { id } });
  await db.product.delete({ where: { id } });
  revalidatePath("/products");

  if (product?.invoiceNumber) {
    await syncExpenseForInvoice({
      invoiceNumber: null,
      previousInvoiceNumber: product.invoiceNumber,
      sourceType: "PRODUCT_ORDER",
      phaseId: product.phaseId,
    });
  }
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
