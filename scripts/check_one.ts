import { db as prisma } from '../src/lib/db';
const article = process.argv[2];
(async () => {
  const rows = await prisma.productMaster.findMany({ where: { articleNumber: article }, orderBy: { skuCode: 'asc' } });
  for (const r of rows) console.log(JSON.stringify({ sku: r.skuCode, colour: r.coloursAvailable, fabric: r.fabricName, fabricCost: r.fabricCostPerKg, gKg: r.garmentsPerKg, type: r.type, name: r.productName, style: r.styleNumber, gender: r.gender, struck: r.isStrikedThrough, prev: r.previousSkuCodes }));
  const orders = await prisma.product.findMany({ where: { articleNumber: article }, select: { skuCode: true, status: true, fabricName: true, type: true, productName: true, styleNumber: true, colourOrdered: true, phaseId: true } });
  console.log(`\nOrders (${orders.length}):`);
  for (const o of orders) console.log(JSON.stringify(o));
  await prisma.$disconnect();
})();
