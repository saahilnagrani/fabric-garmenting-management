import { db as prisma } from '../src/lib/db';
const article = process.argv[2];
(async () => {
  const rows = await prisma.productMaster.findMany({ where: { articleNumber: article }, orderBy: { skuCode: 'asc' } });
  for (const r of rows) console.log(JSON.stringify({ sku: r.skuCode, colour: r.coloursAvailable, fabric: r.fabricName, fabricCost: r.fabricCostPerKg, gKg: r.garmentsPerKg, type: r.type, name: r.productName, style: r.styleNumber, gender: r.gender, stitch: r.stitchingCost, refl: r.reflectorsCost, fuse: r.fusingCost, acc: r.accessoriesCost, bt: r.brandTagCost, st: r.sizeTagCost, pkg: r.packagingCost, mrp: r.proposedMrp, prev: r.previousSkuCodes }));
  await prisma.$disconnect();
})();
