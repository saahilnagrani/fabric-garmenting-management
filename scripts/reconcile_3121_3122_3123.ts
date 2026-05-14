import { db as prisma } from '../src/lib/db';
import { renameProductMasterSkuCode, changeArticleType } from '../src/lib/article-history';

(async () => {
  await prisma.$transaction(async (tx) => {
    const fullSleeves = await tx.productType.findFirst({ where: { name: 'Full Sleeves' } });
    const rnt = await tx.productType.findFirst({ where: { name: 'Round Neck T-shirt' } });
    const kidsSet = await tx.productType.findFirst({ where: { name: 'Kids Set' } });
    if (!fullSleeves || !rnt || !kidsSet) throw new Error('Missing ProductType');

    const garm = await tx.garmentingLocation.findFirst({ where: { name: 'Garsem' } });
    if (!garm) throw new Error('Garsem not found');
    const nfl = await tx.fabricMaster.findUnique({ where: { fabricName: 'Nylon Feel Lycra' } });
    if (!nfl) throw new Error('Nylon Feel Lycra not found');

    // ─── 3121 (must run first to free K RN01 * codes for 3122) ───
    const renames3121: Record<string, string> = {
      'K RN01 NVY': 'K FS01 NVY',
      'K RN01 LMN': 'K FS01 YLW',
      'K RN01 GRY': 'K FS01 GRY',
    };
    for (const [oldSku, newSku] of Object.entries(renames3121)) {
      const row = await tx.productMaster.findUnique({ where: { skuCode: oldSku } });
      if (!row) { console.log(`SKIP ${oldSku}: not found`); continue; }
      await renameProductMasterSkuCode(tx as any, row.id, newSku);
      console.log(`3121: Renamed ${oldSku} -> ${newSku}`);
    }
    await changeArticleType(tx as any, '3121', 'Full Sleeves', fullSleeves.id);
    {
      const h = await tx.articleHistory.findUnique({ where: { articleNumber: '3121' } });
      const merged = Array.from(new Set([...(h?.previousTypes ?? []), 'Kids Full Sleeve T-shirt']));
      await tx.articleHistory.upsert({
        where: { articleNumber: '3121' },
        create: { articleNumber: '3121', previousTypes: merged },
        update: { previousTypes: { set: merged } },
      });
      console.log(`3121 ArticleHistory previousTypes=${JSON.stringify(merged)}`);
    }
    await tx.productMaster.updateMany({
      where: { articleNumber: '3121' },
      data: {
        styleNumber: '',
        stitchingCost: 102, brandLogoCost: 0, neckTwillCost: 0, reflectorsCost: 7,
        fusingCost: 7, accessoriesCost: 4, brandTagCost: 2, sizeTagCost: 5.3,
        packagingCost: 8.5, inwardShipping: 10, proposedMrp: 899,
      },
    });
    console.log('3121: applied costs');

    // ─── 3122 ───
    // Rename BLK, BLU, PCH from K RN02 -> K RN01
    const renames3122: Record<string, string> = {
      'K RN02 BLK': 'K RN01 BLK',
      'K RN02 BLU': 'K RN01 BLU',
      'K RN02 PCH': 'K RN01 PCH',
    };
    for (const [oldSku, newSku] of Object.entries(renames3122)) {
      const row = await tx.productMaster.findUnique({ where: { skuCode: oldSku } });
      if (!row) { console.log(`SKIP ${oldSku}: not found`); continue; }
      await renameProductMasterSkuCode(tx as any, row.id, newSku);
      console.log(`3122: Renamed ${oldSku} -> ${newSku}`);
    }
    // Update BLU colour Blue -> Sky Blue
    await tx.productMaster.update({
      where: { skuCode: 'K RN01 BLU' },
      data: { coloursAvailable: ['Sky Blue'] },
    });
    console.log('3122: K RN01 BLU colour -> Sky Blue');
    // Create new K RN01 GRY (Light Grey)
    const grayExisting = await tx.productMaster.findUnique({ where: { skuCode: 'K RN01 GRY' } });
    if (!grayExisting) {
      await tx.productMaster.create({
        data: {
          articleNumber: '3122',
          skuCode: 'K RN01 GRY',
          previousSkuCodes: [],
          styleNumber: '',
          productName: 'Bounce',
          type: 'Round Neck T-shirt',
          typeRefId: rnt.id,
          gender: 'KIDS',
          garmentingAt: 'Garsem',
          garmentingAtId: garm.id,
          fabricName: 'Nylon Feel Lycra',
          coloursAvailable: ['Light Grey'],
          colours2Available: [],
          colours3Available: [],
          colours4Available: [],
          garmentsPerKg: 5.9,
          fabricCostPerKg: Number(nfl.mrp),
          stitchingCost: 62, brandLogoCost: 0, neckTwillCost: 0, reflectorsCost: 7,
          fusingCost: 7, accessoriesCost: 0, brandTagCost: 2, sizeTagCost: 5.3,
          packagingCost: 8, inwardShipping: 10, proposedMrp: 799,
        },
      });
      console.log('3122: Created K RN01 GRY (Light Grey)');
    }
    await changeArticleType(tx as any, '3122', 'Round Neck T-shirt', rnt.id);
    {
      const h = await tx.articleHistory.findUnique({ where: { articleNumber: '3122' } });
      const merged = Array.from(new Set([...(h?.previousTypes ?? []), 'Kids T-shirt']));
      await tx.articleHistory.upsert({
        where: { articleNumber: '3122' },
        create: { articleNumber: '3122', previousTypes: merged },
        update: { previousTypes: { set: merged } },
      });
      console.log(`3122 ArticleHistory previousTypes=${JSON.stringify(merged)}`);
    }
    await tx.productMaster.updateMany({
      where: { articleNumber: '3122' },
      data: {
        styleNumber: '',
        stitchingCost: 62, sizeTagCost: 5.3, packagingCost: 8, proposedMrp: 799,
      },
    });
    console.log('3122: applied costs/MRP/style');

    // Delete 3 Test Phase orders for 3122 (dummy)
    const testPhase = await tx.phase.findFirst({ where: { name: 'Test Phase' } });
    if (testPhase) {
      const del = await tx.product.deleteMany({
        where: { articleNumber: '3122', phaseId: testPhase.id },
      });
      console.log(`3122: deleted ${del.count} Test Phase orders`);
    }

    // ─── 3123 ───
    await changeArticleType(tx as any, '3123', 'Kids Set', kidsSet.id);
    {
      const h = await tx.articleHistory.findUnique({ where: { articleNumber: '3123' } });
      const merged = Array.from(new Set([...(h?.previousTypes ?? []), 'Unisex Kids Set']));
      await tx.articleHistory.upsert({
        where: { articleNumber: '3123' },
        create: { articleNumber: '3123', previousTypes: merged },
        update: { previousTypes: { set: merged } },
      });
      console.log(`3123 ArticleHistory previousTypes=${JSON.stringify(merged)}`);
    }
    await tx.productMaster.updateMany({
      where: { articleNumber: '3123' },
      data: { styleNumber: '', proposedMrp: 1095 },
    });
    // Per-row g/kg
    await tx.productMaster.update({ where: { skuCode: 'K SET02 BLU' }, data: { garmentsPerKg: 3.5 } });
    await tx.productMaster.update({ where: { skuCode: 'K SET02 ONI' }, data: { garmentsPerKg: 3.5 } });
    console.log('3123: applied style/MRP/per-row g/kg');
  });

  console.log('\n=== AFTER ===');
  for (const a of ['3121', '3122', '3123']) {
    const rows = await prisma.productMaster.findMany({ where: { articleNumber: a }, orderBy: { skuCode: 'asc' } });
    console.log(`\n${a}:`);
    for (const r of rows) console.log(`- ${r.skuCode} | prev=${JSON.stringify(r.previousSkuCodes)} | colour=${JSON.stringify(r.coloursAvailable)} | type=${r.type} | name=${r.productName} | g/kg=${r.garmentsPerKg} | mrp=${r.proposedMrp}`);
    const hist = await prisma.articleHistory.findUnique({ where: { articleNumber: a } });
    console.log(`  ArticleHistory previousTypes=${JSON.stringify(hist?.previousTypes)}`);
  }
  await prisma.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
