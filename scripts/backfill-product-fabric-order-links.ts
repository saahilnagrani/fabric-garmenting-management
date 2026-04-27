/**
 * One-shot backfill: re-create ProductFabricOrder links for Products created
 * via phase planning that didn't get linked because of the multi-fabric colour
 * key bug.
 *
 * Heuristic per Product P (colourOrdered may be "Black" or "Black/Lime/..."):
 *   - For slot 1: split colourOrdered by "/" -> token[0] = slot colour. Find
 *     FabricOrders in same phase with articleNumbers containing P.articleNumber,
 *     fabricName === P.fabricName, colour matching slot colour. Link them.
 *   - For slot 2: token[1] -> match P.fabric2Name. Link.
 *
 * Does NOT delete existing links. Idempotent: skips a (productId, fabricOrderId)
 * pair that's already linked.
 *
 * Usage:
 *   npx tsx scripts/backfill-product-fabric-order-links.ts            # all phases
 *   npx tsx scripts/backfill-product-fabric-order-links.ts <phaseId>  # one phase
 */
import { db } from "../src/lib/db";

async function main() {
  const phaseFilter = process.argv[2];
  const products = await db.product.findMany({
    where: phaseFilter ? { phaseId: phaseFilter } : {},
    include: { fabricOrderLinks: true },
  });
  console.log(`Scanning ${products.length} products...`);

  let created = 0;
  let alreadyLinked = 0;
  let unmatched = 0;

  for (const p of products) {
    if (!p.articleNumber) continue;
    const tokens = (p.colourOrdered || "").split("/").map((c) => c.trim()).filter(Boolean);

    const slots: Array<{ slot: 1 | 2; fabricName: string | null; colour: string | undefined }> = [
      { slot: 1, fabricName: p.fabricName, colour: tokens[0] },
      { slot: 2, fabricName: p.fabric2Name, colour: tokens[1] },
    ];

    for (const s of slots) {
      if (!s.fabricName || !s.colour) continue;
      const candidates = await db.fabricOrder.findMany({
        where: {
          phaseId: p.phaseId,
          fabricName: s.fabricName,
          colour: s.colour,
          articleNumbers: { contains: p.articleNumber },
        },
        select: { id: true, articleNumbers: true },
      });
      const matches = candidates.filter((fo) => {
        const list = (fo.articleNumbers || "").split(",").map((a) => a.trim()).filter(Boolean);
        return list.includes(p.articleNumber!);
      });
      if (matches.length === 0) {
        unmatched++;
        continue;
      }
      for (const fo of matches) {
        const exists = p.fabricOrderLinks.some((l) => l.fabricOrderId === fo.id && l.fabricSlot === s.slot);
        if (exists) {
          alreadyLinked++;
          continue;
        }
        await db.productFabricOrder.create({
          data: { productId: p.id, fabricOrderId: fo.id, fabricSlot: s.slot },
        });
        created++;
      }
    }
  }

  console.log(`Done. Created ${created}, already linked ${alreadyLinked}, unmatched slots ${unmatched}.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await db.$disconnect(); });
