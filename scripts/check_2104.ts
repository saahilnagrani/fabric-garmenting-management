import { db as prisma } from '../src/lib/db';
(async () => {
  const rows = await prisma.productMaster.findMany({ where: { articleNumber: '2104' }, select: { skuCode: true, coloursAvailable: true, fabricName: true, fabricCostPerKg: true, garmentsPerKg: true, stitchingCost: true, proposedMrp: true } });
  for (const r of rows) console.log(JSON.stringify(r));
  await prisma.$disconnect();
})();
