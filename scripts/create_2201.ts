import { db as prisma } from '../src/lib/db';

const ARTICLE = '2201';
const TYPE = 'Kids Set';
const PRODUCT_NAME = 'Zentra';
const FABRIC = 'Melange';
const GARMENTING_AT = 'Mumtaz';

const rows = [
  { sku: 'K SET01 GRY', colour: 'Grey', gKg: 2.68 },
  { sku: 'K SET01 NVY', colour: 'Navy', gKg: 2.4 },
  { sku: 'K SET01 PNK', colour: 'Pink', gKg: 2.7 },
];

const COSTS = {
  stitchingCost: 360, brandLogoCost: 2, neckTwillCost: 0, reflectorsCost: 5,
  fusingCost: 0, accessoriesCost: 0, brandTagCost: 5, sizeTagCost: 2,
  packagingCost: 8.5, inwardShipping: 10, proposedMrp: 1099,
};

(async () => {
  await prisma.$transaction(async (tx) => {
    let pt = await tx.productType.findFirst({ where: { name: TYPE } });
    if (!pt) {
      pt = await tx.productType.create({ data: { name: TYPE } });
      console.log(`Created ProductType "${TYPE}" (id=${pt.id})`);
    }
    const garmenting = await tx.garmentingLocation.findFirst({ where: { name: GARMENTING_AT } });
    if (!garmenting) throw new Error(`GarmentingLocation "${GARMENTING_AT}" not found`);
    const fabric = await tx.fabricMaster.findUnique({ where: { fabricName: FABRIC } });
    if (!fabric?.mrp) throw new Error(`FabricMaster "${FABRIC}" missing mrp`);
    const fabricCostPerKg = Number(fabric.mrp);

    for (const r of rows) {
      const created = await tx.productMaster.create({
        data: {
          articleNumber: ARTICLE,
          skuCode: r.sku,
          previousSkuCodes: [],
          styleNumber: '',
          productName: PRODUCT_NAME,
          type: TYPE,
          typeRefId: pt.id,
          gender: 'KIDS',
          garmentingAt: GARMENTING_AT,
          garmentingAtId: garmenting.id,
          fabricName: FABRIC,
          coloursAvailable: [r.colour],
          colours2Available: [],
          colours3Available: [],
          colours4Available: [],
          garmentsPerKg: r.gKg,
          fabricCostPerKg,
          ...COSTS,
        },
      });
      console.log(`Created ${created.skuCode} colour=${r.colour} g/kg=${r.gKg}`);
    }

    const fab = await tx.fabricMaster.findUnique({ where: { fabricName: FABRIC } });
    if (fab && !fab.articleNumbers.includes(ARTICLE)) {
      await tx.fabricMaster.update({
        where: { fabricName: FABRIC },
        data: { articleNumbers: { set: [...fab.articleNumbers, ARTICLE] } },
      });
      console.log(`Linked ${ARTICLE} into FabricMaster.${FABRIC}.articleNumbers`);
    }
  });

  const after = await prisma.productMaster.findMany({ where: { articleNumber: ARTICLE }, orderBy: { skuCode: 'asc' } });
  console.log('\n=== AFTER ===');
  for (const r of after) {
    console.log(`- ${r.skuCode} | colour=${JSON.stringify(r.coloursAvailable)} | type=${r.type} | gender=${r.gender} | name=${r.productName} | fabric=${r.fabricName}/${r.fabricCostPerKg} | g/kg=${r.garmentsPerKg} | mrp=${r.proposedMrp}`);
  }
  await prisma.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
