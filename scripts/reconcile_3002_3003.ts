import { db as prisma } from '../src/lib/db';
import { renameProductMasterSkuCode, changeArticleType } from '../src/lib/article-history';

(async () => {
  await prisma.$transaction(async (tx) => {
    // Update FabricMaster.Nylon Terry.mrp 173 -> 170 (only 3002 uses it; safe)
    await tx.fabricMaster.update({ where: { fabricName: 'Nylon Terry' }, data: { mrp: 170 } });
    console.log('FabricMaster.Nylon Terry mrp -> 170');

    const tp = await tx.productType.findFirst({ where: { name: 'Trackpants' } });
    if (!tp) throw new Error('ProductType Trackpants not found');

    // ─── 3002 ─── Velofit
    const renames3002: Record<string, string> = {
      'M LO03 BLK': 'M TP03 BLK',
      'M LO03 BEI': 'M TP03 BEI',
      'M LO03 OlV': 'M TP03 OLV', // typo fix + rename
    };
    for (const [oldSku, newSku] of Object.entries(renames3002)) {
      const row = await tx.productMaster.findUnique({ where: { skuCode: oldSku } });
      if (!row) { console.log(`SKIP ${oldSku}: not found`); continue; }
      await renameProductMasterSkuCode(tx as any, row.id, newSku);
      console.log(`3002: Renamed ${oldSku} -> ${newSku}`);
    }
    await changeArticleType(tx as any, '3002', 'Trackpants', tp.id);
    // also seed historical type "Knee Vent Trackpants" alongside whatever changeArticleType pushed
    {
      const h = await tx.articleHistory.findUnique({ where: { articleNumber: '3002' } });
      const merged = Array.from(new Set([...(h?.previousTypes ?? []), 'Knee Vent Trackpants']));
      await tx.articleHistory.upsert({
        where: { articleNumber: '3002' },
        create: { articleNumber: '3002', previousTypes: merged },
        update: { previousTypes: { set: merged } },
      });
      console.log(`3002 ArticleHistory previousTypes=${JSON.stringify(merged)}`);
    }
    await tx.productMaster.updateMany({
      where: { articleNumber: '3002' },
      data: { productName: 'Velofit', styleNumber: '', proposedMrp: 1199, inwardShipping: 10 },
    });
    console.log('3002: applied name/style/MRP/inShip');

    // ─── 3003 ─── Aerofit
    const renames3003: Record<string, string> = {
      'M LO04 BLK': 'M TP04 BLK',
      'M LO04 NVY': 'M TP04 NVY',
      'M LO04 GRY': 'M TP04 GRY',
      'M LO04 OLV': 'M TP04 OLV',
    };
    for (const [oldSku, newSku] of Object.entries(renames3003)) {
      const row = await tx.productMaster.findUnique({ where: { skuCode: oldSku } });
      if (!row) { console.log(`SKIP ${oldSku}: not found`); continue; }
      await renameProductMasterSkuCode(tx as any, row.id, newSku);
      console.log(`3003: Renamed ${oldSku} -> ${newSku}`);
    }
    await changeArticleType(tx as any, '3003', 'Trackpants', tp.id);
    {
      const h = await tx.articleHistory.findUnique({ where: { articleNumber: '3003' } });
      const merged = Array.from(new Set([...(h?.previousTypes ?? []), 'Straight Trackpants']));
      await tx.articleHistory.upsert({
        where: { articleNumber: '3003' },
        create: { articleNumber: '3003', previousTypes: merged },
        update: { previousTypes: { set: merged } },
      });
      console.log(`3003 ArticleHistory previousTypes=${JSON.stringify(merged)}`);
    }
    await tx.productMaster.updateMany({
      where: { articleNumber: '3003' },
      data: { productName: 'Aerofit', styleNumber: '', proposedMrp: 799, inwardShipping: 10 },
    });
    console.log('3003: applied name/style/MRP/inShip');
  });

  console.log('\n=== AFTER ===');
  for (const a of ['3002', '3003']) {
    const rows = await prisma.productMaster.findMany({ where: { articleNumber: a }, orderBy: { skuCode: 'asc' } });
    console.log(`\n${a}:`);
    for (const r of rows) console.log(`- ${r.skuCode} | prev=${JSON.stringify(r.previousSkuCodes)} | colour=${JSON.stringify(r.coloursAvailable)} | type=${r.type} | name=${r.productName} | style="${r.styleNumber}" | mrp=${r.proposedMrp}`);
    const hist = await prisma.articleHistory.findUnique({ where: { articleNumber: a } });
    console.log(`  ArticleHistory previousTypes=${JSON.stringify(hist?.previousTypes)}`);
  }
  await prisma.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
