import { db as prisma } from '../src/lib/db';
(async () => {
  const f = await prisma.fabricMaster.findUnique({ where: { fabricName: 'Melange' }, include: { vendor: true } });
  console.log(JSON.stringify({ name: f?.fabricName, mrp: f?.mrp, vendor: f?.vendor.name }));
  await prisma.$disconnect();
})();
