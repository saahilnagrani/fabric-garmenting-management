import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });

function normColour(s: string | null | undefined): string {
  return (s || "").toLowerCase().trim();
}

async function main() {
  const fabricOrders = await db.fabricOrder.findMany({
    include: { phase: { select: { name: true } } },
  });
  console.log(`\nBackfilling joins for ${fabricOrders.length} fabric orders...\n`);

  let linked = 0;
  let skipped = 0;
  const orphans: Array<{ id: string; phase: string; fabric: string; colour: string; articleNumbers: string; reason: string }> = [];

  for (const fo of fabricOrders) {
    const articleList = fo.articleNumbers.split(",").map((a) => a.trim()).filter(Boolean);
    if (articleList.length === 0) {
      orphans.push({ id: fo.id, phase: fo.phase.name, fabric: fo.fabricName, colour: fo.colour, articleNumbers: fo.articleNumbers, reason: "empty articleNumbers" });
      continue;
    }

    const candidates = await db.product.findMany({
      where: { phaseId: fo.phaseId, articleNumber: { in: articleList } },
      select: { id: true, articleNumber: true, colourOrdered: true, fabricName: true, fabric2Name: true },
    });

    const matches = candidates
      .map((p) => {
        const slot = p.fabricName === fo.fabricName ? 1 : p.fabric2Name === fo.fabricName ? 2 : null;
        const colourMatch = normColour(p.colourOrdered) === normColour(fo.colour);
        return { product: p, slot, colourMatch };
      })
      .filter((m) => m.slot !== null && m.colourMatch);

    if (matches.length === 0) {
      orphans.push({
        id: fo.id,
        phase: fo.phase.name,
        fabric: fo.fabricName,
        colour: fo.colour,
        articleNumbers: fo.articleNumbers,
        reason: candidates.length === 0 ? "no products with matching article#" : `candidates exist but fabric/colour mismatch (${candidates.length})`,
      });
      continue;
    }

    for (const m of matches) {
      try {
        await db.productFabricOrder.create({
          data: { productId: m.product.id, fabricOrderId: fo.id, fabricSlot: m.slot! },
        });
        linked++;
      } catch (e: unknown) {
        // Already exists (rerun-safe)
        if ((e as { code?: string }).code === "P2002") skipped++;
        else throw e;
      }
    }
  }

  const total = await db.productFabricOrder.count();
  console.log(`\n✓ Backfill complete`);
  console.log(`  Linked: ${linked} new join rows`);
  console.log(`  Skipped (already exists): ${skipped}`);
  console.log(`  Orphaned fabric orders: ${orphans.length}`);
  console.log(`  Total ProductFabricOrder rows in DB: ${total}`);

  if (orphans.length > 0) {
    console.log(`\n── Orphaned fabric orders (manual review) ──`);
    for (const o of orphans) {
      console.log(`  [${o.phase}] ${o.fabric} / ${o.colour} / articles="${o.articleNumbers}" — ${o.reason}`);
    }
  }
}

main().catch((e) => { console.error("Backfill failed:", e); process.exit(1); }).finally(() => db.$disconnect());
