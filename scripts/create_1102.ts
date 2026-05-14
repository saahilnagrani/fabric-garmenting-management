import { db as prisma } from '../src/lib/db';

const ARTICLE = '1102';
const NEW_TYPE = 'Round Neck T-shirt';
const OLD_TYPE = 'Soft Melange Round Neck T-shirt';
const PRODUCT_NAME = 'Cloudflex';
const FABRIC_NAME = 'Inka Soft';
const GARMENTING_AT = 'Walknit';
const GENDER = 'MENS' as const;

const rows = [
  { newSku: 'M RN02 PUR', oldSku: 'M MLT01 PUR', colour: 'Deep Purple' },
  { newSku: 'M RN02 BEI', oldSku: 'M MLT01 BEI', colour: 'Beige' },
  { newSku: 'M RN02 GRY', oldSku: 'M MLT01 LGR', colour: 'Light Grey' },
  { newSku: 'M RN02 BLU', oldSku: 'M MLT01 BLU', colour: 'Navy Blue' },
];

const COSTS = {
  garmentsPerKg: 6,
  stitchingCost: 105,
  brandLogoCost: 5,
  neckTwillCost: 0,
  reflectorsCost: 18,
  fusingCost: 0,
  accessoriesCost: 0,
  brandTagCost: 5,
  sizeTagCost: 4,
  packagingCost: 12,
  inwardShipping: 10,
  proposedMrp: 699,
};

(async () => {
  await prisma.$transaction(async (tx) => {
    const pt = await tx.productType.findFirst({ where: { name: NEW_TYPE } });
    if (!pt) throw new Error(`ProductType "${NEW_TYPE}" not found`);
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
          type: NEW_TYPE,
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

    await tx.articleHistory.upsert({
      where: { articleNumber: ARTICLE },
      create: { articleNumber: ARTICLE, previousTypes: [OLD_TYPE] },
      update: { previousTypes: { set: [OLD_TYPE] } },
    });
    console.log(`ArticleHistory previousTypes=["${OLD_TYPE}"]`);

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
    where: { articleNumber: ARTICLE },
    include: { typeRef: true },
    orderBy: { skuCode: 'asc' },
  });
  console.log('\n=== AFTER ===');
  for (const r of after) {
    console.log(`- ${r.skuCode} | prev=${JSON.stringify(r.previousSkuCodes)} | colour=${JSON.stringify(r.coloursAvailable)} | type=${r.type} | gender=${r.gender} | name=${r.productName} | fabric=${r.fabricName}/${r.fabricCostPerKg} | mrp=${r.proposedMrp}`);
  }
  await prisma.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
