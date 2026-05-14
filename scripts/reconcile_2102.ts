import { db as prisma } from '../src/lib/db';
import { renameProductMasterSkuCode } from '../src/lib/article-history';

const ARTICLE = '2102';
const TYPE = 'Round Neck T-shirt';
const PREV_TYPES = ['Limitless Tshirt', 'Soft Touch Round Neck T-shirt'];
const PRODUCT_NAME = 'Elevate';

const renames: Record<string, string> = {
  'M ST01 BLK': 'M RN04 BLK',
  'M ST01 BLU': 'M RN04 BLU',
  'M ST01 WIN': 'M RN04 WIN',
};

// Per-row g/kg by current (post-rename) skuCode
const garmentsPerKgBySku: Record<string, number> = {
  'M RN04 BLK': 5.12,
  'M RN04 BLU': 4.48,
  'M RN04 WIN': 4.8,
};

const COMMON_COSTS = {
  stitchingCost: 64, brandLogoCost: 0, neckTwillCost: 0, reflectorsCost: 35.4,
  fusingCost: 17, accessoriesCost: 0, brandTagCost: 5, sizeTagCost: 0,
  packagingCost: 8.5, inwardShipping: 10, proposedMrp: 699,
};

(async () => {
  await prisma.$transaction(async (tx) => {
    const pt = await tx.productType.findFirst({ where: { name: TYPE } });
    if (!pt) throw new Error(`ProductType "${TYPE}" not found`);

    // All Nylon IU 16x have mrp=785; resolve once
    const sample = await tx.fabricMaster.findUnique({ where: { fabricName: 'Nylon IU 160' } });
    if (!sample?.mrp) throw new Error('Nylon IU 160 missing mrp');
    const fabricCostPerKg = Number(sample.mrp);

    for (const [oldSku, newSku] of Object.entries(renames)) {
      const row = await tx.productMaster.findUnique({ where: { skuCode: oldSku } });
      if (!row) { console.log(`SKIP rename ${oldSku}: not found`); continue; }
      await renameProductMasterSkuCode(tx as any, row.id, newSku);
      console.log(`Renamed ${oldSku} -> ${newSku}`);
    }

    // Common updates across all rows of article
    const updated = await tx.productMaster.updateMany({
      where: { articleNumber: ARTICLE },
      data: {
        productName: PRODUCT_NAME,
        styleNumber: '',
        type: TYPE,
        typeRefId: pt.id,
        fabricCostPerKg,
        ...COMMON_COSTS,
      },
    });
    console.log(`Applied common updates to ${updated.count} master rows`);

    // Per-row g/kg
    for (const [sku, gkg] of Object.entries(garmentsPerKgBySku)) {
      await tx.productMaster.update({ where: { skuCode: sku }, data: { garmentsPerKg: gkg } });
      console.log(`Set g/kg=${gkg} for ${sku}`);
    }

    // ArticleHistory previousTypes
    const h = await tx.articleHistory.findUnique({ where: { articleNumber: ARTICLE } });
    const merged = Array.from(new Set([...(h?.previousTypes ?? []), ...PREV_TYPES]));
    await tx.articleHistory.upsert({
      where: { articleNumber: ARTICLE },
      create: { articleNumber: ARTICLE, previousTypes: merged },
      update: { previousTypes: { set: merged } },
    });
    console.log(`ArticleHistory previousTypes=${JSON.stringify(merged)}`);

    // Link 2102 into all 3 Nylon IU FabricMasters
    for (const fn of ['Nylon IU 160', 'Nylon IU 161', 'Nylon IU 162']) {
      const fab = await tx.fabricMaster.findUnique({ where: { fabricName: fn } });
      if (fab && !fab.articleNumbers.includes(ARTICLE)) {
        await tx.fabricMaster.update({
          where: { fabricName: fn },
          data: { articleNumbers: { set: [...fab.articleNumbers, ARTICLE] } },
        });
        console.log(`Linked ${ARTICLE} into FabricMaster.${fn}.articleNumbers`);
      }
    }
  });

  console.log('\n=== AFTER ===');
  const after = await prisma.productMaster.findMany({ where: { articleNumber: ARTICLE }, orderBy: { skuCode: 'asc' } });
  for (const r of after) {
    console.log(`- ${r.skuCode} | prev=${JSON.stringify(r.previousSkuCodes)} | colour=${JSON.stringify(r.coloursAvailable)} | type=${r.type} | name=${r.productName} | fabric=${r.fabricName}/${r.fabricCostPerKg} | g/kg=${r.garmentsPerKg} | mrp=${r.proposedMrp}`);
  }
  const hist = await prisma.articleHistory.findUnique({ where: { articleNumber: ARTICLE } });
  console.log(`\nArticleHistory: previousTypes=${JSON.stringify(hist?.previousTypes)}`);
  await prisma.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
