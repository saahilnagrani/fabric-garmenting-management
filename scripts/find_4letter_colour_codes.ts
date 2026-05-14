import { db as prisma } from '../src/lib/db';
(async () => {
  const all = await prisma.productMaster.findMany({ select: { skuCode: true, articleNumber: true, coloursAvailable: true, previousSkuCodes: true } });
  const byArticle = new Map<string, { skuCode: string; colour: string; codeSuffix: string; isPrev: boolean }[]>();
  for (const r of all) {
    if (!r.articleNumber) continue;
    const skus = [{ s: r.skuCode, prev: false }, ...r.previousSkuCodes.map((s) => ({ s, prev: true }))];
    for (const { s, prev } of skus) {
      const tokens = s.trim().split(/\s+/);
      const last = tokens[tokens.length - 1];
      if (last.length === 4) {
        if (!byArticle.has(r.articleNumber)) byArticle.set(r.articleNumber, []);
        byArticle.get(r.articleNumber)!.push({ skuCode: s, colour: r.coloursAvailable?.[0] ?? '', codeSuffix: last, isPrev: prev });
      }
    }
  }
  const sorted = Array.from(byArticle.keys()).sort();
  for (const a of sorted) {
    console.log(`${a}:`);
    for (const e of byArticle.get(a)!) console.log(`  - ${e.skuCode} (${e.codeSuffix}) → ${e.colour}${e.isPrev ? ' [HISTORICAL]' : ''}`);
  }
  console.log(`\nTotal articles with 4-letter colour codes: ${sorted.length}`);
  await prisma.$disconnect();
})();
