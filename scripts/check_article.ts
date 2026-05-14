import { db as prisma } from '../src/lib/db';
const articleNumber = process.argv[2];
(async () => {
  const rows = await prisma.productMaster.findMany({
    where: { articleNumber },
    include: {
      typeRef: true,
      garmentingAtRef: true,
    },
    orderBy: { skuCode: 'asc' },
  });
  for (const r of rows) {
    console.log('---');
    console.log('skuCode:', r.skuCode);
    console.log('styleNumber:', r.styleNumber);
    console.log('articleNumber:', r.articleNumber);
    console.log('productName:', r.productName);
    console.log('type:', r.type, '| typeRef:', r.typeRef?.name ?? null);
    console.log('gender:', r.gender);
    console.log('garmentingAt:', r.garmentingAt, '| garmentingAtRef:', r.garmentingAtRef?.name ?? null);
    console.log('fabricName:', r.fabricName);
    console.log('coloursAvailable:', r.coloursAvailable);
    console.log('fabric2Name:', r.fabric2Name);
    console.log('colours2Available:', r.colours2Available);
    console.log('garmentsPerKg:', r.garmentsPerKg, '| f2:', r.garmentsPerKg2);
    console.log('cuttingReportGarmentsPerKg:', r.cuttingReportGarmentsPerKg, '| f2:', r.cuttingReportGarmentsPerKg2);
    console.log('stitchingCost:', r.stitchingCost);
    console.log('brandLogoCost:', r.brandLogoCost);
    console.log('neckTwillCost:', r.neckTwillCost);
    console.log('reflectorsCost:', r.reflectorsCost);
    console.log('fusingCost:', r.fusingCost);
    console.log('accessoriesCost:', r.accessoriesCost);
    console.log('brandTagCost:', r.brandTagCost);
    console.log('sizeTagCost:', r.sizeTagCost);
    console.log('packagingCost:', r.packagingCost);
    console.log('fabricCostPerKg:', r.fabricCostPerKg, '| f2:', r.fabric2CostPerKg);
    console.log('inwardShipping:', r.inwardShipping);
    console.log('proposedMrp:', r.proposedMrp, '| onlineMrp:', r.onlineMrp);
    console.log('isStrikedThrough:', r.isStrikedThrough);
  }
  if (rows.length === 0) console.log('NO ROWS for articleNumber=' + articleNumber);
  await prisma.$disconnect();
})();
