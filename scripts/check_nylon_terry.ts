import { db as prisma } from '../src/lib/db';
(async () => {
  const masters = await prisma.productMaster.findMany({
    where: { OR: [{ fabricName: 'Nylon Terry' }, { fabric2Name: 'Nylon Terry' }] },
    select: { skuCode: true, articleNumber: true, fabricName: true, fabricCostPerKg: true, fabric2Name: true, fabric2CostPerKg: true },
  });
  console.log('=== ProductMaster ===');
  for (const m of masters) console.log(JSON.stringify(m));
  const orders = await prisma.product.findMany({
    where: { OR: [{ fabricName: 'Nylon Terry' }, { fabric2Name: 'Nylon Terry' }] },
    select: { id: true, articleNumber: true, skuCode: true, status: true, fabricName: true, fabricCostPerKg: true },
  });
  console.log(`\n=== Product orders (${orders.length}) ===`);
  for (const o of orders) console.log(JSON.stringify(o));
  await prisma.$disconnect();
})();
