import { db as prisma } from '../src/lib/db';
import { renameProductMasterSkuCode } from '../src/lib/article-history';

const ARTICLE = '2105';
const TYPE = 'Round Neck T-shirt';
const PREV_TYPES = ['Two Colourd Tshirt', 'Two Tone Round Neck T-shirt'];
const PRODUCT_NAME = 'Aeron';
const FABRIC = 'Bubblegum Diamond';

const renames: Array<{ old: string; new: string; gKg?: number }> = [
  { old: 'M DI01 BLK', new: 'M RN07 BLK' }, // not in input — keep g/kg
  { old: 'M DI01 GRY', new: 'M RN07 GRY', gKg: 3.84 },
  { old: 'M DI01 NVY', new: 'M RN07 NVY', gKg: 3.7 },
  { old: 'M DI01 OLV', new: 'M RN07 OLV', gKg: 7.68 },
];

const COSTS = {
  stitchingCost: 63, brandLogoCost: 0, neckTwillCost: 0, reflectorsCost: 6.6,
  fusingCost: 9, accessoriesCost: 0, brandTagCost: 5, sizeTagCost: 0,
  packagingCost: 8.5, inwardShipping: 10, proposedMrp: 549,
};

(async () => {
  await prisma.$transaction(async (tx) => {
    const pt = await tx.productType.findFirst({ where: { name: TYPE } });
    if (!pt) throw new Error(`ProductType "${TYPE}" not found`);
    const fabric = await tx.fabricMaster.findUnique({ where: { fabricName: FABRIC } });
    if (!fabric?.mrp) throw new Error(`Fabric "${FABRIC}" missing mrp`);
    const fabricCostPerKg = Number(fabric.mrp);

    for (const r of renames) {
      const row = await tx.productMaster.findUnique({ where: { skuCode: r.old } });
      if (!row) { console.log(`SKIP ${r.old}: not found`); continue; }
      await renameProductMasterSkuCode(tx as any, row.id, r.new);
      if (r.gKg !== undefined) {
        await tx.productMaster.update({ where: { skuCode: r.new }, data: { garmentsPerKg: r.gKg } });
      }
      console.log(`Renamed ${r.old} -> ${r.new}${r.gKg !== undefined ? ` (g/kg=${r.gKg})` : ''}`);
    }

    const updated = await tx.productMaster.updateMany({
      where: { articleNumber: ARTICLE },
      data: {
        type: TYPE, typeRefId: pt.id,
        productName: PRODUCT_NAME, styleNumber: '',
        fabricCostPerKg,
        ...COSTS,
      },
    });
    console.log(`Applied common updates to ${updated.count} master rows`);

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
    console.log(`- ${r.skuCode} | prev=${JSON.stringify(r.previousSkuCodes)} | colour=${JSON.stringify(r.coloursAvailable)} | type=${r.type} | name=${r.productName} | g/kg=${r.garmentsPerKg} | mrp=${r.proposedMrp}`);
  }
  await prisma.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
