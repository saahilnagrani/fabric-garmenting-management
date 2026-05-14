import { db as prisma } from '../src/lib/db';

const ARTICLE = '2107';
const TYPE = 'Full Sleeves';
const PREV_TYPES = ['Full Sleeved now Polo', 'Full Sleeved Zip T-shirt'];
const PRODUCT_NAME = 'Litefit';

const COSTS = {
  stitchingCost: 88, brandLogoCost: 0, neckTwillCost: 0, reflectorsCost: 6,
  fusingCost: 6.3, accessoriesCost: 0, brandTagCost: 5, sizeTagCost: 0,
  packagingCost: 8.5, inwardShipping: 10, proposedMrp: 699,
};

(async () => {
  await prisma.$transaction(async (tx) => {
    let pt = await tx.productType.findFirst({ where: { name: TYPE } });
    if (!pt) {
      pt = await tx.productType.create({ data: { name: TYPE } });
      console.log(`Created ProductType "${TYPE}" (id=${pt.id})`);
    }

    const updated = await tx.productMaster.updateMany({
      where: { articleNumber: ARTICLE },
      data: {
        type: TYPE, typeRefId: pt.id,
        productName: PRODUCT_NAME, styleNumber: '',
        ...COSTS,
      },
    });
    console.log(`Applied common updates to ${updated.count} master rows`);

    // Per-row g/kg: only Light Green changes to 2.56
    await tx.productMaster.update({ where: { skuCode: 'M FS01 GRN' }, data: { garmentsPerKg: 2.56 } });
    console.log(`Set g/kg=2.56 for M FS01 GRN`);

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
    console.log(`- ${r.skuCode} | colour=${JSON.stringify(r.coloursAvailable)} | type=${r.type} | name=${r.productName} | g/kg=${r.garmentsPerKg} | mrp=${r.proposedMrp} | style="${r.styleNumber}"`);
  }
  await prisma.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
