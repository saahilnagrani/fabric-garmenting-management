import { db as prisma } from '../src/lib/db';

const ARTICLE = '1002';
const NEW_TYPE = 'Round Neck T-shirt';
const OLD_TYPE = 'Melange Round Neck T-shirt';
const PRODUCT_NAME = 'Cloudflex';
const FABRIC_NAME = 'Inka Soft';
const GARMENTING_AT = 'Mumtaz';

type RowSpec = {
  newSku: string;
  oldSku: string;
  colour: string;
};
const rows: RowSpec[] = [
  { newSku: 'W RN02 GRN', oldSku: 'W MLT01 GRN', colour: 'Pista Green' },
  { newSku: 'W RN02 RED', oldSku: 'W MLT01 RED', colour: 'Red' },
];

const COSTS = {
  garmentsPerKg: 7,
  stitchingCost: 100,
  brandLogoCost: 5,
  neckTwillCost: 0,
  reflectorsCost: 8,
  fusingCost: 0,
  accessoriesCost: 0,
  brandTagCost: 5,
  sizeTagCost: 2,
  packagingCost: 12,
  inwardShipping: 10,
  proposedMrp: 699,
};

(async () => {
  await prisma.$transaction(async (tx) => {
    // Resolve ProductType
    let pt = await tx.productType.findFirst({ where: { name: NEW_TYPE } });
    if (!pt) {
      pt = await tx.productType.create({ data: { name: NEW_TYPE } });
      console.log(`Created ProductType "${NEW_TYPE}" (id=${pt.id})`);
    } else {
      console.log(`Reusing ProductType "${NEW_TYPE}" (id=${pt.id})`);
    }

    // Resolve GarmentingLocation
    const garmenting = await tx.garmentingLocation.findFirst({ where: { name: GARMENTING_AT } });
    if (!garmenting) throw new Error(`GarmentingLocation "${GARMENTING_AT}" not found`);

    // Resolve fabric → fabricCostPerKg = mrp
    const fabric = await tx.fabricMaster.findUnique({ where: { fabricName: FABRIC_NAME } });
    if (!fabric) throw new Error(`FabricMaster "${FABRIC_NAME}" not found`);
    const fabricCostPerKg = fabric.mrp ? Number(fabric.mrp) : null;
    if (fabricCostPerKg == null) throw new Error(`FabricMaster "${FABRIC_NAME}" has no mrp set`);
    console.log(`Resolved fabric "${FABRIC_NAME}" mrp=${fabricCostPerKg}`);

    // Create master rows
    for (const r of rows) {
      const existing = await tx.productMaster.findUnique({ where: { skuCode: r.newSku } });
      if (existing) { console.log(`SKIP create ${r.newSku}: already exists`); continue; }

      const created = await tx.productMaster.create({
        data: {
          articleNumber: ARTICLE,
          skuCode: r.newSku,
          previousSkuCodes: [r.oldSku],
          styleNumber: '',
          productName: PRODUCT_NAME,
          type: NEW_TYPE,
          typeRefId: pt.id,
          gender: 'WOMENS',
          garmentingAt: GARMENTING_AT,
          garmentingAtId: garmenting.id,
          fabricName: FABRIC_NAME,
          coloursAvailable: [r.colour],
          colours2Available: [],
          colours3Available: [],
          colours4Available: [],
          garmentsPerKg: COSTS.garmentsPerKg,
          fabricCostPerKg: fabricCostPerKg,
          stitchingCost: COSTS.stitchingCost,
          brandLogoCost: COSTS.brandLogoCost,
          neckTwillCost: COSTS.neckTwillCost,
          reflectorsCost: COSTS.reflectorsCost,
          fusingCost: COSTS.fusingCost,
          accessoriesCost: COSTS.accessoriesCost,
          brandTagCost: COSTS.brandTagCost,
          sizeTagCost: COSTS.sizeTagCost,
          packagingCost: COSTS.packagingCost,
          inwardShipping: COSTS.inwardShipping,
          proposedMrp: COSTS.proposedMrp,
        },
      });
      console.log(`Created master ${r.newSku} (id=${created.id}) prev=${JSON.stringify(created.previousSkuCodes)}`);
    }

    // Seed ArticleHistory.previousTypes with the old type
    await tx.articleHistory.upsert({
      where: { articleNumber: ARTICLE },
      create: { articleNumber: ARTICLE, previousTypes: [OLD_TYPE] },
      update: { previousTypes: { set: [OLD_TYPE] } },
    });
    console.log(`ArticleHistory seeded with previousTypes=["${OLD_TYPE}"]`);

    // Link article to FabricMaster.articleNumbers
    const fab = await tx.fabricMaster.findUnique({ where: { fabricName: FABRIC_NAME } });
    if (fab && !fab.articleNumbers.includes(ARTICLE)) {
      await tx.fabricMaster.update({
        where: { fabricName: FABRIC_NAME },
        data: { articleNumbers: { set: [...fab.articleNumbers, ARTICLE] } },
      });
      console.log(`Linked ${ARTICLE} into FabricMaster.${FABRIC_NAME}.articleNumbers`);
    }
  });

  // Verify
  const after = await prisma.productMaster.findMany({
    where: { articleNumber: ARTICLE },
    include: { typeRef: true, garmentingAtRef: true },
    orderBy: { skuCode: 'asc' },
  });
  console.log('\n=== AFTER ===');
  for (const r of after) {
    console.log(`- skuCode=${r.skuCode} | prev=${JSON.stringify(r.previousSkuCodes)} | type=${r.type}/${r.typeRef?.name} | gender=${r.gender} | colour=${JSON.stringify(r.coloursAvailable)} | name=${r.productName} | fabric=${r.fabricName}/${fmt(r.fabricCostPerKg)} | garmenting=${r.garmentingAt}/${r.garmentingAtRef?.name}`);
    console.log(`  costs: stitch=${r.stitchingCost} logo=${r.brandLogoCost} neck=${r.neckTwillCost} refl=${r.reflectorsCost} fuse=${r.fusingCost} acc=${r.accessoriesCost} bt=${r.brandTagCost} st=${r.sizeTagCost} pkg=${r.packagingCost} inShip=${r.inwardShipping} mrp=${r.proposedMrp}`);
  }
  const hist = await prisma.articleHistory.findUnique({ where: { articleNumber: ARTICLE } });
  console.log(`\nArticleHistory: previousTypes=${JSON.stringify(hist?.previousTypes)}`);
  await prisma.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });

function fmt(v: unknown) { return v == null ? 'null' : String(v); }
