"use server";

import { cache } from "react";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/require-permission";
import { logAction } from "@/lib/audit";

export const getPhases = cache(async () => {
  await requirePermission("inventory:phases:view");
  return db.phase.findMany({ orderBy: { number: "desc" } });
});

export async function getCurrentPhase() {
  await requirePermission("inventory:phases:view");
  return db.phase.findFirst({ where: { isCurrent: true } });
}

export async function createPhase(data: {
  name: string;
  number: number;
  startDate?: string;
}) {
  const session = await requirePermission("inventory:phases:create");
  const phase = await db.phase.create({
    data: {
      name: data.name,
      number: data.number,
      startDate: data.startDate ? new Date(data.startDate) : null,
    },
  });
  logAction(session.user!.id!, session.user!.name!, "CREATE", "Phase", phase.id);
  revalidatePath("/phases");
  return phase;
}

export async function setCurrentPhase(id: string) {
  const session = await requirePermission("inventory:phases:edit");
  await db.phase.updateMany({ data: { isCurrent: false } });
  await db.phase.update({ where: { id }, data: { isCurrent: true } });
  logAction(session.user!.id!, session.user!.name!, "UPDATE", "Phase", id);
  revalidatePath("/products");
  revalidatePath("/fabric-orders");
  revalidatePath("/expenses");
  revalidatePath("/dashboard");
  revalidatePath("/phase-planning");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function updatePhase(id: string, data: any) {
  const session = await requirePermission("inventory:phases:edit");
  const phase = await db.phase.update({ where: { id }, data });
  logAction(session.user!.id!, session.user!.name!, "UPDATE", "Phase", id);
  revalidatePath("/phases");
  return phase;
}
