import { db as prisma } from '../src/lib/db';
(async () => {
  const h = await prisma.articleHistory.findUnique({ where: { articleNumber: '3113' } });
  const merged = Array.from(new Set([...(h?.previousTypes ?? []), 'Two Layered Shorts']));
  await prisma.articleHistory.upsert({
    where: { articleNumber: '3113' },
    create: { articleNumber: '3113', previousTypes: merged },
    update: { previousTypes: { set: merged } },
  });
  console.log(`ArticleHistory 3113 previousTypes=${JSON.stringify(merged)}`);
  await prisma.$disconnect();
})();
