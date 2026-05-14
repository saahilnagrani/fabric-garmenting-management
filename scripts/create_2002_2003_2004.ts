import { db as prisma } from '../src/lib/db';

type RowSpec = {
  newSku: string;
  oldSku: string;
  colour: string;
  garmentsPerKg: number;
};

type ArticleSpec = {
  articleNumber: string;
  productName: string;
  type: string;
  gender: 'MENS' | 'WOMENS';
  garmentingAt: string;
  fabricName: string;
  rows: RowSpec[];
  costs: {
    stitchingCost: number; brandLogoCost: number; neckTwillCost: number;
    reflectorsCost: number; fusingCost: number; accessoriesCost: number;
    brandTagCost: number; sizeTagCost: number; packagingCost: number;
    inwardShipping: number; proposedMrp: number;
  };
};

const articles: ArticleSpec[] = [
  {
    articleNumber: '2002',
    productName: 'Aeron',
    type: 'Round Neck T-shirt',
    gender: 'WOMENS',
    garmentingAt: 'Garsem',
    fabricName: 'Bubblegum Diamond',
    rows: [
      { newSku: 'W RN04 OLV', oldSku: 'W DP01 OLV', colour: 'Olive', garmentsPerKg: 4.6 },
      { newSku: 'W RN04 YLW', oldSku: 'W DP01 LMN', colour: 'Lemon Yellow', garmentsPerKg: 5.12 },
      { newSku: 'W RN04 WHI', oldSku: 'W DP01 WHT', colour: 'White', garmentsPerKg: 4.6 },
    ],
    costs: {
      stitchingCost: 52, brandLogoCost: 0, neckTwillCost: 0, reflectorsCost: 40.5,
      fusingCost: 8, accessoriesCost: 0, brandTagCost: 5, sizeTagCost: 0,
      packagingCost: 8.5, inwardShipping: 10, proposedMrp: 649,
    },
  },
  {
    articleNumber: '2003',
    productName: 'Aeron',
    type: 'Round Neck T-shirt',
    gender: 'WOMENS',
    garmentingAt: 'Garsem',
    fabricName: 'Bubblegum Dot',
    rows: [
      { newSku: 'W RN05 RED', oldSku: 'W CB01 RED', colour: 'Red', garmentsPerKg: 4.09 },
      { newSku: 'W RN05 NVY', oldSku: 'W CB01 NVY', colour: 'Navy', garmentsPerKg: 4.6 },
    ],
    costs: {
      stitchingCost: 60, brandLogoCost: 0, neckTwillCost: 0, reflectorsCost: 0,
      fusingCost: 6, accessoriesCost: 0, brandTagCost: 5, sizeTagCost: 0,
      packagingCost: 8.5, inwardShipping: 10, proposedMrp: 549,
    },
  },
  {
    articleNumber: '2004',
    productName: 'Sketra',
    type: 'Skirt With Tights',
    gender: 'WOMENS',
    garmentingAt: 'Mumtaz',
    fabricName: 'Zurich',
    rows: [
      { newSku: 'W ST01 BLK', oldSku: 'W ST01 BLK', colour: 'Black', garmentsPerKg: 3.45 },
    ],
    costs: {
      stitchingCost: 240, brandLogoCost: 5, neckTwillCost: 0, reflectorsCost: 5,
      fusingCost: 0, accessoriesCost: 10, brandTagCost: 5, sizeTagCost: 2,
      packagingCost: 12, inwardShipping: 10, proposedMrp: 1599,
    },
  },
];

(async () => {
  await prisma.$transaction(async (tx) => {
    // Ensure ProductTypes
    const typeIds: Record<string, string> = {};
    for (const a of articles) {
      if (typeIds[a.type]) continue;
      let pt = await tx.productType.findFirst({ where: { name: a.type } });
      if (!pt) {
        pt = await tx.productType.create({ data: { name: a.type } });
        console.log(`Created ProductType "${a.type}" (id=${pt.id})`);
      }
      typeIds[a.type] = pt.id;
    }

    for (const a of articles) {
      const garmenting = await tx.garmentingLocation.findFirst({ where: { name: a.garmentingAt } });
      if (!garmenting) throw new Error(`GarmentingLocation "${a.garmentingAt}" not found`);
      const fabric = await tx.fabricMaster.findUnique({ where: { fabricName: a.fabricName } });
      if (!fabric || fabric.mrp == null) throw new Error(`FabricMaster "${a.fabricName}" missing mrp`);
      const fabricCostPerKg = Number(fabric.mrp);

      console.log(`\n--- ${a.articleNumber} ${a.productName} | fabric=${a.fabricName}/${fabricCostPerKg} ---`);

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
            garmentsPerKg: r.garmentsPerKg,
            fabricCostPerKg,
            ...a.costs,
          },
        });
        console.log(`Created ${created.skuCode} | colour=${r.colour} | g/kg=${r.garmentsPerKg} | prev=${JSON.stringify(seedPrev)}`);
      }

      // Link article into FabricMaster.articleNumbers
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
