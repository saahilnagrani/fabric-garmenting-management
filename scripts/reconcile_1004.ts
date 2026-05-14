import { db as prisma } from '../src/lib/db';
import { renameProductMasterSkuCode, changeArticleType } from '../src/lib/article-history';

const ARTICLE = '1004';
const NEW_TYPE = 'Polo';
const NEW_NAME = 'Aeroflux';
const FABRIC_NAME = 'Mars';
const skuRenames: Record<string, string> = {
  'W NSPOL01 GRN': 'W PO02 GRN',
  'W NSPOL01 BLU': 'W PO02 BLU',
  'W NSPOL01 YEL': 'W PO02 YLW',
};
const COSTS = {
  stitchingCost: 120, brandLogoCost: 12, neckTwillCost: 0, reflectorsCost: 0,
  fusingCost: 0, accessoriesCost: 0, brandTagCost: 5, sizeTagCost: 2,
  packagingCost: 12, inwardShipping: 10, proposedMrp: 849,
};

(async () => {
  await prisma.$transaction(async (tx) => {
    let pt = await tx.productType.findFirst({ where: { name: NEW_TYPE } });
    if (!pt) {
      pt = await tx.productType.create({ data: { name: NEW_TYPE } });
      console.log(`Created ProductType "${NEW_TYPE}" (id=${pt.id})`);
    } else {
      console.log(`Reusing ProductType "${NEW_TYPE}" (id=${pt.id})`);
    }

    const fabric = await tx.fabricMaster.findUnique({ where: { fabricName: FABRIC_NAME } });
    if (!fabric || fabric.mrp == null) throw new Error(`FabricMaster "${FABRIC_NAME}" missing mrp`);
    const fabricCostPerKg = Number(fabric.mrp);
    console.log(`Resolved fabric "${FABRIC_NAME}" mrp=${fabricCostPerKg}`);

    for (const [oldSku, newSku] of Object.entries(skuRenames)) {
      const row = await tx.productMaster.findUnique({ where: { skuCode: oldSku } });
      if (!row) { console.log(`SKIP rename ${oldSku}: not found`); continue; }
      await renameProductMasterSkuCode(tx as any, row.id, newSku);
      console.log(`Renamed ${oldSku} -> ${newSku}`);
    }

    await changeArticleType(tx as any, ARTICLE, NEW_TYPE, pt.id);
    console.log(`Type set to "${NEW_TYPE}" for article ${ARTICLE}`);

    const updated = await tx.productMaster.updateMany({
      where: { articleNumber: ARTICLE },
      data: {
        gender: 'WOMENS',
        productName: NEW_NAME,
        styleNumber: '',
        fabricCostPerKg,
        ...COSTS,
      },
    });
    console.log(`Updated ${updated.count} master rows`);

    const productsUpdated = await tx.product.updateMany({
      where: { articleNumber: ARTICLE },
      data: { gender: 'WOMENS' },
    });
    console.log(`Fixed gender on ${productsUpdated.count} order rows`);
  });

  const after = await prisma.productMaster.findMany({
    where: { articleNumber: ARTICLE },
    include: { typeRef: true },
    orderBy: { skuCode: 'asc' },
  });
  console.log('\n=== AFTER ===');
  for (const r of after) {
    console.log(`- skuCode=${r.skuCode} | prev=${JSON.stringify(r.previousSkuCodes)} | type=${r.type}/${r.typeRef?.name} | gender=${r.gender} | colour=${JSON.stringify(r.coloursAvailable)} | name=${r.productName} | fabric=${r.fabricName}/${r.fabricCostPerKg} | style="${r.styleNumber}"`);
    console.log(`  costs: stitch=${r.stitchingCost} logo=${r.brandLogoCost} neck=${r.neckTwillCost} refl=${r.reflectorsCost} fuse=${r.fusingCost} acc=${r.accessoriesCost} bt=${r.brandTagCost} st=${r.sizeTagCost} pkg=${r.packagingCost} inShip=${r.inwardShipping} mrp=${r.proposedMrp}`);
  }
  const hist = await prisma.articleHistory.findUnique({ where: { articleNumber: ARTICLE } });
  console.log(`\nArticleHistory: previousTypes=${JSON.stringify(hist?.previousTypes)}`);
  await prisma.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
