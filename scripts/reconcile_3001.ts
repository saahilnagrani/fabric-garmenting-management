import { db as prisma } from '../src/lib/db';

const ARTICLE = '3001';
const TYPE = 'Striped Trackpants';
const PREV_TYPES = ['Lowers Strip'];
const PRODUCT_NAME = 'Glidefit';

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
        proposedMrp: 949,
        inwardShipping: 10,
      },
    });
    console.log(`Updated ${updated.count} master rows`);

    const h = await tx.articleHistory.findUnique({ where: { articleNumber: ARTICLE } });
    const merged = Array.from(new Set([...(h?.previousTypes ?? []), ...PREV_TYPES]));
    await tx.articleHistory.upsert({
      where: { articleNumber: ARTICLE },
      create: { articleNumber: ARTICLE, previousTypes: merged },
      update: { previousTypes: { set: merged } },
    });
    console.log(`ArticleHistory previousTypes=${JSON.stringify(merged)}`);
  });

  const after = await prisma.productMaster.findMany({ where: { articleNumber: ARTICLE }, orderBy: { skuCode: 'asc' } });
  console.log('\n=== AFTER ===');
  for (const r of after) {
    console.log(`- ${r.skuCode} | colour=${JSON.stringify(r.coloursAvailable)} | type=${r.type} | name=${r.productName} | style="${r.styleNumber}" | mrp=${r.proposedMrp} | inShip=${r.inwardShipping}`);
  }
  await prisma.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
