import { db as prisma } from '../src/lib/db';

const OLD_NAMES = ['Nylon IU 160', 'Nylon IU 161', 'Nylon IU 162'];
const NEW_NAME = 'Nylon IU 160/161/162';

(async () => {
  await prisma.$transaction(async (tx) => {
    const olds = await tx.fabricMaster.findMany({ where: { fabricName: { in: OLD_NAMES } } });
    if (olds.length !== 3) throw new Error(`Expected 3 old fabrics, found ${olds.length}`);
    const vendorId = olds[0].vendorId;
    const mrp = olds[0].mrp;
    if (!olds.every((f) => f.vendorId === vendorId)) throw new Error('Vendor mismatch across olds');

    // Create the merged FabricMaster
    let merged = await tx.fabricMaster.findUnique({ where: { fabricName: NEW_NAME } });
    if (!merged) {
      merged = await tx.fabricMaster.create({
        data: {
          fabricName: NEW_NAME,
          vendorId,
          mrp,
          genders: Array.from(new Set(olds.flatMap((f) => f.genders))),
          articleNumbers: Array.from(new Set(olds.flatMap((f) => f.articleNumbers))),
          deletedArticleNumbers: Array.from(new Set(olds.flatMap((f) => f.deletedArticleNumbers))),
          coloursAvailable: Array.from(new Set(olds.flatMap((f) => f.coloursAvailable))),
        },
      });
      console.log(`Created merged FabricMaster "${NEW_NAME}" (id=${merged.id}) mrp=${merged.mrp} articleNumbers=${JSON.stringify(merged.articleNumbers)}`);
    } else {
      console.log(`Reusing existing merged FabricMaster "${NEW_NAME}" (id=${merged.id})`);
    }

    // Migrate FabricMasterColour links
    for (const old of olds) {
      const links = await tx.fabricMasterColour.findMany({ where: { fabricMasterId: old.id } });
      for (const l of links) {
        const exists = await tx.fabricMasterColour.findFirst({ where: { fabricMasterId: merged.id, colourId: l.colourId } });
        if (!exists) {
          await tx.fabricMasterColour.create({ data: { fabricMasterId: merged.id, colourId: l.colourId } });
          console.log(`Linked colourId=${l.colourId} to merged fabric`);
        }
        await tx.fabricMasterColour.delete({ where: { fabricMasterId_colourId: { fabricMasterId: old.id, colourId: l.colourId } } });
      }
    }

    // Update string references on ProductMaster (slots 1-4)
    for (const slot of ['fabricName', 'fabric2Name', 'fabric3Name', 'fabric4Name'] as const) {
      const updated = await tx.productMaster.updateMany({
        where: { [slot]: { in: OLD_NAMES } } as Record<string, unknown>,
        data: { [slot]: NEW_NAME },
      });
      if (updated.count > 0) console.log(`ProductMaster.${slot}: updated ${updated.count} rows`);
    }

    // Update Product (orders) fabricName / fabric2Name
    for (const slot of ['fabricName', 'fabric2Name'] as const) {
      const updated = await tx.product.updateMany({
        where: { [slot]: { in: OLD_NAMES } } as Record<string, unknown>,
        data: { [slot]: NEW_NAME },
      });
      if (updated.count > 0) console.log(`Product.${slot}: updated ${updated.count} rows`);
    }

    // Update FabricOrder.fabricName
    const fo = await tx.fabricOrder.updateMany({
      where: { fabricName: { in: OLD_NAMES } },
      data: { fabricName: NEW_NAME },
    });
    if (fo.count > 0) console.log(`FabricOrder: updated ${fo.count} rows`);

    // Strike through old FabricMaster rows + clear their articleNumbers
    for (const old of olds) {
      await tx.fabricMaster.update({
        where: { id: old.id },
        data: {
          isStrikedThrough: true,
          articleNumbers: { set: [] },
        },
      });
      console.log(`Striked-through old fabric ${old.fabricName} (id=${old.id})`);
    }
  });

  // Verify
  console.log('\n=== AFTER ===');
  const allRefs = await prisma.productMaster.findMany({
    where: { fabricName: NEW_NAME },
    select: { skuCode: true, articleNumber: true, fabricName: true },
  });
  for (const r of allRefs) console.log(`master ${r.skuCode} (${r.articleNumber}): ${r.fabricName}`);
  const orders = await prisma.product.findMany({
    where: { fabricName: NEW_NAME },
    select: { id: true, skuCode: true, fabricName: true },
  });
  for (const o of orders) console.log(`order ${o.id} (${o.skuCode}): ${o.fabricName}`);
  const fOrders = await prisma.fabricOrder.findMany({ where: { fabricName: NEW_NAME }, select: { id: true, fabricName: true, orderStatus: true } });
  for (const f of fOrders) console.log(`fabric order ${f.id}: ${f.fabricName} (${f.orderStatus})`);
  const merged = await prisma.fabricMaster.findUnique({ where: { fabricName: NEW_NAME } });
  console.log(`Merged fabric: ${merged?.fabricName} mrp=${merged?.mrp} articleNumbers=${JSON.stringify(merged?.articleNumbers)}`);
  const oldsAfter = await prisma.fabricMaster.findMany({ where: { fabricName: { in: OLD_NAMES } } });
  for (const f of oldsAfter) console.log(`Old ${f.fabricName}: striked=${f.isStrikedThrough} articleNumbers=${JSON.stringify(f.articleNumbers)}`);

  await prisma.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
