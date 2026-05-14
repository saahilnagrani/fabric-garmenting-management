import { db as prisma } from '../src/lib/db';
import { renameProductMasterSkuCode, changeArticleType } from '../src/lib/article-history';

(async () => {
  await prisma.$transaction(async (tx) => {
    const rnt = await tx.productType.findFirst({ where: { name: 'Round Neck T-shirt' } });
    if (!rnt) throw new Error('ProductType Round Neck T-shirt not found');

    // ─── 3111 Revive ───
    // Rename W RN02 * → W RN06 * (keep fabric D.Naylon Mesh — current setup)
    const renames3111: Record<string, string> = {
      'W RN02 BLK': 'W RN06 BLK',
      'W RN02 OLV': 'W RN06 OLV',
      'W RN02 GRY': 'W RN06 GRY',
      'W RN02 NVY': 'W RN06 NVY',
    };
    for (const [oldSku, newSku] of Object.entries(renames3111)) {
      const row = await tx.productMaster.findUnique({ where: { skuCode: oldSku } });
      if (!row) { console.log(`SKIP ${oldSku}: not found`); continue; }
      await renameProductMasterSkuCode(tx as any, row.id, newSku);
      console.log(`3111: Renamed ${oldSku} -> ${newSku}`);
    }
    await changeArticleType(tx as any, '3111', 'Round Neck T-shirt', rnt.id);
    console.log('3111: type changed to Round Neck T-shirt');
    await tx.productMaster.updateMany({
      where: { articleNumber: '3111' },
      data: { styleNumber: '', proposedMrp: 799, inwardShipping: 10 },
    });
    console.log('3111: applied style/MRP/inShip');

    // ─── 3112 Zena ───
    // SKUs already at W RN07 * with prev seeded (done earlier). Just type/style/MRP.
    await changeArticleType(tx as any, '3112', 'Round Neck T-shirt', rnt.id);
    console.log('3112: type changed to Round Neck T-shirt');
    await tx.productMaster.updateMany({
      where: { articleNumber: '3112' },
      data: { styleNumber: '', proposedMrp: 649, inwardShipping: 10 },
    });
    console.log('3112: applied style/MRP/inShip');
  });

  console.log('\n=== AFTER ===');
  for (const a of ['3111', '3112']) {
    const rows = await prisma.productMaster.findMany({ where: { articleNumber: a }, orderBy: { skuCode: 'asc' } });
    console.log(`\n${a}:`);
    for (const r of rows) console.log(`- ${r.skuCode} | prev=${JSON.stringify(r.previousSkuCodes)} | colour=${JSON.stringify(r.coloursAvailable)} | type=${r.type} | name=${r.productName} | fabric=${r.fabricName}/${r.fabricCostPerKg} | mrp=${r.proposedMrp}`);
    const hist = await prisma.articleHistory.findUnique({ where: { articleNumber: a } });
    console.log(`  ArticleHistory previousTypes=${JSON.stringify(hist?.previousTypes)}`);
  }
  await prisma.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
