/**
 * Backfill ArticleAccessory from ProductMasterAccessory.
 *
 * For each (articleNumber, accessoryId) seen across ProductMasterAccessory
 * rows linked to ProductMasters with that articleNumber, create one
 * ArticleAccessory row. Detect conflicts where sibling SKUs of the same
 * article disagree on quantityPerPiece or applicableSizes — pick the most
 * common value, report.
 *
 * Skips ProductMasters with null articleNumber (their BOM can't be lifted to
 * article level — they should be cleaned up separately).
 *
 * Usage:
 *   npx tsx scripts/backfill-article-accessory.ts --check
 *   npx tsx scripts/backfill-article-accessory.ts
 */
import { db } from "../src/lib/db";

type GroupRow = {
  articleNumber: string;
  accessoryId: string;
  quantityPerPiece: string; // stringified decimal for grouping
  applicableSizes: string[];
  count: number;
};

async function main() {
  const apply = !process.argv.includes("--check");

  const links = await db.productMasterAccessory.findMany({
    select: {
      productMaster: { select: { articleNumber: true, skuCode: true } },
      accessoryId: true,
      quantityPerPiece: true,
      applicableSizes: true,
      notes: true,
    },
  });
  console.log(`Loaded ${links.length} ProductMasterAccessory rows.`);

  // Skip rows with no articleNumber.
  const skipped = links.filter((l) => !l.productMaster.articleNumber);
  if (skipped.length) {
    console.log(`  Skipping ${skipped.length} rows on SKUs with no articleNumber.`);
  }
  const valid = links.filter((l) => !!l.productMaster.articleNumber);

  // Group by (article, accessory) → vote on (qty, sizes) so we pick the dominant value.
  const groups = new Map<string, Map<string, GroupRow>>();
  for (const l of valid) {
    const key = `${l.productMaster.articleNumber}|${l.accessoryId}`;
    const variantKey = `${l.quantityPerPiece.toString()}|${l.applicableSizes.slice().sort().join(",")}`;
    let inner = groups.get(key);
    if (!inner) {
      inner = new Map();
      groups.set(key, inner);
    }
    const existing = inner.get(variantKey);
    if (existing) existing.count++;
    else
      inner.set(variantKey, {
        articleNumber: l.productMaster.articleNumber!,
        accessoryId: l.accessoryId,
        quantityPerPiece: l.quantityPerPiece.toString(),
        applicableSizes: l.applicableSizes,
        count: 1,
      });
  }

  // Pick the variant with highest count for each (article, accessory).
  const winners: GroupRow[] = [];
  const conflicts: string[] = [];
  for (const [key, variants] of groups.entries()) {
    const variantList = [...variants.values()].sort((a, b) => b.count - a.count);
    winners.push(variantList[0]);
    if (variantList.length > 1) {
      const [art, acc] = key.split("|");
      conflicts.push(
        `  - article ${art}, accessoryId ${acc}: ${variantList.length} variants (${variantList
          .map((v) => `${v.count}× qty=${v.quantityPerPiece} sizes=[${v.applicableSizes.join(",")}]`)
          .join("; ")}); kept first.`,
      );
    }
  }
  if (conflicts.length) {
    console.log(`\n${conflicts.length} (article, accessory) pair(s) had conflicting SKU values; picked dominant variant:`);
    for (const c of conflicts) console.log(c);
  }

  console.log(`\nWill upsert ${winners.length} ArticleAccessory rows.`);

  if (!apply) {
    console.log(`[--check] Dry-run only. Re-run without --check to apply.`);
    return;
  }

  let upserts = 0;
  for (const w of winners) {
    await db.articleAccessory.upsert({
      where: {
        articleNumber_accessoryId: {
          articleNumber: w.articleNumber,
          accessoryId: w.accessoryId,
        },
      },
      create: {
        articleNumber: w.articleNumber,
        accessoryId: w.accessoryId,
        quantityPerPiece: w.quantityPerPiece,
        applicableSizes: w.applicableSizes,
      },
      update: {
        quantityPerPiece: w.quantityPerPiece,
        applicableSizes: w.applicableSizes,
      },
    });
    upserts++;
  }
  console.log(`Done. ${upserts} ArticleAccessory rows upserted.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
