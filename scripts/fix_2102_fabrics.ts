import { db as prisma } from '../src/lib/db';
const fabricBySku: Record<string, string> = {
  'M RN04 BLK': 'Nylon IU 160',
  'M RN04 BLU': 'Nylon IU 161',
  'M RN04 WIN': 'Nylon IU 162',
};
(async () => {
  await prisma.$transaction(async (tx) => {
    for (const [sku, fabricName] of Object.entries(fabricBySku)) {
      await tx.productMaster.update({ where: { skuCode: sku }, data: { fabricName } });
      console.log(`Set fabricName=${fabricName} for ${sku}`);
    }
  });
  await prisma.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
