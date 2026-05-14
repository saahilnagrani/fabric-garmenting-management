import { db as prisma } from '../src/lib/db';
import { renameProductMasterSkuCode } from '../src/lib/article-history';

const ARTICLE = '2104';
const TYPE = 'Round Neck T-shirt';
const PREV_TYPES = ['Mens Round Neck', 'Ultralight Round Neck T-shirt'];
const PRODUCT_NAME = 'Liteflex';
const FABRIC = 'D.Naylon Mesh 1430';
const GARMENTING_AT = 'Garsem';

// (current sku, new sku, g/kg)
const renames: Array<{ old: string; new: string; gKg: number }> = [
  { old: 'M DO01 NVY', new: 'M RN06 NVY', gKg: 3.2 },
  { old: 'M DO01 OLV', new: 'M RN06 OLV', gKg: 4.48 },
  { old: 'M DO01 GRY', new: 'M RN06 GRY', gKg: 4.48 },
];

const STRIKE_BLK = 'M DO01 BLK'; // no rename, just isStrikedThrough

const NEW_LIGHT_BLUE = {
  sku: 'M RN06 BLU',
  oldSku: 'M DO01 BLU',
  colour: 'Light Blue',
  gKg: 4.16,
};

const COSTS = {
  stitchingCost: 59, brandLogoCost: 0, neckTwillCost: 0, reflectorsCost: 9.9,
  fusingCost: 15, accessoriesCost: 0, brandTagCost: 5, sizeTagCost: 0,
  packagingCost: 8.5, inwardShipping: 10, proposedMrp: 599,
};

(async () => {
  await prisma.$transaction(async (tx) => {
    const pt = await tx.productType.findFirst({ where: { name: TYPE } });
    if (!pt) throw new Error(`ProductType "${TYPE}" not found`);
    const garmenting = await tx.garmentingLocation.findFirst({ where: { name: GARMENTING_AT } });
    if (!garmenting) throw new Error(`GarmentingLocation "${GARMENTING_AT}" not found`);
    const fabric = await tx.fabricMaster.findUnique({ where: { fabricName: FABRIC } });
    if (!fabric?.mrp) throw new Error(`FabricMaster "${FABRIC}" missing mrp`);
    const fabricCostPerKg = Number(fabric.mrp);
    console.log(`Fabric ${FABRIC} cost=${fabricCostPerKg}`);

    // Rename + per-row g/kg + styleNumber=""
    for (const r of renames) {
      const row = await tx.productMaster.findUnique({ where: { skuCode: r.old } });
      if (!row) { console.log(`SKIP ${r.old}: not found`); continue; }
      await renameProductMasterSkuCode(tx as any, row.id, r.new);
      await tx.productMaster.update({ where: { skuCode: r.new }, data: { garmentsPerKg: r.gKg, styleNumber: '' } });
      console.log(`Renamed ${r.old} -> ${r.new} (g/kg=${r.gKg})`);
    }

    // Strike through Black
    const blk = await tx.productMaster.findUnique({ where: { skuCode: STRIKE_BLK } });
    if (blk) {
      await tx.productMaster.update({
        where: { id: blk.id },
        data: { isStrikedThrough: true, styleNumber: '' },
      });
      console.log(`Striked through ${STRIKE_BLK}`);
    }

    // Create new Light Blue active row under D.Naylon Mesh
    const existing = await tx.productMaster.findUnique({ where: { skuCode: NEW_LIGHT_BLUE.sku } });
    if (!existing) {
      const created = await tx.productMaster.create({
        data: {
          articleNumber: ARTICLE,
          skuCode: NEW_LIGHT_BLUE.sku,
          previousSkuCodes: [NEW_LIGHT_BLUE.oldSku],
          styleNumber: '',
          productName: PRODUCT_NAME,
          type: TYPE,
          typeRefId: pt.id,
          gender: 'MENS',
          garmentingAt: GARMENTING_AT,
          garmentingAtId: garmenting.id,
          fabricName: FABRIC,
          coloursAvailable: [NEW_LIGHT_BLUE.colour],
          colours2Available: [],
          colours3Available: [],
          colours4Available: [],
          garmentsPerKg: NEW_LIGHT_BLUE.gKg,
          fabricCostPerKg,
          ...COSTS,
        },
      });
      console.log(`Created ${created.skuCode} colour=${NEW_LIGHT_BLUE.colour} prev=${JSON.stringify(created.previousSkuCodes)}`);
    } else {
      console.log(`SKIP ${NEW_LIGHT_BLUE.sku}: already exists`);
    }

    // Apply type/typeRefId/productName common updates across all rows of article
    const updated = await tx.productMaster.updateMany({
      where: { articleNumber: ARTICLE },
      data: { type: TYPE, typeRefId: pt.id, productName: PRODUCT_NAME },
    });
    console.log(`Applied type/name to ${updated.count} master rows`);

    // ArticleHistory previousTypes
    const h = await tx.articleHistory.findUnique({ where: { articleNumber: ARTICLE } });
    const merged = Array.from(new Set([...(h?.previousTypes ?? []), ...PREV_TYPES]));
    await tx.articleHistory.upsert({
      where: { articleNumber: ARTICLE },
      create: { articleNumber: ARTICLE, previousTypes: merged },
      update: { previousTypes: { set: merged } },
    });
    console.log(`ArticleHistory previousTypes=${JSON.stringify(merged)}`);

    const fab = await tx.fabricMaster.findUnique({ where: { fabricName: FABRIC } });
    if (fab && !fab.articleNumbers.includes(ARTICLE)) {
      await tx.fabricMaster.update({
        where: { fabricName: FABRIC },
        data: { articleNumbers: { set: [...fab.articleNumbers, ARTICLE] } },
      });
      console.log(`Linked ${ARTICLE} into FabricMaster.${FABRIC}.articleNumbers`);
    }
  });

  console.log('\n=== AFTER ===');
  const after = await prisma.productMaster.findMany({ where: { articleNumber: ARTICLE }, orderBy: { skuCode: 'asc' } });
  for (const r of after) {
    console.log(`- ${r.skuCode} | prev=${JSON.stringify(r.previousSkuCodes)} | colour=${JSON.stringify(r.coloursAvailable)} | type=${r.type} | name=${r.productName} | fabric=${r.fabricName}/${r.fabricCostPerKg} | g/kg=${r.garmentsPerKg} | mrp=${r.proposedMrp} | active=${!r.isStrikedThrough}`);
  }
  const hist = await prisma.articleHistory.findUnique({ where: { articleNumber: ARTICLE } });
  console.log(`\nArticleHistory: previousTypes=${JSON.stringify(hist?.previousTypes)}`);
  await prisma.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
