import { db as prisma } from '../src/lib/db';

const skuByColour: Record<string, string> = {
  'Black': 'M SH02 BLK',
  'Grey': 'M SH02 GRY',
  'Blue': 'M SH02 BLU',
};

(async () => {
  await prisma.$transaction(async (tx) => {
    const pt = await tx.productType.findFirst({ where: { name: 'Shorts' } });
    if (!pt) throw new Error('ProductType Shorts not found');
    const fabric = await tx.fabricMaster.findUnique({ where: { fabricName: 'NS Poly' } });
    if (!fabric) throw new Error('FabricMaster NS Poly not found');

    const orders = await prisma.product.findMany({
      where: { articleNumber: '2111', skuCode: null },
    });
    console.log(`Found ${orders.length} orders without sku`);

    for (const o of orders) {
      const sku = skuByColour[o.colourOrdered];
      if (!sku) { console.log(`SKIP order ${o.id}: no SKU mapping for colour="${o.colourOrdered}"`); continue; }
      await tx.product.update({
        where: { id: o.id },
        data: {
          skuCode: sku,
          type: 'Shorts',
          typeRefId: pt.id,
          productName: 'Glyde',
          styleNumber: '',
          fabricName: 'NS Poly',
          fabricVendorId: fabric.vendorId,
        },
      });
      console.log(`Fixed order ${o.id} colour="${o.colourOrdered}" -> sku=${sku}`);
    }
  });
  await prisma.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
