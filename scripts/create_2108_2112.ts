import { db as prisma } from '../src/lib/db';

type Row = { newSku: string; oldSku: string; colour: string; gKg: number };
type Spec = {
  articleNumber: string;
  productName: string;
  type: string;
  prevTypes: string[];
  gender: 'MENS' | 'WOMENS';
  garmentingAt: string;
  fabricName: string;
  rows: Row[];
  costs: {
    stitchingCost: number; brandLogoCost: number; neckTwillCost: number;
    reflectorsCost: number; fusingCost: number; accessoriesCost: number;
    brandTagCost: number; sizeTagCost: number; packagingCost: number;
    inwardShipping: number; proposedMrp: number;
  };
};

const articles: Spec[] = [
  {
    articleNumber: '2108', productName: 'Bubbleflex', type: 'Polo', prevTypes: ['Polo T-shirt'],
    gender: 'MENS', garmentingAt: 'Walknit', fabricName: 'Bubbleknit',
    rows: [
      { newSku: 'M PO02 GRY', oldSku: 'M POL02 GRY', colour: 'Light Grey', gKg: 2.6 },
      { newSku: 'M PO02 NVY', oldSku: 'M POL02 NVY', colour: 'True Navy', gKg: 2.6 },
      { newSku: 'M PO02 WIN', oldSku: 'M POL02 WIN', colour: 'French Wine', gKg: 2.6 },
    ],
    costs: { stitchingCost: 123, brandLogoCost: 0, neckTwillCost: 0, reflectorsCost: 0, fusingCost: 0, accessoriesCost: 0, brandTagCost: 5, sizeTagCost: 0, packagingCost: 12.5, inwardShipping: 10, proposedMrp: 699 },
  },
  {
    articleNumber: '2109', productName: 'Urbanflex', type: 'Trackpants', prevTypes: ['Straight Trackpants'],
    gender: 'MENS', garmentingAt: 'Walknit', fabricName: 'Zurich',
    rows: [
      { newSku: 'M TP01 BLK', oldSku: 'M LO01 BLK', colour: 'Black', gKg: 1.6 },
      { newSku: 'M TP01 GRY', oldSku: 'M LO01 GRY', colour: 'Dark Grey', gKg: 2.24 },
    ],
    costs: { stitchingCost: 140, brandLogoCost: 5, neckTwillCost: 0, reflectorsCost: 0, fusingCost: 0, accessoriesCost: 6.5, brandTagCost: 5, sizeTagCost: 0, packagingCost: 12.5, inwardShipping: 10, proposedMrp: 899 },
  },
  {
    articleNumber: '2110', productName: 'Sprintflex', type: 'Shorts', prevTypes: [],
    gender: 'MENS', garmentingAt: 'Walknit', fabricName: 'Zurich',
    rows: [
      { newSku: 'M SH01 GRY', oldSku: 'M SH01 GRY', colour: 'Dark Grey', gKg: 3.52 },
      { newSku: 'M SH01 BLK', oldSku: 'M SH01 BLK', colour: 'Black', gKg: 3.2 },
    ],
    costs: { stitchingCost: 120, brandLogoCost: 5, neckTwillCost: 0, reflectorsCost: 0, fusingCost: 0, accessoriesCost: 6.5, brandTagCost: 5, sizeTagCost: 0, packagingCost: 12.5, inwardShipping: 10, proposedMrp: 599 },
  },
  {
    articleNumber: '2111', productName: 'Glyde', type: 'Shorts', prevTypes: [],
    gender: 'MENS', garmentingAt: 'Garsem', fabricName: 'NS Poly',
    rows: [
      { newSku: 'M SH02 BLU', oldSku: 'M SH02 BLU', colour: 'Blue', gKg: 1.14 },
      { newSku: 'M SH02 GRY', oldSku: 'M SH02 GRY', colour: 'Light Grey', gKg: 1.14 },
      { newSku: 'M SH02 BLK', oldSku: 'M SH02 BLK', colour: 'Black', gKg: 1.14 },
    ],
    costs: { stitchingCost: 80, brandLogoCost: 0, neckTwillCost: 0, reflectorsCost: 10, fusingCost: 11, accessoriesCost: 22, brandTagCost: 5, sizeTagCost: 0, packagingCost: 8.5, inwardShipping: 10, proposedMrp: 499 },
  },
  {
    articleNumber: '2112', productName: 'Velocity', type: 'Round Neck T-shirt', prevTypes: [],
    gender: 'MENS', garmentingAt: 'Garsem', fabricName: 'Bubblegum Dot',
    rows: [
      { newSku: 'M RN08 BLK', oldSku: 'M RF01 BLK', colour: 'Black', gKg: 4.32 },
    ],
    costs: { stitchingCost: 52, brandLogoCost: 0, neckTwillCost: 0, reflectorsCost: 23.3, fusingCost: 11, accessoriesCost: 0, brandTagCost: 5, sizeTagCost: 0, packagingCost: 8.5, inwardShipping: 10, proposedMrp: 549 },
  },
];

(async () => {
  await prisma.$transaction(async (tx) => {
    const typeIds: Record<string, string> = {};
    for (const a of articles) {
      if (typeIds[a.type]) continue;
      const pt = await tx.productType.findFirst({ where: { name: a.type } });
      if (!pt) throw new Error(`ProductType "${a.type}" not found`);
      typeIds[a.type] = pt.id;
    }

    for (const a of articles) {
      console.log(`\n--- ${a.articleNumber} ${a.productName} | type=${a.type} | fabric=${a.fabricName} ---`);
      const garmenting = await tx.garmentingLocation.findFirst({ where: { name: a.garmentingAt } });
      if (!garmenting) throw new Error(`GarmentingLocation "${a.garmentingAt}" not found`);
      const fabric = await tx.fabricMaster.findUnique({ where: { fabricName: a.fabricName } });
      if (!fabric?.mrp) throw new Error(`FabricMaster "${a.fabricName}" missing mrp`);
      const fabricCostPerKg = Number(fabric.mrp);

      for (const r of a.rows) {
        const existing = await tx.productMaster.findUnique({ where: { skuCode: r.newSku } });
        if (existing) { console.log(`SKIP ${r.newSku}: already exists`); continue; }
        const seedPrev = r.oldSku && r.oldSku !== r.newSku ? [r.oldSku] : [];
        const created = await tx.productMaster.create({
          data: {
            articleNumber: a.articleNumber,
            skuCode: r.newSku,
            previousSkuCodes: seedPrev,
            styleNumber: '',
            productName: a.productName,
            type: a.type,
            typeRefId: typeIds[a.type],
            gender: a.gender,
            garmentingAt: a.garmentingAt,
            garmentingAtId: garmenting.id,
            fabricName: a.fabricName,
            coloursAvailable: [r.colour],
            colours2Available: [],
            colours3Available: [],
            colours4Available: [],
            garmentsPerKg: r.gKg,
            fabricCostPerKg,
            ...a.costs,
          },
        });
        console.log(`Created ${created.skuCode} | colour=${r.colour} | g/kg=${r.gKg} | prev=${JSON.stringify(seedPrev)}`);
      }

      if (a.prevTypes.length > 0) {
        const h = await tx.articleHistory.findUnique({ where: { articleNumber: a.articleNumber } });
        const merged = Array.from(new Set([...(h?.previousTypes ?? []), ...a.prevTypes]));
        await tx.articleHistory.upsert({
          where: { articleNumber: a.articleNumber },
          create: { articleNumber: a.articleNumber, previousTypes: merged },
          update: { previousTypes: { set: merged } },
        });
        console.log(`ArticleHistory ${a.articleNumber} previousTypes=${JSON.stringify(merged)}`);
      }

      const fab = await tx.fabricMaster.findUnique({ where: { fabricName: a.fabricName } });
      if (fab && !fab.articleNumbers.includes(a.articleNumber)) {
        await tx.fabricMaster.update({
          where: { fabricName: a.fabricName },
          data: { articleNumbers: { set: [...fab.articleNumbers, a.articleNumber] } },
        });
        console.log(`Linked ${a.articleNumber} into FabricMaster.${a.fabricName}.articleNumbers`);
      }
    }
  });

  console.log('\n=== AFTER ===');
  for (const a of articles) {
    const rows = await prisma.productMaster.findMany({ where: { articleNumber: a.articleNumber }, orderBy: { skuCode: 'asc' } });
    console.log(`\n${a.articleNumber}:`);
    for (const r of rows) {
      console.log(`- ${r.skuCode} | prev=${JSON.stringify(r.previousSkuCodes)} | colour=${JSON.stringify(r.coloursAvailable)} | type=${r.type} | name=${r.productName} | fabric=${r.fabricName}/${r.fabricCostPerKg} | g/kg=${r.garmentsPerKg} | mrp=${r.proposedMrp}`);
    }
  }
  await prisma.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
