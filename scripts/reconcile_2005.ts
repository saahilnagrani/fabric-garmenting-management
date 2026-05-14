import { db as prisma } from '../src/lib/db';

const ARTICLE = '2005';
const TYPE = 'Tights';
const PRODUCT_NAME = 'Moveon';
const GARMENTING_AT = 'Mumtaz';

const KOFEE_OLD_SKU = 'W TI01 COF';
const KOFEE_CURRENT_SKU = 'W TI02 KOF';

// Discontinued (striked-through) historical-Dryfit rows to create
const HISTORICAL_DRYFIT = [
  { newSku: 'W TI02 BLU', oldSku: 'W TI01 PBL', colour: 'Petrol Blue', garmentsPerKg: 2.94, reflectorsCost: 5 },
  { newSku: 'W TI02 WIN', oldSku: 'W TI01 WIN', colour: 'Wine', garmentsPerKg: 2.8, reflectorsCost: 8 },
];

const SHARED_COSTS = {
  stitchingCost: 190,
  brandLogoCost: 5,
  neckTwillCost: 0,
  fusingCost: 0,
  accessoriesCost: 10,
  brandTagCost: 5,
  sizeTagCost: 2,
  packagingCost: 12,
  inwardShipping: 10,
  proposedMrp: 1199,
};

(async () => {
  await prisma.$transaction(async (tx) => {
    const pt = await tx.productType.findFirst({ where: { name: TYPE } });
    if (!pt) throw new Error(`ProductType "${TYPE}" not found`);
    const garmenting = await tx.garmentingLocation.findFirst({ where: { name: GARMENTING_AT } });
    if (!garmenting) throw new Error(`GarmentingLocation "${GARMENTING_AT}" not found`);
    const dryfit = await tx.fabricMaster.findUnique({ where: { fabricName: 'Dryfit' } });
    if (!dryfit || dryfit.mrp == null) throw new Error('Dryfit missing mrp');
    const dryfitCost = Number(dryfit.mrp);
    console.log(`Dryfit fabricCostPerKg=${dryfitCost}`);

    // 1) Update existing Kofee row: styleNumber="", seed previousSkuCodes
    const kofee = await tx.productMaster.findUnique({ where: { skuCode: KOFEE_CURRENT_SKU } });
    if (kofee) {
      const merged = kofee.previousSkuCodes.includes(KOFEE_OLD_SKU)
        ? kofee.previousSkuCodes
        : [...kofee.previousSkuCodes, KOFEE_OLD_SKU];
      await tx.productMaster.update({
        where: { id: kofee.id },
        data: { styleNumber: '', previousSkuCodes: merged },
      });
      console.log(`Updated Kofee row ${KOFEE_CURRENT_SKU}: styleNumber="" prev=${JSON.stringify(merged)} (fabric/costs untouched)`);
    } else {
      console.log(`SKIP Kofee update: ${KOFEE_CURRENT_SKU} not found`);
    }

    // 2) Create historical Dryfit rows striked-through
    for (const r of HISTORICAL_DRYFIT) {
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
          gender: 'WOMENS',
          garmentingAt: GARMENTING_AT,
          garmentingAtId: garmenting.id,
          fabricName: 'Dryfit',
          coloursAvailable: [r.colour],
          colours2Available: [],
          colours3Available: [],
          colours4Available: [],
          garmentsPerKg: r.garmentsPerKg,
          fabricCostPerKg: dryfitCost,
          reflectorsCost: r.reflectorsCost,
          ...SHARED_COSTS,
          isStrikedThrough: true,
        },
      });
      console.log(`Created struck-through ${created.skuCode} colour=${r.colour} g/kg=${r.garmentsPerKg} refl=${r.reflectorsCost} prev=${JSON.stringify(created.previousSkuCodes)}`);
    }

    // Link 2005 into Dryfit FabricMaster.articleNumbers
    const fab = await tx.fabricMaster.findUnique({ where: { fabricName: 'Dryfit' } });
    if (fab && !fab.articleNumbers.includes(ARTICLE)) {
      await tx.fabricMaster.update({
        where: { fabricName: 'Dryfit' },
        data: { articleNumbers: { set: [...fab.articleNumbers, ARTICLE] } },
      });
      console.log(`Linked ${ARTICLE} into FabricMaster.Dryfit.articleNumbers`);
    }
  });

  console.log('\n=== AFTER ===');
  const after = await prisma.productMaster.findMany({ where: { articleNumber: ARTICLE }, orderBy: { skuCode: 'asc' } });
  for (const r of after) {
    console.log(`- ${r.skuCode} | prev=${JSON.stringify(r.previousSkuCodes)} | colour=${JSON.stringify(r.coloursAvailable)} | fabric=${r.fabricName}/${r.fabricCostPerKg} | g/kg=${r.garmentsPerKg} | refl=${r.reflectorsCost} | mrp=${r.proposedMrp} | active=${!r.isStrikedThrough}`);
  }
  await prisma.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
