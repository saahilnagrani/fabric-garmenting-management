"use server";

import { cache } from "react";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/require-permission";

export const getSizeDistributions = cache(async () => {
  await requirePermission("inventory:lists:view");
  return db.sizeDistribution.findMany({
    orderBy: { sortOrder: "asc" },
  });
});

export async function updateSizeDistribution(id: string, percentage: number) {
  await requirePermission("inventory:lists:edit");
  const updated = await db.sizeDistribution.update({
    where: { id },
    data: { percentage },
  });
  revalidatePath("/lists/size-distribution");
  return updated;
}

export async function updateAllSizeDistributions(
  items: { id: string; percentage: number }[]
) {
  await requirePermission("inventory:lists:edit");
  await db.$transaction(
    items.map((item) =>
      db.sizeDistribution.update({
        where: { id: item.id },
        data: { percentage: item.percentage },
      })
    )
  );
  revalidatePath("/lists/size-distribution");
}

export async function seedSizeDistributions() {
  await requirePermission("inventory:lists:edit");
  const count = await db.sizeDistribution.count();
  if (count > 0) return;

  const defaults = [
    { size: "XS", percentage: 8, sortOrder: 1 },
    { size: "S", percentage: 13, sortOrder: 2 },
    { size: "M", percentage: 22, sortOrder: 3 },
    { size: "L", percentage: 27, sortOrder: 4 },
    { size: "XL", percentage: 20, sortOrder: 5 },
    { size: "XXL", percentage: 10, sortOrder: 6 },
  ];

  await db.sizeDistribution.createMany({
    data: defaults,
    skipDuplicates: true,
  });
}
