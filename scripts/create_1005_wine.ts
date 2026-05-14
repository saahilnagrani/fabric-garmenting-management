import { db as prisma } from '../src/lib/db';

const ARTICLE = '1005';
const SKU = 'W TB01 WIN';
const PRODUCT_NAME = 'Athena';
const TYPE = 'Tank Bra Combo';
const GARMENTING_AT = 'Mumtaz';
const FABRIC_1 = 'Spectra';
const FABRIC_2 = 'Mirror';

const COSTS = {
  garmentsPerKg: 4,
  stitchingCost: 200,
  brandLogoCost: 5,
  neckTwillCost: 0,
  reflectorsCost: 8,
  fusingCost: 0,
  accessoriesCost: 35,
  brandTagCost: 5,
  sizeTagCost: 2,
  packagingCost: 12,
  inwardShipping: 10,
  proposedMrp: 1099,
};

(async () => {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.productMaster.findUnique({ where: { skuCode: SKU } });
    if (existing) { console.log(`SKIP: ${SKU} already exists (id=${existing.id})`); return; }

    const pt = await tx.productType.findFirst({ where: { name: TYPE } });
    if (!pt) throw new Error(`ProductType "${TYPE}" not found`);

    const garmenting = await tx.garmentingLocation.findFirst({ where: { name: GARMENTING_AT } });
    if (!garmenting) throw new Error(`GarmentingLocation "${GARMENTING_AT}" not found`);

    const f1 = await tx.fabricMaster.findUnique({ where: { fabricName: FABRIC_1 } });
    if (!f1) throw new Error(`FabricMaster "${FABRIC_1}" not found`);
    const f2 = await tx.fabricMaster.findUnique({ where: { fabricName: FABRIC_2 } });
    if (!f2) throw new Error(`FabricMaster "${FABRIC_2}" not found`);
    const fabricCostPerKg = f1.mrp ? Number(f1.mrp) : null;
    const fabric2CostPerKg = f2.mrp ? Number(f2.mrp) : null;
    console.log(`Fabric MRPs: ${FABRIC_1}=${fabricCostPerKg}, ${FABRIC_2}=${fabric2CostPerKg}`);

    const created = await tx.productMaster.create({
      data: {
        articleNumber: ARTICLE,
        skuCode: SKU,
        previousSkuCodes: [],
        styleNumber: '',
        productName: PRODUCT_NAME,
        type: TYPE,
        typeRefId: pt.id,
        gender: 'WOMENS',
        garmentingAt: GARMENTING_AT,
        garmentingAtId: garmenting.id,
        fabricName: FABRIC_1,
        fabric2Name: FABRIC_2,
        coloursAvailable: ['Wine'],
        colours2Available: [],
        colours3Available: [],
        colours4Available: [],
        garmentsPerKg: COSTS.garmentsPerKg,
        fabricCostPerKg,
        fabric2CostPerKg,
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
        isStrikedThrough: true,
      },
    });
    console.log(`Created striked-through master ${created.skuCode} (id=${created.id})`);

    // Link article number into both fabric masters' articleNumbers
    for (const fab of [f1, f2]) {
      if (!fab.articleNumbers.includes(ARTICLE)) {
        await tx.fabricMaster.update({
          where: { fabricName: fab.fabricName },
          data: { articleNumbers: { set: [...fab.articleNumbers, ARTICLE] } },
        });
        console.log(`Linked ${ARTICLE} into FabricMaster.${fab.fabricName}.articleNumbers`);
      }
    }
  });

  const after = await prisma.productMaster.findUnique({
    where: { skuCode: SKU },
    include: { typeRef: true, garmentingAtRef: true },
  });
  console.log('\n=== AFTER ===');
  if (after) {
    console.log(JSON.stringify({
      skuCode: after.skuCode,
      previousSkuCodes: after.previousSkuCodes,
      colour: after.coloursAvailable,
      type: after.type,
      gender: after.gender,
      productName: after.productName,
      fabric: `${after.fabricName} (${after.fabricCostPerKg}) + ${after.fabric2Name} (${after.fabric2CostPerKg})`,
      isStrikedThrough: after.isStrikedThrough,
      mrp: after.proposedMrp,
    }, null, 2));
  }
  await prisma.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
