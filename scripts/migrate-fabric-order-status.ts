import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });

async function main() {
  console.log("1. Converting FabricOrder.orderStatus column to TEXT...");
  await db.$executeRawUnsafe(
    `ALTER TABLE "FabricOrder" ALTER COLUMN "orderStatus" TYPE TEXT USING "orderStatus"::TEXT`
  );

  console.log("2. Dropping default on FabricOrder.orderStatus...");
  await db.$executeRawUnsafe(`ALTER TABLE "FabricOrder" ALTER COLUMN "orderStatus" DROP DEFAULT`);

  console.log("3. Dropping old FabricOrderStatus enum...");
  await db.$executeRawUnsafe(`DROP TYPE "FabricOrderStatus"`);

  console.log("4. Creating new FabricOrderStatus enum...");
  await db.$executeRawUnsafe(`
    CREATE TYPE "FabricOrderStatus" AS ENUM (
      'DRAFT_ORDER',
      'DISCUSSED_WITH_VENDOR',
      'ORDERED',
      'PARTIALLY_SHIPPED',
      'SHIPPED',
      'RECEIVED'
    )
  `);

  console.log("5. Converting FabricOrder.orderStatus back to enum...");
  await db.$executeRawUnsafe(
    `ALTER TABLE "FabricOrder" ALTER COLUMN "orderStatus" TYPE "FabricOrderStatus" USING "orderStatus"::"FabricOrderStatus"`
  );

  console.log("6. Setting default DRAFT_ORDER...");
  await db.$executeRawUnsafe(
    `ALTER TABLE "FabricOrder" ALTER COLUMN "orderStatus" SET DEFAULT 'DRAFT_ORDER'::"FabricOrderStatus"`
  );

  console.log("\n✓ Migration complete. Verifying...");
  const counts = await db.$queryRawUnsafe<Array<{ orderStatus: string; count: bigint }>>(
    `SELECT "orderStatus"::text, COUNT(*)::bigint as count FROM "FabricOrder" GROUP BY "orderStatus" ORDER BY "orderStatus"`
  );
  console.log("FabricOrder status counts after migration:");
  for (const row of counts) console.log(`   ${row.orderStatus}: ${row.count}`);
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
