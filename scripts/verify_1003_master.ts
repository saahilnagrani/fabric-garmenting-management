import { db as prisma } from '../src/lib/db';
(async () => {
  const ms = await prisma.productMaster.findMany({
    where: { articleNumber: '1003' },
    select: { skuCode: true, previousSkuCodes: true, productName: true, type: true, gender: true },
  });
  for (const m of ms) console.log(JSON.stringify(m));
  await prisma.$disconnect();
})();
