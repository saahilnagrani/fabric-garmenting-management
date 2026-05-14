import { db as prisma } from '../src/lib/db';
const articleNum = process.argv[2];
const fabricNames = process.argv[3]?.split(',') ?? [];
const types = process.argv[4]?.split(',') ?? [];
const skus = process.argv[5]?.split(',') ?? [];
const garmenting = process.argv[6]?.split(',') ?? [];
(async () => {
  for (const fn of fabricNames) {
    const f = await prisma.fabricMaster.findUnique({ where: { fabricName: fn } });
    console.log(`Fabric ${fn}:`, f ? `mrp=${f.mrp}` : 'MISSING');
  }
  for (const t of types) {
    const pt = await prisma.productType.findFirst({ where: { name: t } });
    console.log(`Type ${t}:`, pt ? 'exists' : 'MISSING');
  }
  for (const l of garmenting) {
    const g = await prisma.garmentingLocation.findFirst({ where: { name: l } });
    console.log(`Garmenting ${l}:`, g ? 'exists' : 'MISSING');
  }
  for (const s of skus) {
    const r = await prisma.productMaster.findUnique({ where: { skuCode: s } });
    console.log(`SKU ${s}:`, r ? `EXISTS articleNumber=${r.articleNumber}` : 'free');
  }
  if (articleNum) {
    const ms = await prisma.productMaster.findMany({ where: { articleNumber: articleNum }, select: { skuCode: true } });
    console.log(`Article ${articleNum} master:`, ms.length, ms.map(m => m.skuCode));
    const o = await prisma.product.count({ where: { articleNumber: articleNum } });
    console.log(`Article ${articleNum} orders:`, o);
  }
  await prisma.$disconnect();
})();
