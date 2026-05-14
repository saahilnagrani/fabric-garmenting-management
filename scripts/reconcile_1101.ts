import { db as prisma } from '../src/lib/db';
import { changeArticleType } from '../src/lib/article-history';

const ARTICLE = '1101';
const NEW_TYPE = 'Round Neck T-shirt';

// Map current skuCode -> historical skuCode to seed previousSkuCodes.
const previousSkuByCurrent: Record<string, string> = {
  'M RN01 BLK': 'M RNT01 BLK',
  'M RN01 BLU': 'M RNT01 BLU',
  'M RN01 GRY': 'M RNT01 GRE',
  'M RN01 RED': 'M RNT01 RED',
  'M RN01 WHI': 'M RNT01 WHI',
};

(async () => {
  await prisma.$transaction(async (tx) => {
    const pt = await tx.productType.findFirst({ where: { name: NEW_TYPE } });
    if (!pt) throw new Error(`ProductType "${NEW_TYPE}" not found`);
    console.log(`Reusing ProductType "${NEW_TYPE}" (id=${pt.id})`);

    // Seed previousSkuCodes (only adds if not already present)
    for (const [cur, prev] of Object.entries(previousSkuByCurrent)) {
      const row = await tx.productMaster.findUnique({ where: { skuCode: cur } });
      if (!row) { console.log(`SKIP seed ${cur}: not found`); continue; }
      if (row.previousSkuCodes.includes(prev)) {
        console.log(`already seeded ${cur} prev=${prev}`);
        continue;
      }
      const merged = [...row.previousSkuCodes, prev];
      await tx.productMaster.update({ where: { id: row.id }, data: { previousSkuCodes: merged } });
      console.log(`Seeded ${cur} previousSkuCodes=${JSON.stringify(merged)}`);
    }

    // Change type article-wide (Aluminium row is also articleNumber=1101, so it gets the type change too)
    await changeArticleType(tx as any, ARTICLE, NEW_TYPE, pt.id);
    console.log(`Type set to "${NEW_TYPE}" for article ${ARTICLE}`);

    // Drop styleNumber on all master rows for the article
    const masterUpdated = await tx.productMaster.updateMany({
      where: { articleNumber: ARTICLE },
      data: { styleNumber: '' },
    });
    console.log(`Updated styleNumber="" on ${masterUpdated.count} master rows`);
  });

  // Verify
  const after = await prisma.productMaster.findMany({
    where: { articleNumber: ARTICLE },
    include: { typeRef: true },
    orderBy: { skuCode: 'asc' },
  });
  console.log('\n=== AFTER ===');
  for (const r of after) {
    console.log(`- skuCode=${r.skuCode} | prev=${JSON.stringify(r.previousSkuCodes)} | type=${r.type}/${r.typeRef?.name} | gender=${r.gender} | colour=${JSON.stringify(r.coloursAvailable)} | name=${r.productName} | style="${r.styleNumber}" | active=${!r.isStrikedThrough}`);
  }
  const hist = await prisma.articleHistory.findUnique({ where: { articleNumber: ARTICLE } });
  console.log(`\nArticleHistory: previousTypes=${JSON.stringify(hist?.previousTypes)}`);
  await prisma.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
