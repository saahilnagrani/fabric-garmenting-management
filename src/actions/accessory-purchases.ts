"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/require-permission";
import { logAction, computeDiff } from "@/lib/audit";

export async function getAccessoryPurchases(phaseId: string) {
  await requirePermission("inventory:accessories:view");
  return db.accessoryPurchase.findMany({
    where: { phaseId },
    include: { accessory: true, vendor: true },
    orderBy: [{ purchaseDate: "desc" }, { createdAt: "desc" }],
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createAccessoryPurchase(data: any) {
  const session = await requirePermission("inventory:accessories:create");
  const row = await db.accessoryPurchase.create({ data });
  logAction(session.user!.id!, session.user!.name!, "CREATE", "AccessoryPurchase", row.id);
  revalidatePath("/accessory-purchases");
  revalidatePath("/accessory-balance");
  return row;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function updateAccessoryPurchase(id: string, data: any) {
  const session = await requirePermission("inventory:accessories:edit");
  const previous = await db.accessoryPurchase.findUnique({ where: { id } });
  const row = await db.accessoryPurchase.update({ where: { id }, data });
  const changes = previous
    ? computeDiff(previous as unknown as Record<string, unknown>, row as unknown as Record<string, unknown>)
    : undefined;
  logAction(session.user!.id!, session.user!.name!, "UPDATE", "AccessoryPurchase", id, changes);
  revalidatePath("/accessory-purchases");
  revalidatePath("/accessory-balance");
  return row;
}

export async function deleteAccessoryPurchase(id: string) {
  const session = await requirePermission("inventory:accessories:delete");
  await db.accessoryPurchase.delete({ where: { id } });
  logAction(session.user!.id!, session.user!.name!, "DELETE", "AccessoryPurchase", id);
  revalidatePath("/accessory-purchases");
  revalidatePath("/accessory-balance");
}
