import { db as prisma } from '../src/lib/db';

const ARTICLE = '3113';
const PHASE_ID = 'cmmzvbpa7000bclu5sizzhnh8'; // Phase 3 - Nov Mid 2025
const TYPE = 'Two Layered Shorts'; // historical; not a ProductType row
const PRODUCT_NAME = 'Duoflex';
const GARMENTING_AT = 'Garsem';

const orders = [
  { sku: 'W SH01 PNK', colour: 'Black/Rani Pink', garmentNumber: 196 },
  { sku: 'W SH01 BLU', colour: 'Black/Dawn Blue', garmentNumber: 259 },
];

const COSTS = {
  garmentsPerKg: 2,
  garmentsPerKg2: 5,
  stitchingCost: 119,
  brandLogoCost: 0,
  neckTwillCost: 0,
  reflectorsCost: 7,
  fusingCost: 7,
  accessoriesCost: 15,
  brandTagCost: 2,
  sizeTagCost: 5.3,
  packagingCost: 8.5,
  outwardShippingCost: 10, // = "inward shipping" per legacy field naming
  proposedMrp: 1049,
};

(async () => {
  await prisma.$transaction(async (tx) => {
    const phase = await tx.phase.findUnique({ where: { id: PHASE_ID } });
    if (!phase) throw new Error('Phase not found');
    console.log(`Phase: ${phase.name}`);

    const garmenting = await tx.garmentingLocation.findFirst({ where: { name: GARMENTING_AT } });
    if (!garmenting) throw new Error('Garmenting location not found');

    const nsPoly = await tx.fabricMaster.findUnique({ where: { fabricName: 'NS Poly' } });
    if (!nsPoly) throw new Error('NS Poly not found');
    const importedLycra = await tx.fabricMaster.findUnique({ where: { fabricName: 'Imported Lycra (Poly Spandex)' } });
    if (!importedLycra) throw new Error('Imported Lycra not found');
    const fabricCostPerKg = Number(nsPoly.mrp);
    const fabric2CostPerKg = Number(importedLycra.mrp);
    console.log(`Fabric 1: NS Poly (${nsPoly.vendorId}) cost=${fabricCostPerKg}`);
    console.log(`Fabric 2: Imported Lycra (${importedLycra.vendorId}) cost=${fabric2CostPerKg}`);

    for (const o of orders) {
      const created = await tx.product.create({
        data: {
          phaseId: PHASE_ID,
          orderDate: '15 Nov 2025',
          styleNumber: '',
          articleNumber: ARTICLE,
          skuCode: o.sku,
          colourOrdered: o.colour,
          isRepeat: false,
          type: TYPE,
          gender: 'WOMENS',
          productName: PRODUCT_NAME,
          status: 'PLANNED',
          fabricVendorId: nsPoly.vendorId,
          fabricName: 'NS Poly',
          fabricCostPerKg,
          assumedFabricGarmentsPerKg: COSTS.garmentsPerKg,
          fabric2Name: 'Imported Lycra (Poly Spandex)',
          fabric2VendorId: importedLycra.vendorId,
          fabric2CostPerKg,
          assumedFabric2GarmentsPerKg: COSTS.garmentsPerKg2,
          garmentNumber: o.garmentNumber,
          stitchingCost: COSTS.stitchingCost,
          brandLogoCost: COSTS.brandLogoCost,
          neckTwillCost: COSTS.neckTwillCost,
          reflectorsCost: COSTS.reflectorsCost,
          fusingCost: COSTS.fusingCost,
          accessoriesCost: COSTS.accessoriesCost,
          brandTagCost: COSTS.brandTagCost,
          sizeTagCost: COSTS.sizeTagCost,
          packagingCost: COSTS.packagingCost,
          outwardShippingCost: COSTS.outwardShippingCost,
          proposedMrp: COSTS.proposedMrp,
          garmentingAt: GARMENTING_AT,
          garmentingAtId: garmenting.id,
        },
      });
      console.log(`Created order ${created.id} | sku=${created.skuCode} | colour=${created.colourOrdered} | qty=${created.garmentNumber}`);
    }
  });

  console.log('\n=== AFTER ===');
  const after = await prisma.product.findMany({
    where: { articleNumber: ARTICLE },
    select: { id: true, skuCode: true, colourOrdered: true, garmentNumber: true, type: true, fabricName: true, fabric2Name: true, status: true },
    orderBy: { skuCode: 'asc' },
  });
  for (const o of after) console.log(JSON.stringify(o));
  await prisma.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
