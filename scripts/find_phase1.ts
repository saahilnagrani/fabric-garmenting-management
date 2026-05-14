import { db as prisma } from '../src/lib/db';
(async () => {
  const phases = await prisma.phase.findMany({ where: { number: 1 } });
  for (const p of phases) console.log(JSON.stringify(p));
  for (const p of phases) {
    const products = await prisma.product.count({ where: { phaseId: p.id } });
    const fOrders = await prisma.fabricOrder.count({ where: { phaseId: p.id } });
    console.log(`Phase id=${p.id}: products=${products}, fabricOrders=${fOrders}`);
  }
  await prisma.$disconnect();
})();
