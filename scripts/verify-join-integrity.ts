import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });

async function main() {
  // 1. Check Ultron/Inner Nylon orders have been linked
  const ultronOrders = await db.fabricOrder.findMany({
    where: {
      fabricName: "Inner Nylon",
      fabricVendor: { name: "Ultron" },
    },
    include: { productLinks: { include: { product: { select: { articleNumber: true, colourOrdered: true } } } } },
  });
  console.log(`\n=== Ultron/Inner Nylon fabric orders and their linked products ===`);
  for (const fo of ultronOrders) {
    const links = fo.productLinks.map((l) => `${l.product.articleNumber}/${l.product.colourOrdered}(slot${l.fabricSlot})`);
    console.log(`  ${fo.fabricName} / ${fo.colour} / articles="${fo.articleNumbers}" → [${links.join(", ") || "NONE"}]`);
  }

  // 2. Check a Product's fabric order links (reverse direction)
  const product = await db.product.findFirst({
    where: { articleNumber: "2103", colourOrdered: "Black" },
    include: {
      fabricOrderLinks: {
        include: {
          fabricOrder: { select: { fabricName: true, colour: true, orderStatus: true, fabricOrderedQuantityKg: true } },
        },
      },
    },
  });
  console.log(`\n=== Product 2103/Black fabric order links (reverse) ===`);
  if (product) {
    for (const l of product.fabricOrderLinks) {
      console.log(
        `  slot ${l.fabricSlot}: ${l.fabricOrder.fabricName} / ${l.fabricOrder.colour} / ${l.fabricOrder.fabricOrderedQuantityKg}kg / status=${l.fabricOrder.orderStatus}`
      );
    }
  }

  // 3. Overall count
  const total = await db.productFabricOrder.count();
  console.log(`\n=== Total ProductFabricOrder join rows: ${total} ===\n`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
