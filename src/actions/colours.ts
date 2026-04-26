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
  const newName = name.trim();
  const newCode = code.trim().toUpperCase();

  const existing = await db.colour.findUnique({ where: { id } });
  if (!existing) throw new Error("Colour not found");
  const oldName = existing.name;
  const renamed = oldName !== newName;

  const colour = await db.$transaction(async (tx) => {
    const updated = await tx.colour.update({
      where: { id },
      data: { name: newName, code: newCode },
    });

    if (renamed) {
      await tx.fabricOrder.updateMany({ where: { colour: oldName }, data: { colour: newName } });
      await tx.fabricOrder.updateMany({ where: { availableColour: oldName }, data: { availableColour: newName } });
      await tx.fabricBalance.updateMany({ where: { colour: oldName }, data: { colour: newName } });
      await tx.product.updateMany({ where: { colourOrdered: oldName }, data: { colourOrdered: newName } });
      await tx.accessoryMaster.updateMany({ where: { colour: oldName }, data: { colour: newName } });

      // Postgres array columns can't be updated via Prisma updateMany — use array_replace.
      await tx.$executeRaw`UPDATE "FabricMaster"  SET "coloursAvailable"  = array_replace("coloursAvailable",  ${oldName}, ${newName}) WHERE ${oldName} = ANY("coloursAvailable")`;
      await tx.$executeRaw`UPDATE "ProductMaster" SET "coloursAvailable"  = array_replace("coloursAvailable",  ${oldName}, ${newName}) WHERE ${oldName} = ANY("coloursAvailable")`;
      await tx.$executeRaw`UPDATE "ProductMaster" SET "colours2Available" = array_replace("colours2Available", ${oldName}, ${newName}) WHERE ${oldName} = ANY("colours2Available")`;
      await tx.$executeRaw`UPDATE "ProductMaster" SET "colours3Available" = array_replace("colours3Available", ${oldName}, ${newName}) WHERE ${oldName} = ANY("colours3Available")`;
      await tx.$executeRaw`UPDATE "ProductMaster" SET "colours4Available" = array_replace("colours4Available", ${oldName}, ${newName}) WHERE ${oldName} = ANY("colours4Available")`;
    }

    return updated;
  }, { timeout: 30_000, maxWait: 10_000 });

  logAction(session.user!.id!, session.user!.name!, "UPDATE", "Colour", id);
  revalidatePath("/lists/colours");
  if (renamed) {
    revalidatePath("/", "layout");
  }
  return colour;
}

export async function deleteColour(id: string) {
  const session = await requirePermission("inventory:lists:edit");
  await db.colour.delete({ where: { id } });
  logAction(session.user!.id!, session.user!.name!, "DELETE", "Colour", id);
  revalidatePath("/lists/colours");
}
