import { db as prisma } from '../src/lib/db';
(async () => {
  const f = await prisma.fabricMaster.findUnique({ where: { fabricName: 'Dryfit' } });
  console.log(`Dryfit:`, f?.mrp);
  const c = await prisma.productMaster.findUnique({ where: { skuCode: 'W TI02 KOF' } });
  console.log(`W TI02 KOF:`, JSON.stringify({ colour: c?.coloursAvailable, styleNumber: c?.styleNumber, prev: c?.previousSkuCodes, fabric: c?.fabricName, fabricCost: c?.fabricCostPerKg, stitch: c?.stitchingCost, mrp: c?.proposedMrp, gKg: c?.garmentsPerKg, refl: c?.reflectorsCost }));
  await prisma.$disconnect();
})();
