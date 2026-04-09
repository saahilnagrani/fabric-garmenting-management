import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });

async function main() {
  const fabricOrders = await db.fabricOrder.findMany({
    where: {
      fabricName: { contains: "Inner Nylon", mode: "insensitive" },
      fabricVendor: { name: { contains: "Ultron", mode: "insensitive" } },
    },
    orderBy: [{ phaseId: "asc" }, { createdAt: "asc" }],
    include: { phase: { select: { name: true } }, fabricVendor: { select: { name: true } } },
  });

  console.log(`\n=== Ultron / Inner Nylon fabric orders: ${fabricOrders.length} ===\n`);

  for (const fo of fabricOrders) {
    console.log(`── FabricOrder id=${fo.id.slice(-6)} [${fo.phase.name}] ──`);
    console.log(`   fabric: ${fo.fabricName}`);
    console.log(`   colour: ${fo.colour}`);
    console.log(`   articleNumbers: "${fo.articleNumbers}"`);
    console.log(`   orderedKg: ${fo.fabricOrderedQuantityKg}  costPerUnit: ${fo.costPerUnit}`);
    console.log(`   status: ${fo.orderStatus}`);

    const articleList = fo.articleNumbers.split(",").map((a) => a.trim()).filter(Boolean);

    const candidates = await db.product.findMany({
      where: {
        phaseId: fo.phaseId,
        articleNumber: { in: articleList.length > 0 ? articleList : ["__none__"] },
      },
      select: {
        id: true,
        articleNumber: true,
        colourOrdered: true,
        fabricName: true,
        fabric2Name: true,
      },
    });

    const matches = candidates
      .map((p) => {
        const isPrimary = p.fabricName === fo.fabricName;
        const isSecondary = p.fabric2Name === fo.fabricName;
        const colourMatch =
          p.colourOrdered?.toLowerCase().trim() === fo.colour?.toLowerCase().trim();
        return { product: p, slot: isPrimary ? 1 : isSecondary ? 2 : null, colourMatch };
      })
      .filter((m) => m.slot !== null && m.colourMatch);

    if (matches.length === 0) {
      console.log(`   → NO MATCH (${candidates.length} same-article candidates)`);
      for (const c of candidates) {
        console.log(
          `      id=${c.id.slice(-6)} article=${c.articleNumber} colour=${c.colourOrdered} fab1="${c.fabricName}" fab2="${c.fabric2Name || "-"}"`
        );
      }
    } else {
      console.log(`   → ${matches.length} match(es):`);
      for (const m of matches) {
        console.log(
          `      Product id=${m.product.id.slice(-6)} article=${m.product.articleNumber} colour=${m.product.colourOrdered} slot=${m.slot}`
        );
      }
    }
    console.log("");
  }
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
