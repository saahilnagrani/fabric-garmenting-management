"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function getFabricMasters(includeArchived = false) {
  return db.fabricMaster.findMany({
    where: includeArchived ? {} : { isStrikedThrough: false },
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

export async function getFabricNames(): Promise<string[]> {
  const fabrics = await db.fabricMaster.findMany({
    where: { isStrikedThrough: false },
    select: { fabricName: true },
    orderBy: { fabricName: "asc" },
    distinct: ["fabricName"],
  });
  return fabrics.map((f) => f.fabricName);
}

export async function getFabricNamesMrp(): Promise<{ name: string; mrp: number | null }[]> {
  const fabrics = await db.fabricMaster.findMany({
    where: { isStrikedThrough: false },
    select: { fabricName: true, mrp: true },
    orderBy: { fabricName: "asc" },
  });
  // Deduplicate by name, keeping the first MRP found
  const seen = new Map<string, number | null>();
  for (const f of fabrics) {
    if (!seen.has(f.fabricName)) {
      seen.set(f.fabricName, f.mrp ? Number(f.mrp) : null);
    }
  }
  return Array.from(seen.entries()).map(([name, mrp]) => ({ name, mrp }));
}

export async function deleteFabricMaster(id: string) {
  await db.fabricMaster.delete({ where: { id } });
  revalidatePath("/fabric-masters");
}
