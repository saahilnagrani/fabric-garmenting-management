import { db as prisma } from '../src/lib/db';
(async () => {
  const all = await prisma.fabricMaster.findMany({ where: { fabricName: { contains: 'Lycra' } }, select: { fabricName: true, mrp: true, isStrikedThrough: true } });
  for (const f of all) console.log(JSON.stringify(f));
  await prisma.$disconnect();
})();
