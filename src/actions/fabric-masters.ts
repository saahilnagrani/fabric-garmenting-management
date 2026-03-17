"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function getFabricMasters() {
  return db.fabricMaster.findMany({
    include: { vendor: true },
    orderBy: { fabricName: "asc" },
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createFabricMaster(data: any) {
  const master = await db.fabricMaster.create({ data });
  revalidatePath("/fabric-masters");
  return master;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function updateFabricMaster(id: string, data: any) {
  const master = await db.fabricMaster.update({ where: { id }, data });
  revalidatePath("/fabric-masters");
  return master;
}

export async function deleteFabricMaster(id: string) {
  await db.fabricMaster.delete({ where: { id } });
  revalidatePath("/fabric-masters");
}
