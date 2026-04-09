"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/require-permission";
import { logAction } from "@/lib/audit";

export async function getColours() {
  await requirePermission("inventory:lists:view");
  return db.colour.findMany({
    orderBy: { name: "asc" },
  });
}

export async function createColour(name: string, code: string) {
  const session = await requirePermission("inventory:lists:edit");
  const colour = await db.colour.create({
    data: { name: name.trim(), code: code.trim().toUpperCase() },
  });
  logAction(session.user!.id!, session.user!.name!, "CREATE", "Colour", colour.id);
  revalidatePath("/lists/colours");
  return colour;
}

export async function updateColour(id: string, name: string, code: string) {
  const session = await requirePermission("inventory:lists:edit");
  const colour = await db.colour.update({
    where: { id },
    data: { name: name.trim(), code: code.trim().toUpperCase() },
  });
  logAction(session.user!.id!, session.user!.name!, "UPDATE", "Colour", id);
  revalidatePath("/lists/colours");
  return colour;
}

export async function deleteColour(id: string) {
  const session = await requirePermission("inventory:lists:edit");
  await db.colour.delete({ where: { id } });
  logAction(session.user!.id!, session.user!.name!, "DELETE", "Colour", id);
  revalidatePath("/lists/colours");
}
