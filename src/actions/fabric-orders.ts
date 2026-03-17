"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function getFabricOrders(phaseId: string, filters?: { vendorId?: string; isRepeat?: boolean }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { phaseId };
  if (filters?.vendorId) where.vendorId = filters.vendorId;
  if (filters?.isRepeat !== undefined) where.isRepeat = filters.isRepeat;

  return db.fabricOrder.findMany({
    where,
    include: { vendor: true },
    orderBy: [{ isStrikedThrough: "asc" }, { createdAt: "desc" }],
  });
}

export async function getFabricOrder(id: string) {
  return db.fabricOrder.findUnique({
    where: { id },
    include: { vendor: true, phase: true },
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createFabricOrder(data: any) {
  const order = await db.fabricOrder.create({ data });
  revalidatePath("/fabric-orders");
  return order;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function updateFabricOrder(id: string, data: any) {
  const order = await db.fabricOrder.update({ where: { id }, data });
  revalidatePath("/fabric-orders");
  revalidatePath(`/fabric-orders/${id}`);
  return order;
}

export async function deleteFabricOrder(id: string) {
  await db.fabricOrder.delete({ where: { id } });
  revalidatePath("/fabric-orders");
}
