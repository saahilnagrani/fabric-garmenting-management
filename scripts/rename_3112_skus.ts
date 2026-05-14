import { db as prisma } from '../src/lib/db';
import { renameProductMasterSkuCode } from '../src/lib/article-history';

const renames: Record<string, string> = {
  'W RN01 PCH': 'W RN07 PCH',
  'W RN01 BLK': 'W RN07 BLK',
  'W RN01 BLU': 'W RN07 BLU',
};

(async () => {
  await prisma.$transaction(async (tx) => {
    for (const [oldSku, newSku] of Object.entries(renames)) {
      const row = await tx.productMaster.findUnique({ where: { skuCode: oldSku } });
      if (!row) { console.log(`SKIP ${oldSku}: not found`); continue; }
      await renameProductMasterSkuCode(tx as any, row.id, newSku);
      console.log(`Renamed ${oldSku} -> ${newSku}`);
    }
  });

  const after = await prisma.productMaster.findMany({
    where: { articleNumber: '3112' },
    select: { skuCode: true, previousSkuCodes: true, coloursAvailable: true },
    orderBy: { skuCode: 'asc' },
  });
  console.log('\n3112 master after:');
  for (const r of after) console.log(`- ${r.skuCode} | prev=${JSON.stringify(r.previousSkuCodes)} | colour=${JSON.stringify(r.coloursAvailable)}`);
  await prisma.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
