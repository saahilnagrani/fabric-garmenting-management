import { db as prisma } from '../src/lib/db';
(async () => {
  const all = await prisma.fabricMaster.findMany({ where: { fabricName: { contains: 'Poly Spandex' } }, select: { fabricName: true, vendor: { select: { name: true } } } });
  for (const f of all) console.log(`"${f.fabricName}" | ${f.vendor.name}`);
})().finally(() => prisma.$disconnect());
