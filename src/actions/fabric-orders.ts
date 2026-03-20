"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { syncExpenseForInvoice } from "./invoice-expense-sync";

export async function getFabricOrders(phaseId: string, filters?: { fabricVendorId?: string; isRepeat?: boolean }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { phaseId };
  if (filters?.fabricVendorId) where.fabricVendorId = filters.fabricVendorId;
  if (filters?.isRepeat !== undefined) where.isRepeat = filters.isRepeat;

  return db.fabricOrder.findMany({
    where,
    include: { fabricVendor: true },
    orderBy: [{ createdAt: "desc" }],
  });
}

export async function getFabricOrder(id: string) {
  return db.fabricOrder.findUnique({
    where: { id },
    include: { fabricVendor: true, phase: true },
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createFabricOrder(data: any) {
  const order = await db.fabricOrder.create({ data });
  revalidatePath("/fabric-orders");

  if (order.invoiceNumber) {
    await syncExpenseForInvoice({
      invoiceNumber: order.invoiceNumber,
      previousInvoiceNumber: null,
      sourceType: "FABRIC_ORDER",
      phaseId: order.phaseId,
      vendorId: order.fabricVendorId,
    });
  }

  return order;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function updateFabricOrder(id: string, data: any) {
  // Fetch previous state to detect invoice number changes
  const previousOrder = await db.fabricOrder.findUnique({ where: { id } });

  const order = await db.fabricOrder.update({ where: { id }, data });
  revalidatePath("/fabric-orders");
  revalidatePath(`/fabric-orders/${id}`);

  // Sync expense if invoice number exists or changed
  const hasInvoice = !!order.invoiceNumber;
  const hadInvoice = !!previousOrder?.invoiceNumber;
  const invoiceChanged = previousOrder?.invoiceNumber !== order.invoiceNumber;
  // Also re-sync if cost/qty fields may have changed (order already has an invoice)
  if (hasInvoice || hadInvoice || invoiceChanged) {
    await syncExpenseForInvoice({
      invoiceNumber: order.invoiceNumber,
      previousInvoiceNumber: invoiceChanged ? previousOrder?.invoiceNumber : null,
      sourceType: "FABRIC_ORDER",
      phaseId: order.phaseId,
      vendorId: order.fabricVendorId,
    });
  }

  return order;
}

export async function deleteFabricOrder(id: string) {
  const order = await db.fabricOrder.findUnique({ where: { id } });
  await db.fabricOrder.delete({ where: { id } });
  revalidatePath("/fabric-orders");

  if (order?.invoiceNumber) {
    await syncExpenseForInvoice({
      invoiceNumber: null,
      previousInvoiceNumber: order.invoiceNumber,
      sourceType: "FABRIC_ORDER",
      phaseId: order.phaseId,
      vendorId: order.fabricVendorId,
    });
  }
}
