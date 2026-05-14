import { db as prisma } from '../src/lib/db';

const PHASE1_ID = 'cmnna58fz0000pgu5te35njgf'; // Test Phase, number=1
const PHASE3_ID = 'cmmzvbpa7000bclu5sizzhnh8'; // Phase 3 - Nov Mid 2025

(async () => {
  await prisma.$transaction(async (tx) => {
    // Delete all article orders + fabric orders in Phase 1
    const delProducts = await tx.product.deleteMany({ where: { phaseId: PHASE1_ID } });
    console.log(`Deleted ${delProducts.count} Product orders from Phase 1`);
    const delFabric = await tx.fabricOrder.deleteMany({ where: { phaseId: PHASE1_ID } });
    console.log(`Deleted ${delFabric.count} Fabric orders from Phase 1`);

    // Look up shared refs
    const garm = await tx.garmentingLocation.findFirst({ where: { name: 'Garsem' } });
    if (!garm) throw new Error('Garsem not found');
    const bd = await tx.fabricMaster.findUnique({ where: { fabricName: 'Bubblegum Diamond' } });
    const nfl = await tx.fabricMaster.findUnique({ where: { fabricName: 'Nylon Feel Lycra' } });
    const uk = await tx.fabricMaster.findUnique({ where: { fabricName: 'Uniqlo Knit' } });
    if (!bd || !nfl || !uk) throw new Error('Fabric not found');

    // Common cost block for 3121
    const costs3121 = {
      stitchingCost: 102, brandLogoCost: 0, neckTwillCost: 0, reflectorsCost: 7,
      fusingCost: 7, accessoriesCost: 4, brandTagCost: 2, sizeTagCost: 5.3,
      packagingCost: 8.5, outwardShippingCost: 10, proposedMrp: 899,
    };
    const costs3122 = {
      stitchingCost: 62, brandLogoCost: 0, neckTwillCost: 0, reflectorsCost: 7,
      fusingCost: 7, accessoriesCost: 0, brandTagCost: 2, sizeTagCost: 5.3,
      packagingCost: 8, outwardShippingCost: 10, proposedMrp: 799,
    };
    const costs3123 = {
      stitchingCost: 172, brandLogoCost: 4.2, neckTwillCost: 0, reflectorsCost: 12,
      fusingCost: 14, accessoriesCost: 10, brandTagCost: 5, sizeTagCost: 0,
      packagingCost: 8.5, outwardShippingCost: 10, proposedMrp: 1095,
    };

    // 3121 — 3 orders, each total=112, expected & actual
    const rows3121 = [
      { sku: 'K RN01 NVY', colour: 'Navy' },
      { sku: 'K RN01 LMN', colour: 'Lemon Yellow' },
      { sku: 'K RN01 GRY', colour: 'Light Grey' },
    ];
    for (const r of rows3121) {
      const created = await tx.product.create({
        data: {
          phaseId: PHASE3_ID,
          orderDate: '15 Nov 2025',
          styleNumber: '',
          articleNumber: '3121',
          skuCode: r.sku,
          colourOrdered: r.colour,
          isRepeat: false,
          type: 'Kids Jacket with Zip',
          gender: 'KIDS',
          productName: 'Flyte',
          status: 'CUTTING_REPORT_RECEIVED',
          fabricVendorId: bd.vendorId,
          fabricName: 'Bubblegum Diamond',
          fabricCostPerKg: Number(bd.mrp),
          assumedFabricGarmentsPerKg: 4.5,
          garmentNumber: 112,
          actualStitchedXS: 0,
          actualStitchedS: 14,
          actualStitchedM: 28,
          actualStitchedL: 28,
          actualStitchedXL: 28,
          actualStitchedXXL: 14,
          garmentingAt: 'Garsem',
          garmentingAtId: garm.id,
          ...costs3121,
        },
      });
      console.log(`3121 ${r.sku} ${r.colour} -> ${created.id}`);
    }

    // 3122 — 2 orders, each total=155, expected & actual
    const rows3122 = [
      { sku: 'K RN02 BLU', colour: 'Sky Blue' },
      { sku: 'K RN02 GRY', colour: 'Light Grey' },
    ];
    for (const r of rows3122) {
      const created = await tx.product.create({
        data: {
          phaseId: PHASE3_ID,
          orderDate: '15 Nov 2025',
          styleNumber: '',
          articleNumber: '3122',
          skuCode: r.sku,
          colourOrdered: r.colour,
          isRepeat: false,
          type: 'Kids Round Neck with Half Sleeve',
          gender: 'KIDS',
          productName: 'Bounce',
          status: 'CUTTING_REPORT_RECEIVED',
          fabricVendorId: nfl.vendorId,
          fabricName: 'Nylon Feel Lycra',
          fabricCostPerKg: Number(nfl.mrp),
          assumedFabricGarmentsPerKg: 5.9,
          garmentNumber: 155,
          actualStitchedXS: 0,
          actualStitchedS: 19,
          actualStitchedM: 39,
          actualStitchedL: 39,
          actualStitchedXL: 39,
          actualStitchedXXL: 19,
          garmentingAt: 'Garsem',
          garmentingAtId: garm.id,
          ...costs3122,
        },
      });
      console.log(`3122 ${r.sku} ${r.colour} -> ${created.id}`);
    }

    // 3123 — 3 orders, expected only (no actualStitched), status=PLANNED
    const rows3123 = [
      { sku: 'K SET02 BLK', colour: 'Black', total: 21+43+43+43+21, gKg: 3.4 },
      { sku: 'K SET02 BLU', colour: 'Airforce Blue', total: 32+66+66+66+32, gKg: 3.5 },
      { sku: 'K SET02 ONI', colour: 'Onion', total: 32+66+66+66+32, gKg: 3.5 },
    ];
    for (const r of rows3123) {
      const created = await tx.product.create({
        data: {
          phaseId: PHASE3_ID,
          orderDate: '15 Nov 2025',
          styleNumber: '',
          articleNumber: '3123',
          skuCode: r.sku,
          colourOrdered: r.colour,
          isRepeat: false,
          type: 'Kids Round Neck with Shorts',
          gender: 'KIDS',
          productName: 'Aerokid',
          status: 'PLANNED',
          fabricVendorId: uk.vendorId,
          fabricName: 'Uniqlo Knit',
          fabricCostPerKg: Number(uk.mrp),
          assumedFabricGarmentsPerKg: r.gKg,
          garmentNumber: r.total,
          garmentingAt: 'Garsem',
          garmentingAtId: garm.id,
          ...costs3123,
        },
      });
      console.log(`3123 ${r.sku} ${r.colour} qty=${r.total} -> ${created.id}`);
    }
  });

  await prisma.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
