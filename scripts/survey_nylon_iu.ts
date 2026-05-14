import { db as prisma } from '../src/lib/db';
const NAMES = ['Nylon IU 160', 'Nylon IU 161', 'Nylon IU 162'];
(async () => {
  console.log('=== ProductMaster ===');
  const masters = await prisma.productMaster.findMany({
    where: { OR: [{ fabricName: { in: NAMES } }, { fabric2Name: { in: NAMES } }, { fabric3Name: { in: NAMES } }, { fabric4Name: { in: NAMES } }] },
    select: { skuCode: true, articleNumber: true, fabricName: true, fabric2Name: true, fabric3Name: true, fabric4Name: true },
  });
  for (const m of masters) console.log(JSON.stringify(m));

  console.log('\n=== Product (orders) ===');
  const orders = await prisma.product.findMany({
    where: { OR: [{ fabricName: { in: NAMES } }, { fabric2Name: { in: NAMES } }] },
    select: { id: true, skuCode: true, articleNumber: true, status: true, fabricName: true, fabric2Name: true },
  });
  for (const o of orders) console.log(JSON.stringify(o));

  console.log('\n=== FabricOrder ===');
  const fOrders = await prisma.fabricOrder.findMany({ where: { fabricName: { in: NAMES } }, select: { id: true, fabricName: true, orderStatus: true } });
  for (const f of fOrders) console.log(JSON.stringify(f));

  console.log('\n=== FabricMaster ===');
  const fms = await prisma.fabricMaster.findMany({ where: { fabricName: { in: NAMES } }, select: { id: true, fabricName: true, mrp: true, vendorId: true, articleNumbers: true, deletedArticleNumbers: true } });
  for (const f of fms) console.log(JSON.stringify(f));
  await prisma.$disconnect();
})();
