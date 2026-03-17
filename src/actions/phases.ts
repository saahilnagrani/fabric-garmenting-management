"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function getPhases() {
  return db.phase.findMany({ orderBy: { number: "desc" } });
}

export async function getCurrentPhase() {
  return db.phase.findFirst({ where: { isCurrent: true } });
}

export async function createPhase(data: {
  name: string;
  number: number;
  startDate?: string;
}) {
  const phase = await db.phase.create({
    data: {
      name: data.name,
      number: data.number,
      startDate: data.startDate ? new Date(data.startDate) : null,
    },
  });
  revalidatePath("/phases");
  return phase;
}

export async function setCurrentPhase(id: string) {
  await db.phase.updateMany({ data: { isCurrent: false } });
  await db.phase.update({ where: { id }, data: { isCurrent: true } });
  revalidatePath("/");
}
