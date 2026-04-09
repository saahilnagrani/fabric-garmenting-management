"use server";

import { cache } from "react";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { VendorType } from "@/generated/prisma/client";
import { requirePermission } from "@/lib/require-permission";
import { logAction, computeDiff } from "@/lib/audit";

export const getVendors = cache(async () => {
  await requirePermission("inventory:vendors:view");
  return db.vendor.findMany({ orderBy: { name: "asc" } });
});

export async function createVendor(data: {
  name: string;
  type: VendorType;
  contactInfo?: string;
  address?: string;
}) {
  const session = await requirePermission("inventory:vendors:create");
  const vendor = await db.vendor.create({ data });
  logAction(session.user!.id!, session.user!.name!, "CREATE", "Vendor", vendor.id);
  revalidatePath("/vendors");
  return vendor;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function updateVendor(id: string, data: any) {
  const session = await requirePermission("inventory:vendors:edit");
  const previous = await db.vendor.findUnique({ where: { id } });
  const vendor = await db.vendor.update({ where: { id }, data });
  const changes = previous ? computeDiff(previous as unknown as Record<string, unknown>, vendor as unknown as Record<string, unknown>) : undefined;
  logAction(session.user!.id!, session.user!.name!, "UPDATE", "Vendor", id, changes);
  revalidatePath("/vendors");
  return vendor;
}

export async function deleteVendor(id: string) {
  const session = await requirePermission("inventory:vendors:edit");

  const [orderCount, masterCount] = await Promise.all([
    db.fabricOrder.count({ where: { fabricVendorId: id } }),
    db.fabricMaster.count({ where: { vendorId: id } }),
  ]);

  if (orderCount > 0 || masterCount > 0) {
    const refs: string[] = [];
    if (orderCount > 0) refs.push(`${orderCount} fabric order${orderCount > 1 ? "s" : ""}`);
    if (masterCount > 0) refs.push(`${masterCount} fabric master${masterCount > 1 ? "s" : ""}`);
    throw new Error(`Cannot delete: this vendor is used by ${refs.join(" and ")}.`);
  }

  await db.vendor.delete({ where: { id } });
  logAction(session.user!.id!, session.user!.name!, "DELETE", "Vendor", id);
  revalidatePath("/vendors");
}
