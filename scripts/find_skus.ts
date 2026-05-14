import { db as prisma } from '../src/lib/db';
(async () => {
  const skus = process.argv.slice(2);
  for (const s of skus) {
    const cur = await prisma.productMaster.findUnique({ where: { skuCode: s }, select: { articleNumber: true, skuCode: true, type: true, productName: true, coloursAvailable: true, gender: true, fabricName: true } });
    const prev = await prisma.productMaster.findFirst({ where: { previousSkuCodes: { has: s } }, select: { articleNumber: true, skuCode: true, previousSkuCodes: true } });
    console.log(s, '\n  current:', cur ? JSON.stringify(cur) : 'none', '\n  prevHit:', prev ? JSON.stringify(prev) : 'none');
  }
  await prisma.$disconnect();
})();
