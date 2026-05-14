import { db as prisma } from '../src/lib/db';
(async () => {
  const f = await prisma.fabricMaster.findUnique({ where: { fabricName: 'Mars' } });
  console.log('Mars:', f ? `mrp=${f.mrp}` : 'not found');
  await prisma.$disconnect();
})();
