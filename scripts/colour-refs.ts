import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });

const name = process.argv.slice(2).join(" ").trim();
if (!name) {
  console.error("Usage: tsx scripts/colour-refs.ts <colour name>");
  process.exit(1);
}

(async () => {
  const colour = await db.colour.findUnique({ where: { name } });
  if (!colour) {
    console.log(`No Colour row with name "${name}".`);
    await db.$disconnect();
    return;
  }
  console.log(`Colour: ${colour.name}  (id=${colour.id}, code=${colour.code || "—"})\n`);

  const articleRows = await db.$queryRaw<Array<{ id: string; articleNumber: string | null; styleNumber: string; colourOrdered: string }>>`
    SELECT id, "articleNumber", "styleNumber", "colourOrdered"
    FROM "Product"
    WHERE "articleNumber" IS NOT NULL
      AND ${name} = ANY(string_to_array("colourOrdered", '/'))
  `;
  // Trim parts on match (raw above ignores spaces around /).
  const articleMatches = articleRows.filter((r) =>
    r.colourOrdered.split("/").some((p) => p.trim() === name)
  );

  const [
    products, productMasters, fabricMasters, productLinks,
    foColour, foAvail, fabricBalances, accessoryMasters,
  ] = await Promise.all([
    db.product.findMany({ where: { colourOrderedId: colour.id }, select: { id: true, articleNumber: true, styleNumber: true, colourOrdered: true, phase: { select: { number: true, name: true } } } }),
    db.productMasterColour.findMany({
      where: { colourId: colour.id },
      select: { productMasterId: true, slot: true, productMaster: { select: { skuCode: true, articleNumber: true, styleNumber: true, fabricName: true } } },
    }),
    db.fabricMasterColour.findMany({
      where: { colourId: colour.id },
      select: { fabricMasterId: true, fabricMaster: { select: { fabricName: true } } },
    }),
    db.productColour.findMany({
      where: { colourId: colour.id },
      select: { productId: true, slot: true, product: { select: { articleNumber: true, styleNumber: true, colourOrdered: true, phase: { select: { number: true, name: true } } } } },
    }),
    db.fabricOrder.findMany({ where: { colourId: colour.id }, select: { id: true, poNumber: true, fabricName: true, phase: { select: { number: true, name: true } } } }),
    db.fabricOrder.findMany({ where: { availableColourId: colour.id }, select: { id: true, poNumber: true, fabricName: true, phase: { select: { number: true, name: true } } } }),
    db.fabricBalance.findMany({ where: { colourId: colour.id }, select: { id: true, colour: true, remainingKg: true } }),
    db.accessoryMaster.findMany({ where: { colourId: colour.id }, select: { id: true, displayName: true, baseName: true, colour: true } }),
  ]);

  const sections: Array<[string, unknown[]]> = [
    [`Articles (Product.articleNumber, name match incl. slash combos): ${articleMatches.length}`, articleMatches],
    [`Products (Product.colourOrderedId): ${products.length}`, products],
    [`Prod Links (ProductColour): ${productLinks.length}`, productLinks],
    [`Prod Masters (ProductMasterColour): ${productMasters.length}`, productMasters],
    [`Fab Masters (FabricMasterColour): ${fabricMasters.length}`, fabricMasters],
    [`FO Ordered (FabricOrder.colourId): ${foColour.length}`, foColour],
    [`FO Avail (FabricOrder.availableColourId): ${foAvail.length}`, foAvail],
    [`Fab Bal (FabricBalance): ${fabricBalances.length}`, fabricBalances],
    [`Acc Masters (AccessoryMaster): ${accessoryMasters.length}`, accessoryMasters],
  ];

  for (const [label, rows] of sections) {
    console.log(label);
    if (rows.length > 0) {
      for (const r of rows.slice(0, 20)) console.log("   ", JSON.stringify(r));
      if (rows.length > 20) console.log(`    ...and ${rows.length - 20} more`);
    }
  }
  await db.$disconnect();
})();
