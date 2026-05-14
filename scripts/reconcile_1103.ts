import { db as prisma } from '../src/lib/db';
import { renameProductMasterSkuCode } from '../src/lib/article-history';

const ARTICLE = '1103';
const NEW_NAME = 'Aeroflux';
const PREVIOUS_TYPES = ['Mens Polo', 'Polo T-shirt'];
const skuRenames: Record<string, string> = {
  'M POL01 BLK': 'M PO01 BLK',
  'M POL01 BLU': 'M PO01 BLU',
  'M POL01 GRN': 'M PO01 GRN',
  'M POL01 ORA': 'M PO01 ORN',
  'M POL01 WIN': 'M PO01 WIN',
};
const COSTS = {
  stitchingCost: 110, brandLogoCost: 12, neckTwillCost: 0, reflectorsCost: 8,
  fusingCost: 0, accessoriesCost: 0, brandTagCost: 5, sizeTagCost: 4,
  packagingCost: 12, inwardShipping: 10, proposedMrp: 749,
};

(async () => {
  await prisma.$transaction(async (tx) => {
    for (const [oldSku, newSku] of Object.entries(skuRenames)) {
      const row = await tx.productMaster.findUnique({ where: { skuCode: oldSku } });
      if (!row) { console.log(`SKIP rename ${oldSku}: not found`); continue; }
      await renameProductMasterSkuCode(tx as any, row.id, newSku);
      console.log(`Renamed ${oldSku} -> ${newSku}`);
    }

    // Type already "Polo" in DB. Just seed ArticleHistory with both historical types.
    const existing = await tx.articleHistory.findUnique({ where: { articleNumber: ARTICLE } });
    const merged = Array.from(new Set([...(existing?.previousTypes ?? []), ...PREVIOUS_TYPES]));
    await tx.articleHistory.upsert({
      where: { articleNumber: ARTICLE },
      create: { articleNumber: ARTICLE, previousTypes: merged },
      update: { previousTypes: { set: merged } },
    });
    console.log(`ArticleHistory previousTypes=${JSON.stringify(merged)}`);

    // Apply costs + productName + styleNumber across all rows
    const updated = await tx.productMaster.updateMany({
      where: { articleNumber: ARTICLE },
      data: { productName: NEW_NAME, styleNumber: '', ...COSTS },
    });
    console.log(`Updated ${updated.count} master rows (productName, styleNumber, costs)`);
  });

  const after = await prisma.productMaster.findMany({
    where: { articleNumber: ARTICLE }, include: { typeRef: true }, orderBy: { skuCode: 'asc' },
  });
  console.log('\n=== AFTER ===');
  for (const r of after) {
    console.log(`- ${r.skuCode} | prev=${JSON.stringify(r.previousSkuCodes)} | colour=${JSON.stringify(r.coloursAvailable)} | type=${r.type} | name=${r.productName} | style="${r.styleNumber}" | mrp=${r.proposedMrp}`);
  }
  const hist = await prisma.articleHistory.findUnique({ where: { articleNumber: ARTICLE } });
  console.log(`\nArticleHistory: previousTypes=${JSON.stringify(hist?.previousTypes)}`);
  await prisma.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
