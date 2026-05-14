import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });

const DRY_RUN = process.argv.includes("--dry") || !process.argv.includes("--apply");

(async () => {
  const colours = await db.colour.findMany({ orderBy: { name: "asc" } });
  const rows = await db.$queryRaw<Array<{ colour: string; count: bigint }>>`
    SELECT TRIM(part) AS colour, COUNT(*)::bigint AS count
    FROM "Product",
         unnest(string_to_array("colourOrdered", '/')) AS part
    WHERE "articleNumber" IS NOT NULL
    GROUP BY TRIM(part)
  `;
  const counts = new Map(rows.map((r) => [r.colour, Number(r.count)]));
  const unused = colours.filter((c) => (counts.get(c.name) ?? 0) === 0);

  console.log(`${DRY_RUN ? "[DRY RUN] " : ""}Found ${unused.length} unused colours.`);

  // Check FK references for each before deleting.
  const summary: Array<{ name: string; refs: Record<string, number>; total: number }> = [];
  for (const c of unused) {
    const [
      productOrdered, productMasterAvail, fabricMasterAvail, productLinks,
      foColour, foAvail, fb, am,
    ] = await Promise.all([
      db.product.count({ where: { colourOrderedId: c.id } }),
      db.productMasterColour.count({ where: { colourId: c.id } }),
      db.fabricMasterColour.count({ where: { colourId: c.id } }),
      db.productColour.count({ where: { colourId: c.id } }),
      db.fabricOrder.count({ where: { colourId: c.id } }),
      db.fabricOrder.count({ where: { availableColourId: c.id } }),
      db.fabricBalance.count({ where: { colourId: c.id } }),
      db.accessoryMaster.count({ where: { colourId: c.id } }),
    ]);
    const refs = {
      "Product.colourOrderedId": productOrdered,
      "ProductMasterColour": productMasterAvail,
      "FabricMasterColour": fabricMasterAvail,
      "ProductColour": productLinks,
      "FabricOrder.colourId": foColour,
      "FabricOrder.availableColourId": foAvail,
      "FabricBalance": fb,
      "AccessoryMaster": am,
    };
    const total = Object.values(refs).reduce((a, b) => a + b, 0);
    summary.push({ name: c.name, refs, total });
  }

  const safe = unused.filter((_, i) => summary[i].total === 0);
  const blocked = unused.filter((_, i) => summary[i].total > 0);

  console.log(`Safe to delete (no FK refs): ${safe.length}`);
  for (const c of safe) console.log(`  - ${c.name} (${c.code || "—"})`);

  if (blocked.length > 0) {
    console.log(`\nBlocked by FK refs: ${blocked.length}`);
    for (const c of blocked) {
      const s = summary.find((x) => x.name === c.name)!;
      const detail = Object.entries(s.refs).filter(([, v]) => v > 0).map(([k, v]) => `${k}=${v}`).join(", ");
      console.log(`  - ${c.name} (${c.code || "—"})  →  ${detail}`);
    }
  }

  if (DRY_RUN) {
    console.log("\nDry run; pass --apply to delete.");
    await db.$disconnect();
    return;
  }

  if (safe.length > 0) {
    const result = await db.colour.deleteMany({ where: { id: { in: safe.map((c) => c.id) } } });
    console.log(`\nDeleted ${result.count} colours.`);
  }
  await db.$disconnect();
})();
