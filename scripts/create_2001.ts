import { db as prisma } from '../src/lib/db';

const ARTICLE = '2001';
const TYPE = 'Round Neck T-shirt';
const PRODUCT_NAME = 'Breeza';
const FABRIC_NAME = 'Darwin';
const GARMENTING_AT = 'Mumtaz';
const GENDER = 'WOMENS' as const;

const rows = [
  { newSku: 'W RN03 PNK', oldSku: 'W TM01 PNK', colour: 'Pink' },
  { newSku: 'W RN03 NVY', oldSku: 'W TM01 NVY', colour: 'Navy' },
];

const COSTS = {
  garmentsPerKg: 6,
  stitchingCost: 380,
  brandLogoCost: 5,
  neckTwillCost: 0,
  reflectorsCost: 0,
  fusingCost: 0,
  accessoriesCost: 0,
  brandTagCost: 5,
  sizeTagCost: 0,
  packagingCost: 12,
  inwardShipping: 10,
  proposedMrp: 849,
};

(async () => {
  await prisma.$transaction(async (tx) => {
    const pt = await tx.productType.findFirst({ where: { name: TYPE } });
    if (!pt) throw new Error(`ProductType "${TYPE}" not found`);
    const garmenting = await tx.garmentingLocation.findFirst({ where: { name: GARMENTING_AT } });
    if (!garmenting) throw new Error(`GarmentingLocation "${GARMENTING_AT}" not found`);
    const fabric = await tx.fabricMaster.findUnique({ where: { fabricName: FABRIC_NAME } });
    if (!fabric || fabric.mrp == null) throw new Error(`FabricMaster "${FABRIC_NAME}" missing mrp`);
    const fabricCostPerKg = Number(fabric.mrp);
    console.log(`Resolved fabric "${FABRIC_NAME}" mrp=${fabricCostPerKg}`);

    for (const r of rows) {
      const existing = await tx.productMaster.findUnique({ where: { skuCode: r.newSku } });
      if (existing) { console.log(`SKIP ${r.newSku}: already exists`); continue; }
      const created = await tx.productMaster.create({
        data: {
          articleNumber: ARTICLE,
          skuCode: r.newSku,
          previousSkuCodes: [r.oldSku],
          styleNumber: '',
          productName: PRODUCT_NAME,
          type: TYPE,
          typeRefId: pt.id,
          gender: GENDER,
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
      console.log(`Created master ${r.newSku} (id=${created.id}) prev=${JSON.stringify(created.previousSkuCodes)}`);
    }

    // Current type == new type, so no ArticleHistory seed needed.

    const fab = await tx.fabricMaster.findUnique({ where: { fabricName: FABRIC_NAME } });
    if (fab && !fab.articleNumbers.includes(ARTICLE)) {
      await tx.fabricMaster.update({
        where: { fabricName: FABRIC_NAME },
        data: { articleNumbers: { set: [...fab.articleNumbers, ARTICLE] } },
      });
      console.log(`Linked ${ARTICLE} into FabricMaster.${FABRIC_NAME}.articleNumbers`);
    }
  });

  const after = await prisma.productMaster.findMany({
    where: { articleNumber: ARTICLE }, orderBy: { skuCode: 'asc' },
  });
  console.log('\n=== AFTER ===');
  for (const r of after) {
    console.log(`- ${r.skuCode} | prev=${JSON.stringify(r.previousSkuCodes)} | colour=${JSON.stringify(r.coloursAvailable)} | type=${r.type} | name=${r.productName} | fabric=${r.fabricName}/${r.fabricCostPerKg} | mrp=${r.proposedMrp}`);
  }
  await prisma.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
