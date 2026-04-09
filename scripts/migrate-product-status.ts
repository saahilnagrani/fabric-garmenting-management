import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });

async function main() {
  console.log("1. Converting Product.status column to TEXT...");
  await db.$executeRawUnsafe(
    `ALTER TABLE "Product" ALTER COLUMN "status" TYPE TEXT USING "status"::TEXT`
  );

  console.log("2. Dropping default on Product.status...");
  await db.$executeRawUnsafe(`ALTER TABLE "Product" ALTER COLUMN "status" DROP DEFAULT`);

  console.log("3. Remapping old values to new...");
  const mappings: [string, string][] = [
    ["PROCESSING", "PLANNED"],
    ["SAMPLE_WITH_ST", "SAMPLING"],
    ["SAMPLE_READY", "CUTTING_REPORT"],
    ["READY_AT_GARSEM", "READY_AT_GARMENTER"],
    ["READY_AT_MUMTAZ", "READY_AT_GARMENTER"],
    // RECEIVED_AT_WAREHOUSE and SHIPPED stay the same
  ];
  for (const [oldVal, newVal] of mappings) {
    const count = await db.$executeRawUnsafe(
      `UPDATE "Product" SET "status" = $1 WHERE "status" = $2`,
      newVal,
      oldVal
    );
    console.log(`   ${oldVal} → ${newVal}: ${count} rows`);
  }

  console.log("4. Dropping old ProductStatus enum...");
  await db.$executeRawUnsafe(`DROP TYPE "ProductStatus"`);

  console.log("5. Creating new ProductStatus enum...");
  await db.$executeRawUnsafe(`
    CREATE TYPE "ProductStatus" AS ENUM (
      'PLANNED',
      'FABRIC_ORDERED',
      'FABRIC_RECEIVED',
      'SAMPLING',
      'CUTTING_REPORT',
      'IN_PRODUCTION',
      'READY_AT_GARMENTER',
      'SHIPPED_TO_WAREHOUSE',
      'RECEIVED_AT_WAREHOUSE',
      'SHIPPED'
    )
  `);

  console.log("6. Converting Product.status back to enum...");
  await db.$executeRawUnsafe(
    `ALTER TABLE "Product" ALTER COLUMN "status" TYPE "ProductStatus" USING "status"::"ProductStatus"`
  );

  console.log("7. Setting new default PLANNED...");
  await db.$executeRawUnsafe(
    `ALTER TABLE "Product" ALTER COLUMN "status" SET DEFAULT 'PLANNED'::"ProductStatus"`
  );

  console.log("8. Adding cuttingReportGarmentsPerKg columns to Product and ProductMaster...");
  await db.$executeRawUnsafe(
    `ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "cuttingReportGarmentsPerKg" DECIMAL(10, 2)`
  );
  await db.$executeRawUnsafe(
    `ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "cuttingReportGarmentsPerKg2" DECIMAL(10, 2)`
  );
  await db.$executeRawUnsafe(
    `ALTER TABLE "ProductMaster" ADD COLUMN IF NOT EXISTS "cuttingReportGarmentsPerKg" DECIMAL(10, 2)`
  );
  await db.$executeRawUnsafe(
    `ALTER TABLE "ProductMaster" ADD COLUMN IF NOT EXISTS "cuttingReportGarmentsPerKg2" DECIMAL(10, 2)`
  );

  console.log("\n✓ Migration complete. Verifying...");
  const counts = await db.$queryRawUnsafe<Array<{ status: string; count: bigint }>>(
    `SELECT status::text, COUNT(*)::bigint as count FROM "Product" GROUP BY status ORDER BY status`
  );
  console.log("Product status counts after migration:");
  for (const row of counts) console.log(`   ${row.status}: ${row.count}`);
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
