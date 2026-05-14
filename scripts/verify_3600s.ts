import { db as prisma } from '../src/lib/db';
(async () => {
  const fabrics = ['Nylon Lycra (Nylon Spandex)', 'Nylon', 'L 3009', 'L 3010', 'L 3011', 'L 3012', 'L 3013'];
  for (const fn of fabrics) {
    const f = await prisma.fabricMaster.findUnique({ where: { fabricName: fn }, include: { vendor: true } });
    console.log(`${fn}: ${f ? `EXISTS vendor=${f.vendor.name} mrp=${f.mrp}` : 'MISSING'}`);
  }
  const v = await prisma.vendor.findFirst({ where: { name: 'Shree Fabrics' } });
  console.log(`Vendor Shree Fabrics: ${v ? 'EXISTS' : 'MISSING'}`);
})().finally(() => prisma.$disconnect());
