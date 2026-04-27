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
  if (!previous) throw new Error("Vendor not found");

  const oldName = previous.name;
  const newName = typeof data.name === "string" ? data.name.trim() : oldName;
  const renamed = oldName !== newName;
  // Garmenter renames need to fan out to every consumer that stores the
  // garmenter as a name string. The matching GarmentingLocation row (paired
  // by name) is also renamed so its FK consumers stay consistent — see
  // updateGarmentingLocation for the same fan-out from the other side.
  const isGarmenter = previous.type === "GARMENTING";

  const vendor = await db.$transaction(async (tx) => {
    const updated = await tx.vendor.update({ where: { id }, data });
    if (renamed && isGarmenter) {
      await tx.product.updateMany({ where: { garmentingAt: oldName }, data: { garmentingAt: newName } });
      await tx.productMaster.updateMany({ where: { garmentingAt: oldName }, data: { garmentingAt: newName } });
      await tx.fabricOrder.updateMany({ where: { garmentingAt: oldName }, data: { garmentingAt: newName } });
      await tx.accessoryDispatch.updateMany({ where: { destinationGarmenter: oldName }, data: { destinationGarmenter: newName } });
      await tx.fabricBalance.updateMany({ where: { garmentingLocation: oldName }, data: { garmentingLocation: newName } });
      await tx.garmentingLocation.updateMany({ where: { name: oldName }, data: { name: newName } });
    }
    return updated;
  }, { timeout: 30_000, maxWait: 10_000 });

  const changes = previous ? computeDiff(previous as unknown as Record<string, unknown>, vendor as unknown as Record<string, unknown>) : undefined;
  logAction(session.user!.id!, session.user!.name!, "UPDATE", "Vendor", id, changes);
  revalidatePath("/vendors");
  if (renamed && isGarmenter) {
    revalidatePath("/", "layout");
  }
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
