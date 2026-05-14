import { db as prisma } from '../src/lib/db';
import { renameProductMasterSkuCode } from '../src/lib/article-history';

const ARTICLE = '2101';
const TYPE = 'Round Neck T-shirt';
const PREV_TYPES = ['Tshirt with Embose', 'Embossed Round Neck T-shirt'];
const PRODUCT_NAME = 'Ridge';
const FABRIC_NAME = 'Embose POS 3499';
const GARMENTING_AT = 'Garsem';

// Renames for existing rows
const renames: Record<string, string> = {
  'M EM01 GRN': 'M RN03 GRN',
  'M EM01 BLK': 'M RN03 BLK',
  'M EM01 TEL': 'M RN03 TEL',
};
// New row to create
const newRows = [
  { newSku: 'M RN03 NVY', oldSku: 'M EM01 NVY', colour: 'Navy' },
];

const COSTS = {
  garmentsPerKg: 5.5,
  stitchingCost: 52, brandLogoCost: 0, neckTwillCost: 0, reflectorsCost: 8.1,
  fusingCost: 12, accessoriesCost: 0, brandTagCost: 5, sizeTagCost: 0,
  packagingCost: 8.5, inwardShipping: 10, proposedMrp: 499,
};

(async () => {
  await prisma.$transaction(async (tx) => {
    const pt = await tx.productType.findFirst({ where: { name: TYPE } });
    if (!pt) throw new Error(`ProductType "${TYPE}" not found`);
    const garmenting = await tx.garmentingLocation.findFirst({ where: { name: GARMENTING_AT } });
    if (!garmenting) throw new Error(`GarmentingLocation "${GARMENTING_AT}" not found`);
    const fabric = await tx.fabricMaster.findUnique({ where: { fabricName: FABRIC_NAME } });
    if (!fabric?.mrp) throw new Error(`FabricMaster "${FABRIC_NAME}" missing mrp`);
    const fabricCostPerKg = Number(fabric.mrp);
    console.log(`Fabric ${FABRIC_NAME} mrp=${fabricCostPerKg}`);

    // Rename existing rows
    for (const [oldSku, newSku] of Object.entries(renames)) {
      const row = await tx.productMaster.findUnique({ where: { skuCode: oldSku } });
      if (!row) { console.log(`SKIP rename ${oldSku}: not found`); continue; }
      await renameProductMasterSkuCode(tx as any, row.id, newSku);
      console.log(`Renamed ${oldSku} -> ${newSku}`);
    }

    // Create new rows (Navy)
    for (const r of newRows) {
      const existing = await tx.productMaster.findUnique({ where: { skuCode: r.newSku } });
      if (existing) { console.log(`SKIP create ${r.newSku}: already exists`); continue; }
      const created = await tx.productMaster.create({
        data: {
          articleNumber: ARTICLE,
          skuCode: r.newSku,
          previousSkuCodes: [r.oldSku],
          styleNumber: '',
          productName: PRODUCT_NAME,
          type: TYPE,
          typeRefId: pt.id,
          gender: 'MENS',
          garmentingAt: GARMENTING_AT,
          garmentingAtId: garmenting.id,
          fabricName: FABRIC_NAME,
          coloursAvailable: [r.colour],
          colours2Available: [],
          colours3Available: [],
          colours4Available: [],
          fabricCostPerKg,
          ...COSTS,
        },
      });
      console.log(`Created ${created.skuCode} colour=${r.colour} prev=${JSON.stringify(created.previousSkuCodes)}`);
    }

    // Apply common updates to ALL rows of article (existing + new)
    const updated = await tx.productMaster.updateMany({
      where: { articleNumber: ARTICLE },
      data: {
        productName: PRODUCT_NAME,
        styleNumber: '',
        type: TYPE,
        typeRefId: pt.id,
        fabricCostPerKg,
        ...COSTS,
      },
    });
    console.log(`Applied common updates to ${updated.count} master rows`);

    // Seed ArticleHistory previousTypes
    const h = await tx.articleHistory.findUnique({ where: { articleNumber: ARTICLE } });
    const merged = Array.from(new Set([...(h?.previousTypes ?? []), ...PREV_TYPES]));
    await tx.articleHistory.upsert({
      where: { articleNumber: ARTICLE },
      create: { articleNumber: ARTICLE, previousTypes: merged },
      update: { previousTypes: { set: merged } },
    });
    console.log(`ArticleHistory previousTypes=${JSON.stringify(merged)}`);

    const fab = await tx.fabricMaster.findUnique({ where: { fabricName: FABRIC_NAME } });
    if (fab && !fab.articleNumbers.includes(ARTICLE)) {
      await tx.fabricMaster.update({
        where: { fabricName: FABRIC_NAME },
        data: { articleNumbers: { set: [...fab.articleNumbers, ARTICLE] } },
      });
      console.log(`Linked ${ARTICLE} into FabricMaster.${FABRIC_NAME}.articleNumbers`);
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
