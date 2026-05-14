import { db as prisma } from '../src/lib/db';
(async () => {
  const existing = await prisma.productMaster.findUnique({ where: { skuCode: 'M POL01 BEI' } });
  if (existing) { console.log('M POL01 BEI already exists'); return; }
  const pt = await prisma.productType.findFirst({ where: { name: 'Polo' } });
  const garm = await prisma.garmentingLocation.findFirst({ where: { name: 'Walknit' } });
  const fab = await prisma.fabricMaster.findUnique({ where: { fabricName: 'Mars' } });
  if (!pt || !garm || !fab) throw new Error('prereq missing');
  const created = await prisma.productMaster.create({
    data: {
      articleNumber: '1103',
      skuCode: 'M POL01 BEI',
      previousSkuCodes: [],
      styleNumber: '',
      productName: 'Aeroflux',
      type: 'Polo',
      typeRefId: pt.id,
      gender: 'MENS',
      garmentingAt: 'Walknit',
      garmentingAtId: garm.id,
      fabricName: 'Mars',
      coloursAvailable: ['Beige'],
      colours2Available: [],
      colours3Available: [],
      colours4Available: [],
      garmentsPerKg: 4,
      fabricCostPerKg: Number(fab.mrp),
      stitchingCost: 110, brandLogoCost: 12, neckTwillCost: 0, reflectorsCost: 8,
      fusingCost: 0, accessoriesCost: 0, brandTagCost: 5, sizeTagCost: 4,
      packagingCost: 12, inwardShipping: 10, proposedMrp: 749,
      isStrikedThrough: true,
    },
  });
  console.log(`Created struck-through ${created.skuCode} (Beige)`);
})().finally(() => prisma.$disconnect());
