/**
 * Upsert two "universal" accessories — Poly bags and Brand Tag - Black —
 * onto every article in the DB at qty=1, applicableSizes=[] (all sizes).
 * Other BOM rows are left untouched.
 */
import { db } from "../src/lib/db";

const ACCESSORIES = ["Poly bags", "Brand Tag - Black"];

async function main() {
  const apply = !process.argv.includes("--check");

  const accs = await db.accessoryMaster.findMany({
    where: { displayName: { in: ACCESSORIES } },
    select: { id: true, displayName: true },
  });
  const byName = new Map(accs.map((a) => [a.displayName, a.id]));
  const missing = ACCESSORIES.filter((n) => !byName.has(n));
  if (missing.length) {
    console.error("Missing accessories:", missing);
    process.exit(1);
  }

  const pms = await db.productMaster.findMany({
    where: { articleNumber: { not: null }, isStrikedThrough: false },
    select: { articleNumber: true },
    distinct: ["articleNumber"],
  });
  const articles = [...new Set(pms.map((p) => p.articleNumber!).filter(Boolean))];
  articles.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  console.log(`Found ${articles.length} articles. Will add ${ACCESSORIES.length} accessories to each.`);

  if (!apply) {
    console.log("[--check] Dry-run. Re-run without --check to apply.");
    return;
  }

  let created = 0;
  let alreadyExisted = 0;
  for (const article of articles) {
    for (const accessoryName of ACCESSORIES) {
      const accessoryId = byName.get(accessoryName)!;
      const existing = await db.articleAccessory.findUnique({
        where: {
          articleNumber_accessoryId: { articleNumber: article, accessoryId },
        },
      });
      if (existing) {
        alreadyExisted++;
        continue;
      }
      await db.articleAccessory.create({
        data: {
          articleNumber: article,
          accessoryId,
          quantityPerPiece: 1,
          applicableSizes: [],
        },
      });
      created++;
    }
  }
  console.log(`Done. Created ${created} rows. ${alreadyExisted} already existed (left untouched).`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
