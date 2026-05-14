import { db as prisma } from '../src/lib/db';

const PHASE_ID = 'cmmzvbpa7000bclu5sizzhnh8'; // Phase 3 - Nov Mid 2025
const ARTICLE = '3114';

const G_KG = 0.8;
const COSTS = {
  stitchingCost: 85, brandLogoCost: 0, neckTwillCost: 0, reflectorsCost: 17,
  fusingCost: 11, accessoriesCost: 15, brandTagCost: 2, sizeTagCost: 5.3,
  packagingCost: 8.5, outwardShippingCost: 10, proposedMrp: 899,
};

(async () => {
  await prisma.$transaction(async (tx) => {
    const garm = await tx.garmentingLocation.findFirst({ where: { name: 'Garsem' } });
    if (!garm) throw new Error('Garsem not found');
    const fabric = await tx.fabricMaster.findUnique({ where: { fabricName: 'NS Poly' } });
    if (!fabric) throw new Error('NS Poly not found');

    // Create BLK order
    const blkTotal = 50 + 101 + 101 + 101 + 50;
    const blk = await tx.product.create({
      data: {
        phaseId: PHASE_ID,
        orderDate: '15 Nov 2025',
        styleNumber: '',
        articleNumber: ARTICLE,
        skuCode: 'W SH02 BLK',
        colourOrdered: 'Black',
        isRepeat: false,
        type: 'Womens Shorts',
        gender: 'WOMENS',
        productName: 'Coreflex',
        status: 'CUTTING_REPORT_RECEIVED',
        fabricVendorId: fabric.vendorId,
        fabricName: 'NS Poly',
        fabricCostPerKg: Number(fabric.mrp),
        assumedFabricGarmentsPerKg: G_KG,
        garmentNumber: blkTotal,
        actualStitchedXS: 0,
        actualStitchedS: 50,
        actualStitchedM: 101,
        actualStitchedL: 101,
        actualStitchedXL: 101,
        actualStitchedXXL: 50,
        garmentingAt: 'Garsem',
        garmentingAtId: garm.id,
        ...COSTS,
      },
    });
    console.log(`Created BLK order ${blk.id} | qty=${blkTotal}`);

    // Update existing GRY order
    const gry = await tx.product.findFirst({
      where: { articleNumber: ARTICLE, skuCode: 'W SH02 GRY', phaseId: PHASE_ID },
    });
    if (!gry) throw new Error('Existing GRY order not found');
    await tx.product.update({
      where: { id: gry.id },
      data: {
        actualStitchedXS: 0,
        actualStitchedS: 56,
        actualStitchedM: 114,
        actualStitchedL: 114,
        actualStitchedXL: 114,
        actualStitchedXXL: 57,
      },
    });
    console.log(`Updated GRY order ${gry.id} actualStitched`);
  });

  const after = await prisma.product.findMany({
    where: { articleNumber: ARTICLE },
    select: { skuCode: true, status: true, garmentNumber: true, actualStitchedS: true, actualStitchedM: true, actualStitchedL: true, actualStitchedXL: true, actualStitchedXXL: true },
    orderBy: { skuCode: 'asc' },
  });
  console.log('\n=== AFTER ===');
  for (const o of after) console.log(JSON.stringify(o));
  await prisma.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
