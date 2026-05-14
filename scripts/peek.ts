import { db as prisma } from '../src/lib/db';
(async () => {
  const article = process.argv[2];
  const rows = await prisma.productMaster.findMany({ where: { articleNumber: article }, orderBy: { skuCode: 'asc' } });
  for (const r of rows) console.log(JSON.stringify({ sku: r.skuCode, c1: r.coloursAvailable, c2: r.colours2Available, f1: r.fabricName, f2: r.fabric2Name, f1Cost: r.fabricCostPerKg, f2Cost: r.fabric2CostPerKg, gKg: r.garmentsPerKg, gKg2: r.garmentsPerKg2, type: r.type, name: r.productName, style: r.styleNumber, stitch: r.stitchingCost, refl: r.reflectorsCost, fuse: r.fusingCost, acc: r.accessoriesCost, bt: r.brandTagCost, st: r.sizeTagCost, pkg: r.packagingCost, mrp: r.proposedMrp, inShip: r.inwardShipping }));
  await prisma.$disconnect();
})();
