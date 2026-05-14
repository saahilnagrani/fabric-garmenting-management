import { db as prisma } from '../src/lib/db';

const ARTICLE = '2006';
const TYPE = 'Trackpants';
const PRODUCT_NAME = 'Brezza';
const FABRIC_NAME = 'Dryfit';
const GARMENTING_AT = 'Mumtaz';
const NEW_SKU = 'W TP01 GRY';
const OLD_SKU = 'W TI01 GRY';
const COLOUR = 'Light Grey';

const COSTS = {
  garmentsPerKg: 2.42,
  stitchingCost: 180,
  brandLogoCost: 5,
  neckTwillCost: 0,
  reflectorsCost: 5,
  fusingCost: 0,
  accessoriesCost: 70,
  brandTagCost: 5,
  sizeTagCost: 2,
  packagingCost: 8.5,
  inwardShipping: 10,
  proposedMrp: 1199,
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
    const fabric = await tx.fabricMaster.findUnique({ where: { fabricName: FABRIC_NAME } });
    if (!fabric || fabric.mrp == null) throw new Error(`FabricMaster "${FABRIC_NAME}" missing mrp`);
    const fabricCostPerKg = Number(fabric.mrp);

    const existing = await tx.productMaster.findUnique({ where: { skuCode: NEW_SKU } });
    if (existing) { console.log(`SKIP ${NEW_SKU}: already exists`); }
    else {
      const created = await tx.productMaster.create({
        data: {
          articleNumber: ARTICLE,
          skuCode: NEW_SKU,
          previousSkuCodes: [OLD_SKU],
          styleNumber: '',
          productName: PRODUCT_NAME,
          type: TYPE,
          typeRefId: pt.id,
          gender: 'WOMENS',
          garmentingAt: GARMENTING_AT,
          garmentingAtId: garmenting.id,
          fabricName: FABRIC_NAME,
          coloursAvailable: [COLOUR],
          colours2Available: [],
          colours3Available: [],
          colours4Available: [],
          fabricCostPerKg,
          ...COSTS,
        },
      });
      console.log(`Created ${created.skuCode} | colour=${COLOUR} | g/kg=${COSTS.garmentsPerKg} | prev=${JSON.stringify(created.previousSkuCodes)}`);
    }

    const fab = await tx.fabricMaster.findUnique({ where: { fabricName: FABRIC_NAME } });
    if (fab && !fab.articleNumbers.includes(ARTICLE)) {
      await tx.fabricMaster.update({
        where: { fabricName: FABRIC_NAME },
        data: { articleNumbers: { set: [...fab.articleNumbers, ARTICLE] } },
      });
      console.log(`Linked ${ARTICLE} into FabricMaster.${FABRIC_NAME}.articleNumbers`);
    }
  });

  const after = await prisma.productMaster.findMany({ where: { articleNumber: ARTICLE } });
  console.log('\n=== AFTER ===');
  for (const r of after) {
    console.log(`- ${r.skuCode} | prev=${JSON.stringify(r.previousSkuCodes)} | colour=${JSON.stringify(r.coloursAvailable)} | type=${r.type} | name=${r.productName} | fabric=${r.fabricName}/${r.fabricCostPerKg} | g/kg=${r.garmentsPerKg} | mrp=${r.proposedMrp}`);
  }
  await prisma.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
