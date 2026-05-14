import { db as prisma } from '../src/lib/db';
import { renameProductMasterSkuCode, changeArticleType } from '../src/lib/article-history';

const ARTICLE = '1001';
const NEW_TYPE = 'Round Neck T-shirt';
const skuRenames: Record<string, string> = {
  'W RNT01 BLK': 'W RN01 BLK',
  'W RNT01 BLU': 'W RN01 BLU',
  'W RNT01 ALU': 'W RN01 ALU',
};

(async () => {
  await prisma.$transaction(async (tx) => {
    // Ensure ProductType exists
    let pt = await tx.productType.findFirst({ where: { name: NEW_TYPE } });
    if (!pt) {
      pt = await tx.productType.create({ data: { name: NEW_TYPE } });
      console.log(`Created ProductType "${NEW_TYPE}" (id=${pt.id})`);
    } else {
      console.log(`Reusing ProductType "${NEW_TYPE}" (id=${pt.id})`);
    }

    // Rename SKUs
    for (const [oldSku, newSku] of Object.entries(skuRenames)) {
      const row = await tx.productMaster.findUnique({ where: { skuCode: oldSku } });
      if (!row) { console.log(`SKIP rename ${oldSku}: not found`); continue; }
      await renameProductMasterSkuCode(tx as any, row.id, newSku);
      console.log(`Renamed ${oldSku} -> ${newSku}`);
    }

    // Change type article-wide (pushes old to ArticleHistory.previousTypes)
    await changeArticleType(tx as any, ARTICLE, NEW_TYPE, pt.id);
    console.log(`Type set to "${NEW_TYPE}" for article ${ARTICLE}`);

    // Drop styleNumber on master rows
    const masterUpdated = await tx.productMaster.updateMany({
      where: { articleNumber: ARTICLE },
      data: { styleNumber: '' },
    });
    console.log(`Updated styleNumber="" on ${masterUpdated.count} master rows`);

    // Fix gender on existing Product orders for BLK and BLU (currently MENS)
    const ordersUpdated = await tx.product.updateMany({
      where: {
        articleNumber: ARTICLE,
        skuCode: { in: ['W RNT01 BLK', 'W RNT01 BLU'] },
        gender: 'MENS',
      },
      data: { gender: 'WOMENS' },
    });
    console.log(`Fixed gender MENS -> WOMENS on ${ordersUpdated.count} order rows`);
  });

  // Verify
  const after = await prisma.productMaster.findMany({
    where: { articleNumber: ARTICLE },
    include: { typeRef: true },
    orderBy: { skuCode: 'asc' },
  });
  console.log('\n=== MASTER AFTER ===');
  for (const r of after) {
    console.log(`- skuCode=${r.skuCode} | prev=${JSON.stringify(r.previousSkuCodes)} | type=${r.type}/${r.typeRef?.name} | gender=${r.gender} | colour=${JSON.stringify(r.coloursAvailable)} | name=${r.productName} | style="${r.styleNumber}"`);
  }
  const hist = await prisma.articleHistory.findUnique({ where: { articleNumber: ARTICLE } });
  console.log(`\nArticleHistory: previousTypes=${JSON.stringify(hist?.previousTypes)}`);
  const products = await prisma.product.findMany({
    where: { articleNumber: ARTICLE },
    select: { skuCode: true, gender: true, type: true, phaseId: true, status: true, productName: true },
    orderBy: [{ phaseId: 'asc' }, { skuCode: 'asc' }],
  });
  console.log('\nOrders:');
  for (const p of products) console.log(`- phase=${p.phaseId} | ${p.skuCode} | type=${p.type} | gender=${p.gender} | name=${p.productName} | status=${p.status}`);

  await prisma.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
