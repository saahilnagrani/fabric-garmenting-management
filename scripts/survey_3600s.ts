import { db as prisma } from '../src/lib/db';
(async () => {
  console.log('=== Lycra/L-fabrics ===');
  const fLs = await prisma.fabricMaster.findMany({ where: { OR: [{ fabricName: { startsWith: 'L ' } }, { fabricName: { contains: 'Lycra', mode: 'insensitive' } }, { fabricName: { contains: 'Spandex', mode: 'insensitive' } }, { fabricName: { contains: 'Nylon', mode: 'insensitive' } }] }, select: { fabricName: true, mrp: true, vendor: { select: { name: true } } } });
  for (const f of fLs) console.log(`  ${f.fabricName} | ${f.vendor.name} | mrp=${f.mrp}`);
  console.log('\n=== Vendors ===');
  const vendors = await prisma.vendor.findMany({ where: { OR: [{ name: { contains: 'KS', mode: 'insensitive' } }, { name: { contains: 'Global', mode: 'insensitive' } }] }, select: { name: true } });
  for (const v of vendors) console.log(`  ${v.name}`);
  console.log('\n=== Types ===');
  const types = ['Kneesuit','Skort Suit','Two Piece Skort Set','Monokini','Legsuit','Swimdress','Fullsuit','Jammer','Trunks'];
  for (const t of types) {
    const pt = await prisma.productType.findFirst({ where: { name: t } });
    console.log(`  ${t}: ${pt ? 'exists' : 'MISSING'}`);
  }
  console.log('\n=== Garmenting ===');
  const garm = await prisma.garmentingLocation.findMany({ select: { name: true } });
  for (const g of garm) console.log(`  ${g.name}`);
  console.log('\n=== Articles already in DB ===');
  for (let n = 3601; n <= 3619; n++) {
    const c = await prisma.productMaster.count({ where: { articleNumber: String(n) } });
    if (c > 0) console.log(`  ${n}: ${c} master rows`);
  }
  await prisma.$disconnect();
})();
