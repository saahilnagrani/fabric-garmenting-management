import { db as prisma } from '../src/lib/db';
(async () => {
  const del = await prisma.product.deleteMany({
    where: { articleNumber: '3122', phaseId: 'cmnna58fz0000pgu5te35njgf' },
  });
  console.log(`Deleted ${del.count} orders`);
  await prisma.$disconnect();
})();
