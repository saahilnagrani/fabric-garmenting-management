"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/require-permission";
import { logAction } from "@/lib/audit";

export async function getColours() {
  await requirePermission("inventory:lists:view");
  const [
    colours,
    articleRows,
    productRows,
    productMasterRows,
    fabricMasterRows,
    productLinkRows,
    foColourRows,
    foAvailRows,
    fabricBalanceRows,
    accessoryRows,
  ] = await Promise.all([
    db.colour.findMany({ orderBy: { name: "asc" } }),
    // Article numbers using this colour (name-based, slash-split for multi-colour).
    db.$queryRaw<Array<{ colour: string; count: bigint }>>`
      SELECT TRIM(part) AS colour, COUNT(*)::bigint AS count
      FROM "Product",
           unnest(string_to_array("colourOrdered", '/')) AS part
      WHERE "articleNumber" IS NOT NULL
      GROUP BY TRIM(part)
    `,
    db.product.groupBy({ by: ["colourOrderedId"], _count: { _all: true } }),
    db.productMasterColour.groupBy({ by: ["colourId"], _count: { _all: true } }),
    db.fabricMasterColour.groupBy({ by: ["colourId"], _count: { _all: true } }),
    db.productColour.groupBy({ by: ["colourId"], _count: { _all: true } }),
    db.fabricOrder.groupBy({ by: ["colourId"], _count: { _all: true } }),
    db.fabricOrder.groupBy({ by: ["availableColourId"], _count: { _all: true } }),
    db.fabricBalance.groupBy({ by: ["colourId"], _count: { _all: true } }),
    db.accessoryMaster.groupBy({ by: ["colourId"], _count: { _all: true } }),
  ]);

  const articleCounts = new Map(articleRows.map((r) => [r.colour, Number(r.count)]));
  const toIdMap = <T extends { _count: { _all: number } }>(rows: T[], key: keyof T) =>
    new Map(rows.map((r) => [r[key] as string | null, r._count._all]));

  const productMap = toIdMap(productRows, "colourOrderedId");
  const productMasterMap = toIdMap(productMasterRows, "colourId");
  const fabricMasterMap = toIdMap(fabricMasterRows, "colourId");
  const productLinkMap = toIdMap(productLinkRows, "colourId");
  const foColourMap = toIdMap(foColourRows, "colourId");
  const foAvailMap = toIdMap(foAvailRows, "availableColourId");
  const fabricBalanceMap = toIdMap(fabricBalanceRows, "colourId");
  const accessoryMap = toIdMap(accessoryRows, "colourId");

  return colours.map((c) => ({
    ...c,
    articleCount: articleCounts.get(c.name) ?? 0,
    productCount: productMap.get(c.id) ?? 0,
    productMasterCount: productMasterMap.get(c.id) ?? 0,
    fabricMasterCount: fabricMasterMap.get(c.id) ?? 0,
    productLinkCount: productLinkMap.get(c.id) ?? 0,
    fabricOrderColourCount: foColourMap.get(c.id) ?? 0,
    fabricOrderAvailableCount: foAvailMap.get(c.id) ?? 0,
    fabricBalanceCount: fabricBalanceMap.get(c.id) ?? 0,
    accessoryMasterCount: accessoryMap.get(c.id) ?? 0,
  }));
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

      // Multi-colour products store slash-separated combos in colourOrdered (e.g. "Kofee/Tint Pink").
      // The updateMany above only handles single-colour rows. Rewrite combos by splitting on "/",
      // replacing any exact-match part, and rejoining. EXISTS guard limits the rewrite to affected rows.
      await tx.$executeRaw`
        UPDATE "Product"
        SET "colourOrdered" = (
          SELECT string_agg(
            CASE WHEN TRIM(part) = ${oldName} THEN ${newName} ELSE TRIM(part) END,
            '/'
          )
          FROM unnest(string_to_array("colourOrdered", '/')) AS part
        )
        WHERE position('/' IN "colourOrdered") > 0
          AND EXISTS (
            SELECT 1 FROM unnest(string_to_array("colourOrdered", '/')) AS p
            WHERE TRIM(p) = ${oldName}
          )
      `;
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
