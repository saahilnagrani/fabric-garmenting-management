import { db as prisma } from '../src/lib/db';
(async () => {
  const targets = ['W RN07 BLK', 'W RN07 BLU'];
  for (const t of targets) {
    const m = await prisma.productMaster.findUnique({ where: { skuCode: t } });
    console.log(t, m ? `EXISTS articleNumber=${m.articleNumber} colour=${JSON.stringify(m.coloursAvailable)}` : 'free');
  }
  const ms = await prisma.productMaster.findMany({ where: { articleNumber: '3112' }, select: { skuCode: true, previousSkuCodes: true, coloursAvailable: true, type: true, productName: true, gender: true } });
  console.log('\n3112 master rows:');
  for (const m of ms) console.log(JSON.stringify(m));
  const orders = await prisma.product.findMany({ where: { articleNumber: '3112' }, select: { skuCode: true, status: true, gender: true } });
  console.log(`\n3112 orders (${orders.length}):`);
  for (const o of orders) console.log(JSON.stringify(o));
  await prisma.$disconnect();
})();
