import { db as prisma } from '../src/lib/db';

const TYPE = 'Bra';
const PREV_TYPE = 'Sports Bra';
const GARMENTING_AT = 'Mumtaz';

const SHARED_COSTS = {
  stitchingCost: 150, brandLogoCost: 5, neckTwillCost: 0, reflectorsCost: 8,
  fusingCost: 0, accessoriesCost: 35, brandTagCost: 5, sizeTagCost: 2,
  packagingCost: 12, inwardShipping: 10, proposedMrp: 899,
};

// 2007-1 — Ventra. Cofee active (existing); other 4 historical Dryfit, struck-through.
const ART_1 = {
  articleNumber: '2007-1',
  productName: 'Ventra',
  kofee: { currentSku: 'W BR02 KOF', oldSku: 'W BR01 COF' }, // update existing
  historicalDryfit: [
    { newSku: 'W BR02 LGRY', oldSku: 'W BR01 LGR', colour: 'Light Grey' },
    { newSku: 'W BR02 DGRY', oldSku: 'W BR01 DGR', colour: 'Dark Grey' },
    { newSku: 'W BR02 BLU',  oldSku: 'W BR01 PBL', colour: 'Petrol Blue' },
    { newSku: 'W BR02 WIN',  oldSku: 'W BR01 WIN', colour: 'Wine' },
  ],
  garmentsPerKg: 5.07,
  costs: SHARED_COSTS,
};

// 2007-2 — Fortra, single active Black SKU on Zurich (Pranera).
const ART_2 = {
  articleNumber: '2007-2',
  productName: 'Fortra',
  rows: [
    { newSku: 'W BR03 BLK', oldSku: 'W BR01 BLK', colour: 'Black', garmentsPerKg: 6.67, fabricName: 'Zurich' },
  ],
  costs: { ...SHARED_COSTS, accessoriesCost: 64, proposedMrp: 949 },
};

(async () => {
  await prisma.$transaction(async (tx) => {
    const pt = await tx.productType.findFirst({ where: { name: TYPE } });
    if (!pt) throw new Error(`ProductType "${TYPE}" not found`);
    const garmenting = await tx.garmentingLocation.findFirst({ where: { name: GARMENTING_AT } });
    if (!garmenting) throw new Error(`GarmentingLocation "${GARMENTING_AT}" not found`);

    const dryfit = await tx.fabricMaster.findUnique({ where: { fabricName: 'Dryfit' } });
    if (!dryfit?.mrp) throw new Error('Dryfit missing mrp');
    const dryfitCost = Number(dryfit.mrp);

    const zurich = await tx.fabricMaster.findUnique({ where: { fabricName: 'Zurich' } });
    if (!zurich?.mrp) throw new Error('Zurich missing mrp');
    const zurichCost = Number(zurich.mrp);

    // ─── 2007-1 ─────────────────────────────────────
    // Update existing Kofee row
    const kofee = await tx.productMaster.findUnique({ where: { skuCode: ART_1.kofee.currentSku } });
    if (kofee) {
      const merged = kofee.previousSkuCodes.includes(ART_1.kofee.oldSku)
        ? kofee.previousSkuCodes
        : [...kofee.previousSkuCodes, ART_1.kofee.oldSku];
      await tx.productMaster.update({ where: { id: kofee.id }, data: { styleNumber: '', previousSkuCodes: merged } });
      console.log(`Updated ${ART_1.kofee.currentSku}: styleNumber="" prev=${JSON.stringify(merged)}`);
    } else console.log(`SKIP Kofee update: ${ART_1.kofee.currentSku} not found`);

    // Create historical Dryfit rows (struck-through)
    for (const r of ART_1.historicalDryfit) {
      const existing = await tx.productMaster.findUnique({ where: { skuCode: r.newSku } });
      if (existing) { console.log(`SKIP create ${r.newSku}: already exists`); continue; }
      const created = await tx.productMaster.create({
        data: {
          articleNumber: ART_1.articleNumber,
          skuCode: r.newSku,
          previousSkuCodes: [r.oldSku],
          styleNumber: '',
          productName: ART_1.productName,
          type: TYPE,
          typeRefId: pt.id,
          gender: 'WOMENS',
          garmentingAt: GARMENTING_AT,
          garmentingAtId: garmenting.id,
          fabricName: 'Dryfit',
          coloursAvailable: [r.colour],
          colours2Available: [],
          colours3Available: [],
          colours4Available: [],
          garmentsPerKg: ART_1.garmentsPerKg,
          fabricCostPerKg: dryfitCost,
          ...ART_1.costs,
          isStrikedThrough: true,
        },
      });
      console.log(`Created struck ${created.skuCode} colour=${r.colour} prev=${JSON.stringify(created.previousSkuCodes)}`);
    }

    // Seed previousTypes for 2007-1
    {
      const h = await tx.articleHistory.findUnique({ where: { articleNumber: ART_1.articleNumber } });
      const merged = Array.from(new Set([...(h?.previousTypes ?? []), PREV_TYPE]));
      await tx.articleHistory.upsert({
        where: { articleNumber: ART_1.articleNumber },
        create: { articleNumber: ART_1.articleNumber, previousTypes: merged },
        update: { previousTypes: { set: merged } },
      });
      console.log(`ArticleHistory ${ART_1.articleNumber} previousTypes=${JSON.stringify(merged)}`);
    }

    // ─── 2007-2 ─────────────────────────────────────
    for (const r of ART_2.rows) {
      const existing = await tx.productMaster.findUnique({ where: { skuCode: r.newSku } });
      if (existing) { console.log(`SKIP create ${r.newSku}: already exists`); continue; }
      const fab = await tx.fabricMaster.findUnique({ where: { fabricName: r.fabricName } });
      if (!fab?.mrp) throw new Error(`Fabric ${r.fabricName} missing mrp`);
      const created = await tx.productMaster.create({
        data: {
          articleNumber: ART_2.articleNumber,
          skuCode: r.newSku,
          previousSkuCodes: [r.oldSku],
          styleNumber: '',
          productName: ART_2.productName,
          type: TYPE,
          typeRefId: pt.id,
          gender: 'WOMENS',
          garmentingAt: GARMENTING_AT,
          garmentingAtId: garmenting.id,
          fabricName: r.fabricName,
          coloursAvailable: [r.colour],
          colours2Available: [],
          colours3Available: [],
          colours4Available: [],
          garmentsPerKg: r.garmentsPerKg,
          fabricCostPerKg: Number(fab.mrp),
          ...ART_2.costs,
        },
      });
      console.log(`Created ${created.skuCode} colour=${r.colour} fabric=${r.fabricName} prev=${JSON.stringify(created.previousSkuCodes)}`);
    }

    // Seed previousTypes for 2007-2
    {
      const h = await tx.articleHistory.findUnique({ where: { articleNumber: ART_2.articleNumber } });
      const merged = Array.from(new Set([...(h?.previousTypes ?? []), PREV_TYPE]));
      await tx.articleHistory.upsert({
        where: { articleNumber: ART_2.articleNumber },
        create: { articleNumber: ART_2.articleNumber, previousTypes: merged },
        update: { previousTypes: { set: merged } },
      });
      console.log(`ArticleHistory ${ART_2.articleNumber} previousTypes=${JSON.stringify(merged)}`);
    }

    // Link articleNumbers into FabricMaster
    for (const [fabricName, articleNumber] of [
      ['Dryfit', ART_1.articleNumber] as const,
      ['Poly Spandex 75/25', ART_1.articleNumber] as const,
      ['Zurich', ART_2.articleNumber] as const,
    ]) {
      const fab = await tx.fabricMaster.findUnique({ where: { fabricName } });
      if (fab && !fab.articleNumbers.includes(articleNumber)) {
        await tx.fabricMaster.update({
          where: { fabricName },
          data: { articleNumbers: { set: [...fab.articleNumbers, articleNumber] } },
        });
        console.log(`Linked ${articleNumber} into FabricMaster.${fabricName}.articleNumbers`);
      }
    }
    console.log(`(unused: dryfitCost=${dryfitCost}, zurichCost=${zurichCost})`);
  });

  console.log('\n=== AFTER ===');
  for (const an of [ART_1.articleNumber, ART_2.articleNumber]) {
    const rows = await prisma.productMaster.findMany({ where: { articleNumber: an }, orderBy: { skuCode: 'asc' } });
    console.log(`\n${an}:`);
    for (const r of rows) {
      console.log(`- ${r.skuCode} | prev=${JSON.stringify(r.previousSkuCodes)} | colour=${JSON.stringify(r.coloursAvailable)} | fabric=${r.fabricName}/${r.fabricCostPerKg} | g/kg=${r.garmentsPerKg} | mrp=${r.proposedMrp} | active=${!r.isStrikedThrough}`);
    }
  }
  await prisma.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
