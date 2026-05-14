import { db as prisma } from '../src/lib/db';
import { renameProductMasterSkuCode, changeArticleType } from '../src/lib/article-history';

const ARTICLE = '3001';
const NEW_TYPE = 'Trackpants';
const renames: Record<string, string> = {
  'M LO02 BLK': 'M TP02 BLK',
  'M LO02 GRY': 'M TP02 GRY',
  'M LO02 NVY': 'M TP02 NVY',
};

(async () => {
  await prisma.$transaction(async (tx) => {
    const pt = await tx.productType.findFirst({ where: { name: NEW_TYPE } });
    if (!pt) throw new Error(`ProductType "${NEW_TYPE}" not found`);

    for (const [oldSku, newSku] of Object.entries(renames)) {
      const row = await tx.productMaster.findUnique({ where: { skuCode: oldSku } });
      if (!row) { console.log(`SKIP ${oldSku}: not found`); continue; }
      await renameProductMasterSkuCode(tx as any, row.id, newSku);
      console.log(`Renamed ${oldSku} -> ${newSku}`);
    }

    // Change type "Striped Trackpants" -> "Trackpants" (helper pushes old to ArticleHistory)
    await changeArticleType(tx as any, ARTICLE, NEW_TYPE, pt.id);
    console.log(`Type changed to "${NEW_TYPE}"`);
  });

  const after = await prisma.productMaster.findMany({ where: { articleNumber: ARTICLE }, orderBy: { skuCode: 'asc' } });
  console.log('\n=== AFTER ===');
  for (const r of after) {
    console.log(`- ${r.skuCode} | prev=${JSON.stringify(r.previousSkuCodes)} | colour=${JSON.stringify(r.coloursAvailable)} | type=${r.type} | name=${r.productName} | mrp=${r.proposedMrp}`);
  }
  const hist = await prisma.articleHistory.findUnique({ where: { articleNumber: ARTICLE } });
  console.log(`\nArticleHistory: previousTypes=${JSON.stringify(hist?.previousTypes)}`);
  await prisma.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
