import { db as prisma } from '../src/lib/db';
const article = process.argv[2];
(async () => {
  const rows = await prisma.productMaster.findMany({ where: { articleNumber: article }, select: { skuCode: true, coloursAvailable: true, type: true, productName: true, styleNumber: true, gender: true, isStrikedThrough: true, previousSkuCodes: true }, orderBy: { skuCode: 'asc' } });
  for (const r of rows) console.log(JSON.stringify(r));
  console.log(`(${rows.length} rows)`);
  await prisma.$disconnect();
})();
