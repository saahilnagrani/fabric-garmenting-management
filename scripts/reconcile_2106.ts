import { db as prisma } from '../src/lib/db';
import { renameProductMasterSkuCode } from '../src/lib/article-history';

const ARTICLE = '2106';
const PREV_TYPES = ['Two Tone Tank Top'];

const COSTS = {
  garmentsPerKg: 5.24,
  stitchingCost: 55, brandLogoCost: 0, neckTwillCost: 0, reflectorsCost: 11.2,
  fusingCost: 9, accessoriesCost: 0, brandTagCost: 5, sizeTagCost: 0,
  packagingCost: 8.5, inwardShipping: 10, proposedMrp: 499,
};

(async () => {
  await prisma.$transaction(async (tx) => {
    // 1. Rename Light Blue: M TN01 BLU -> M TN01 LBLU + seed prev
    const lb = await tx.productMaster.findUnique({ where: { skuCode: 'M TN01 BLU' } });
    if (lb) {
      await renameProductMasterSkuCode(tx as any, lb.id, 'M TN01 LBLU');
      const after = await tx.productMaster.findUnique({ where: { skuCode: 'M TN01 LBLU' } });
      if (after && !after.previousSkuCodes.includes('M TM01 BLU')) {
        await tx.productMaster.update({
          where: { id: after.id },
          data: { previousSkuCodes: [...after.previousSkuCodes, 'M TM01 BLU'] },
        });
      }
      console.log(`Renamed M TN01 BLU -> M TN01 LBLU; prev includes M TM01 BLU`);
    }

    // 2. Dark Blue (M TN01 DBLU) — seed prev=["M TM01 DBLU"]
    const db = await tx.productMaster.findUnique({ where: { skuCode: 'M TN01 DBLU' } });
    if (db && !db.previousSkuCodes.includes('M TM01 DBLU')) {
      await tx.productMaster.update({
        where: { id: db.id },
        data: { previousSkuCodes: [...db.previousSkuCodes, 'M TM01 DBLU'] },
      });
      console.log(`Seeded M TN01 DBLU previousSkuCodes including M TM01 DBLU`);
    }

    // 3. Apply common updates: styleNumber="" + costs (idempotent if already match)
    const fabric = await tx.fabricMaster.findUnique({ where: { fabricName: 'Uniqlo Knit' } });
    const fabricCostPerKg = Number(fabric!.mrp);
    const updated = await tx.productMaster.updateMany({
      where: { articleNumber: ARTICLE },
      data: { styleNumber: '', fabricCostPerKg, ...COSTS },
    });
    console.log(`Updated ${updated.count} master rows`);

    // 4. ArticleHistory previousTypes
    const h = await tx.articleHistory.findUnique({ where: { articleNumber: ARTICLE } });
    const merged = Array.from(new Set([...(h?.previousTypes ?? []), ...PREV_TYPES]));
    await tx.articleHistory.upsert({
      where: { articleNumber: ARTICLE },
      create: { articleNumber: ARTICLE, previousTypes: merged },
      update: { previousTypes: { set: merged } },
    });
    console.log(`ArticleHistory previousTypes=${JSON.stringify(merged)}`);
  });

  console.log('\n=== AFTER ===');
  const after = await prisma.productMaster.findMany({ where: { articleNumber: ARTICLE }, orderBy: { skuCode: 'asc' } });
  for (const r of after) {
    console.log(`- ${r.skuCode} | prev=${JSON.stringify(r.previousSkuCodes)} | colour=${JSON.stringify(r.coloursAvailable)} | type=${r.type} | name=${r.productName} | g/kg=${r.garmentsPerKg} | mrp=${r.proposedMrp} | style="${r.styleNumber}"`);
  }
  await prisma.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
