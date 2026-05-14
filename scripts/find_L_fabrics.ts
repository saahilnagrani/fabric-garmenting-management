import { db as prisma } from '../src/lib/db';
(async () => {
  const all = await prisma.fabricMaster.findMany({ where: { fabricName: { startsWith: 'L', mode: 'insensitive' } }, select: { fabricName: true, vendor: { select: { name: true } }, mrp: true, isStrikedThrough: true } });
  for (const f of all) console.log(`${f.fabricName} | ${f.vendor.name} | mrp=${f.mrp} | struck=${f.isStrikedThrough}`);
  console.log('\nNylon, Poly Lycra/Spandex variants:');
  const all2 = await prisma.fabricMaster.findMany({ where: { OR: [{ fabricName: 'Nylon' }, { fabricName: 'Nylon Lycra' }, { fabricName: 'Poly Lycra' }, { fabricName: 'Poly Spandex' }] }, select: { fabricName: true, vendor: { select: { name: true } }, mrp: true } });
  for (const f of all2) console.log(`${f.fabricName} | ${f.vendor.name} | mrp=${f.mrp}`);
  await prisma.$disconnect();
})();
