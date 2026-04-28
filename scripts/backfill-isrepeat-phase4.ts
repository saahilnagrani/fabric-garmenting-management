/**
 * One-shot backfill: flip isRepeat=true on Product and FabricOrder rows in
 * phase 4 whose article number's base (before any "-N" suffix) is < 4000 OR
 * matches an article number that already exists in a previous phase.
 *
 * Mirrors the in-app isRepeatArticle logic in
 * src/components/phase-planning/planning-form.tsx, which prior to this fix
 * did not strip the "-N" suffix and so left rows like 1007-1, 1007-2, 1008-1
 * mistakenly marked as non-repeat at creation time.
 *
 * Dry-run by default. Pass --apply to actually write.
 *
 * Usage:
 *   DATABASE_URL=postgresql://... npx tsx scripts/backfill-isrepeat-phase4.ts
 *   DATABASE_URL=postgresql://... npx tsx scripts/backfill-isrepeat-phase4.ts --apply
 */
import { db } from "../src/lib/db";

const PHASE_NUMBER = 4;
const APPLY = process.argv.includes("--apply");

function baseArticle(articleNumber: string): string {
  return articleNumber.split("-")[0];
}

async function main() {
  const phase = await db.phase.findUnique({ where: { number: PHASE_NUMBER } });
  if (!phase) {
    console.error(`No phase with number=${PHASE_NUMBER}`);
    process.exit(1);
  }

  const previousArticles = new Set(
    (
      await db.product.findMany({
        where: { phaseId: { not: phase.id }, articleNumber: { not: null } },
        select: { articleNumber: true },
        distinct: ["articleNumber"],
      })
    )
      .map((p) => p.articleNumber)
      .filter((a): a is string => Boolean(a)),
  );

  function shouldBeRepeat(articleNumber: string | null): boolean {
    if (!articleNumber) return false;
    if (previousArticles.has(articleNumber)) return true;
    const base = baseArticle(articleNumber);
    if (previousArticles.has(base)) return true;
    const baseNum = parseInt(base, 10);
    if (!isNaN(baseNum) && baseNum < PHASE_NUMBER * 1000) return true;
    return false;
  }

  const products = await db.product.findMany({
    where: { phaseId: phase.id, isRepeat: false },
    select: { id: true, articleNumber: true, styleNumber: true, colourOrdered: true },
  });
  const productHits = products.filter((p) => shouldBeRepeat(p.articleNumber));

  // FabricOrder.articleNumbers is a comma-separated string. Treat the row as
  // repeat if ANY listed article qualifies.
  const fabricOrders = await db.fabricOrder.findMany({
    where: { phaseId: phase.id, isRepeat: false },
    select: { id: true, articleNumbers: true, fabricName: true, colour: true },
  });
  const fabricHits = fabricOrders.filter((fo) =>
    fo.articleNumbers
      .split(",")
      .map((s) => s.trim())
      .some((a) => shouldBeRepeat(a)),
  );

  console.log(`Phase ${PHASE_NUMBER} (${phase.id}): ${products.length} products with isRepeat=false, ${fabricOrders.length} fabric orders with isRepeat=false`);
  console.log(`Will flip ${productHits.length} products and ${fabricHits.length} fabric orders to isRepeat=true.`);
  console.log("\nProducts:");
  for (const p of productHits) {
    console.log(`  ${p.articleNumber}\t${p.styleNumber}\t${p.colourOrdered}`);
  }
  console.log("\nFabric orders:");
  for (const fo of fabricHits) {
    console.log(`  [${fo.articleNumbers}]\t${fo.fabricName}\t${fo.colour}`);
  }

  if (!APPLY) {
    console.log("\nDry run. Re-run with --apply to write.");
    return;
  }

  const productIds = productHits.map((p) => p.id);
  const fabricIds = fabricHits.map((f) => f.id);
  const [pUpdated, fUpdated] = await Promise.all([
    productIds.length
      ? db.product.updateMany({ where: { id: { in: productIds } }, data: { isRepeat: true } })
      : Promise.resolve({ count: 0 }),
    fabricIds.length
      ? db.fabricOrder.updateMany({ where: { id: { in: fabricIds } }, data: { isRepeat: true } })
      : Promise.resolve({ count: 0 }),
  ]);
  console.log(`\nUpdated ${pUpdated.count} products and ${fUpdated.count} fabric orders.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
