"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { VendorType } from "@/generated/prisma/client";

export async function getVendors() {
  return db.vendor.findMany({ orderBy: { name: "asc" } });
}

export async function createVendor(data: {
  name: string;
  type: VendorType;
  contactInfo?: string;
}) {
  const vendor = await db.vendor.create({ data });
  revalidatePath("/vendors");
  return vendor;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function updateVendor(id: string, data: any) {
  const vendor = await db.vendor.update({ where: { id }, data });
  revalidatePath("/vendors");
  return vendor;
}
