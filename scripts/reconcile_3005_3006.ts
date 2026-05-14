import { db as prisma } from '../src/lib/db';
import { renameProductMasterSkuCode, changeArticleType } from '../src/lib/article-history';

(async () => {
  await prisma.$transaction(async (tx) => {
    const shorts = await tx.productType.findFirst({ where: { name: 'Shorts' } });
    if (!shorts) throw new Error('ProductType Shorts not found');

    // ─── 3005 Flexfit ───
    // Rename Graphite SKU GRP -> GRA
    const grp = await tx.productMaster.findUnique({ where: { skuCode: 'M SH04 GRP' } });
    if (grp) {
      await renameProductMasterSkuCode(tx as any, grp.id, 'M SH04 GRA');
      console.log('3005: Renamed M SH04 GRP -> M SH04 GRA');
    }

    // Type Shorts Cut & Sew -> Shorts; helper pushes old type to ArticleHistory
    await changeArticleType(tx as any, '3005', 'Shorts', shorts.id);
    {
      const h = await tx.articleHistory.findUnique({ where: { articleNumber: '3005' } });
      const merged = Array.from(new Set([...(h?.previousTypes ?? []), 'High Stretch Shorts']));
      await tx.articleHistory.upsert({
        where: { articleNumber: '3005' },
        create: { articleNumber: '3005', previousTypes: merged },
        update: { previousTypes: { set: merged } },
      });
      console.log(`3005 ArticleHistory previousTypes=${JSON.stringify(merged)}`);
    }

    await tx.productMaster.updateMany({
      where: { articleNumber: '3005' },
      data: { productName: 'Flexfit', styleNumber: '', proposedMrp: 549, inwardShipping: 10 },
    });
    console.log('3005: applied name/style/MRP/inShip');

    // Also fix orders' productName=null and styleNumber to "" for 3005
    const orders3005 = await tx.product.updateMany({
      where: { articleNumber: '3005', productName: null },
      data: { productName: 'Flexfit' },
    });
    console.log(`3005: set productName=Flexfit on ${orders3005.count} orders`);

    // ─── 3006 Coreflex ───
    // Rename fabric Embose NS Poly -> Embose NS 3355 in master + orders
    const m3006 = await tx.productMaster.updateMany({
      where: { articleNumber: '3006', fabricName: 'Embose NS Poly' },
      data: { fabricName: 'Embose NS 3355' },
    });
    console.log(`3006: renamed fabric on ${m3006.count} master rows -> Embose NS 3355`);

    const o3006 = await tx.product.updateMany({
      where: { articleNumber: '3006', fabricName: 'Embose NS Poly' },
      data: { fabricName: 'Embose NS 3355' },
    });
    console.log(`3006: renamed fabric on ${o3006.count} orders -> Embose NS 3355`);

    await changeArticleType(tx as any, '3006', 'Shorts', shorts.id);
    console.log('3006: type changed to Shorts');

    await tx.productMaster.updateMany({
      where: { articleNumber: '3006' },
      data: { styleNumber: '', proposedMrp: 699, inwardShipping: 10 },
    });
    console.log('3006: applied style/MRP/inShip');

    // Link 3006 into Embose NS 3355 articleNumbers
    const fab = await tx.fabricMaster.findUnique({ where: { fabricName: 'Embose NS 3355' } });
    if (fab && !fab.articleNumbers.includes('3006')) {
      await tx.fabricMaster.update({
        where: { fabricName: 'Embose NS 3355' },
        data: { articleNumbers: { set: [...fab.articleNumbers, '3006'] } },
      });
      console.log('Linked 3006 into FabricMaster.Embose NS 3355.articleNumbers');
    }
  });

  console.log('\n=== AFTER ===');
  for (const a of ['3005', '3006']) {
    const rows = await prisma.productMaster.findMany({ where: { articleNumber: a }, orderBy: { skuCode: 'asc' } });
    console.log(`\n${a}:`);
    for (const r of rows) console.log(`- ${r.skuCode} | prev=${JSON.stringify(r.previousSkuCodes)} | colour=${JSON.stringify(r.coloursAvailable)} | type=${r.type} | name=${r.productName} | fabric=${r.fabricName}/${r.fabricCostPerKg} | mrp=${r.proposedMrp}`);
    const hist = await prisma.articleHistory.findUnique({ where: { articleNumber: a } });
    console.log(`  ArticleHistory previousTypes=${JSON.stringify(hist?.previousTypes)}`);
  }
  await prisma.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
