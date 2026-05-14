import { db as prisma } from '../src/lib/db';
import { changeArticleType } from '../src/lib/article-history';

(async () => {
  await prisma.$transaction(async (tx) => {
    const pt = await tx.productType.findFirst({ where: { name: 'Shorts' } });
    if (!pt) throw new Error('ProductType Shorts not found');

    await changeArticleType(tx as any, '3114', 'Shorts', pt.id);
    console.log('3114: type changed to Shorts');

    await tx.productMaster.updateMany({
      where: { articleNumber: '3114' },
      data: {
        styleNumber: '',
        stitchingCost: 85, brandLogoCost: 0, neckTwillCost: 0, reflectorsCost: 17,
        fusingCost: 11, accessoriesCost: 15, brandTagCost: 2, sizeTagCost: 5.3,
        packagingCost: 8.5, inwardShipping: 10, proposedMrp: 899,
      },
    });
    console.log('3114: applied costs/style/MRP/inShip');
  });

  const after = await prisma.productMaster.findMany({ where: { articleNumber: '3114' }, orderBy: { skuCode: 'asc' } });
  for (const r of after) console.log(`- ${r.skuCode} | colour=${JSON.stringify(r.coloursAvailable)} | type=${r.type} | mrp=${r.proposedMrp}`);
  const hist = await prisma.articleHistory.findUnique({ where: { articleNumber: '3114' } });
  console.log(`ArticleHistory previousTypes=${JSON.stringify(hist?.previousTypes)}`);
  await prisma.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
