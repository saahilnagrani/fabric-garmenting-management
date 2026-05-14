import { db as prisma } from '../src/lib/db';
(async () => {
  const rows = await prisma.productMaster.findMany({ where: { articleNumber: '2104' }, orderBy: { skuCode: 'asc' } });
  for (const r of rows) console.log(JSON.stringify({ sku: r.skuCode, colour: r.coloursAvailable, gKg: r.garmentsPerKg, stitch: r.stitchingCost, logo: r.brandLogoCost, neck: r.neckTwillCost, refl: r.reflectorsCost, fuse: r.fusingCost, acc: r.accessoriesCost, bt: r.brandTagCost, st: r.sizeTagCost, pkg: r.packagingCost, inShip: r.inwardShipping, mrp: r.proposedMrp, style: r.styleNumber }));
  await prisma.$disconnect();
})();
