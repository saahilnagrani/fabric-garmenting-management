import { db as prisma } from '../src/lib/db';
(async () => {
  const orders = await prisma.product.findMany({
    where: { articleNumber: '3122' },
    select: { id: true, skuCode: true, phaseId: true, status: true, phase: { select: { name: true } } },
  });
  for (const o of orders) console.log(JSON.stringify(o));
  const phases = await prisma.phase.findMany({ where: { name: { contains: 'Test', mode: 'insensitive' } }, select: { id: true, name: true } });
  console.log('Test phases:', JSON.stringify(phases));
  await prisma.$disconnect();
})();
