import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });

async function main() {
  const masters = await db.productMaster.findMany({
    where: { fabric2Name: { not: null } },
    select: {
      articleNumber: true,
      productName: true,
      fabricName: true,
      fabric2Name: true,
      garmentsPerKg: true,
      garmentsPerKg2: true,
    },
  });
  console.log("\n=== ProductMasters with 2 fabrics:", masters.length, "===");
  console.table(masters);

  const prods = await db.product.findMany({
    where: { fabric2Name: { not: null } },
    select: {
      articleNumber: true,
      fabricName: true,
      fabric2Name: true,
      assumedFabricGarmentsPerKg: true,
      assumedFabric2GarmentsPerKg: true,
    },
  });
  console.log("\n=== Product orders with 2 fabrics:", prods.length, "===");
  console.table(prods);
}

main().then(() => db.$disconnect());
