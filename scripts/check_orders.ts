import { db as prisma } from '../src/lib/db';
const articleNumber = process.argv[2];
(async () => {
  const products = await prisma.product.findMany({
    where: { articleNumber },
    include: { phase: true, fabricVendor: true, fabric2Vendor: true, typeRef: true },
    orderBy: [{ phaseId: 'asc' }, { skuCode: 'asc' }],
  });
  console.log(`Found ${products.length} order line(s) for article ${articleNumber}\n`);
  const byStatus: Record<string, number> = {};
  for (const p of products) byStatus[p.status] = (byStatus[p.status] ?? 0) + 1;
  console.log('Status counts:', byStatus, '\n');
  for (const p of products) {
    console.log(`- phase=${p.phase.name ?? p.phaseId} | sku=${p.skuCode} | colour=${p.colourOrdered} | type=${p.type} | gender=${p.gender} | fabric=${p.fabricName}/${p.fabricVendor.name}${p.fabric2Name?` + ${p.fabric2Name}/${p.fabric2Vendor?.name}`:''} | name=${p.productName} | style=${p.styleNumber} | status=${p.status} | repeat=${p.isRepeat}`);
  }
  await prisma.$disconnect();
})();
