import { db as prisma } from '../src/lib/db';
import { renameProductMasterSkuCode, changeArticleType } from '../src/lib/article-history';

const ARTICLE = '1003';
const NEW_TYPE = 'Polo';
const NEW_NAME = 'Aeroflux';
const skuRenames: Record<string, string> = {
  'W POL01 GRN': 'W PO01 GRN',
  'W POL01 BLU': 'W PO01 BLU',
  'W POL01 YEL': 'W PO01 YLW',
};

(async () => {
  await prisma.$transaction(async (tx) => {
    // Ensure ProductType "Polo" exists
    let polo = await tx.productType.findFirst({ where: { name: NEW_TYPE } });
    if (!polo) {
      polo = await tx.productType.create({ data: { name: NEW_TYPE } });
      console.log(`Created ProductType "${NEW_TYPE}" (id=${polo.id})`);
    } else {
      console.log(`Reusing ProductType "${NEW_TYPE}" (id=${polo.id})`);
    }

    // Rename SKUs (helper pushes old code to previousSkuCodes)
    for (const [oldSku, newSku] of Object.entries(skuRenames)) {
      const row = await tx.productMaster.findUnique({ where: { skuCode: oldSku } });
      if (!row) { console.log(`SKIP rename ${oldSku}: not found`); continue; }
      await renameProductMasterSkuCode(tx as any, row.id, newSku);
      console.log(`Renamed ${oldSku} -> ${newSku}`);
    }

    // Change type for the article (helper writes old type to ArticleHistory.previousTypes)
    await changeArticleType(tx as any, ARTICLE, NEW_TYPE, polo.id);
    console.log(`Type set to "${NEW_TYPE}" for article ${ARTICLE}`);

    // Apply other field updates to all ProductMaster rows of article 1003
    const updated = await tx.productMaster.updateMany({
      where: { articleNumber: ARTICLE },
      data: {
        gender: 'WOMENS',
        productName: NEW_NAME,
        styleNumber: '', // user wants null but schema requires String
        stitchingCost: 120,
        brandLogoCost: 12,
        neckTwillCost: 0,
        reflectorsCost: 0,
        fusingCost: 0,
        accessoriesCost: 0,
        brandTagCost: 5,
        sizeTagCost: 2,
        packagingCost: 12,
        inwardShipping: 10,
        proposedMrp: 899,
      },
    });
    console.log(`Updated ${updated.count} ProductMaster rows`);

    // Fix gender on existing Product orders for this article (per user: keep type/skuCode/name intact)
    const productsUpdated = await tx.product.updateMany({
      where: { articleNumber: ARTICLE },
      data: { gender: 'WOMENS' },
    });
    console.log(`Updated gender on ${productsUpdated.count} Product order rows`);
  });

  // Verify
  const after = await prisma.productMaster.findMany({
    where: { articleNumber: ARTICLE },
    include: { typeRef: true },
    orderBy: { skuCode: 'asc' },
  });
  console.log('\n=== AFTER ===');
  for (const r of after) {
    console.log(`- skuCode=${r.skuCode} | prev=${JSON.stringify(r.previousSkuCodes)} | type=${r.type}/${r.typeRef?.name} | gender=${r.gender} | name=${r.productName} | style="${r.styleNumber}"`);
    console.log(`  costs: stitch=${r.stitchingCost} logo=${r.brandLogoCost} neck=${r.neckTwillCost} refl=${r.reflectorsCost} fuse=${r.fusingCost} acc=${r.accessoriesCost} bt=${r.brandTagCost} st=${r.sizeTagCost} pkg=${r.packagingCost} inShip=${r.inwardShipping} mrp=${r.proposedMrp}`);
  }
  const hist = await prisma.articleHistory.findUnique({ where: { articleNumber: ARTICLE } });
  console.log(`\nArticleHistory: previousTypes=${JSON.stringify(hist?.previousTypes)}`);
  const products = await prisma.product.findMany({
    where: { articleNumber: ARTICLE },
    select: { skuCode: true, type: true, gender: true, productName: true },
    orderBy: { skuCode: 'asc' },
  });
  console.log('\nOrders:');
  for (const p of products) console.log(`- ${p.skuCode} | type=${p.type} | gender=${p.gender} | name=${p.productName}`);

  await prisma.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
