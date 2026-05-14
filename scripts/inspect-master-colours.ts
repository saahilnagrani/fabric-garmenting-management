import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const samples = await prisma.productMaster.findMany({
    where: {
      OR: [
        { skuCode: { in: ["M LO02 BLK", "M LO03 BEI", "W SW01 BLU", "M SH01 BLK"] } },
        { previousSkuCodes: { hasSome: ["M RNT01 BLK", "M EM01 NVY", "M POL01 BLK"] } },
      ],
    },
    select: {
      skuCode: true,
      styleNumber: true,
      articleNumber: true,
      gender: true,
      coloursAvailable: true,
      colours2Available: true,
      previousSkuCodes: true,
    },
  });
  console.log("Sample ProductMasters:");
  console.log(JSON.stringify(samples, null, 2));

  // How does coloursAvailable look in general? Count SKUs with >1 colour.
  const all = await prisma.productMaster.findMany({
    select: { skuCode: true, coloursAvailable: true, colours2Available: true, previousSkuCodes: true },
  });
  const multi = all.filter((p) => p.coloursAvailable.length > 1);
  const withPrev = all.filter((p) => p.previousSkuCodes.length > 0);
  console.log(`\nTotal ProductMaster rows: ${all.length}`);
  console.log(`Rows with >1 colour in coloursAvailable: ${multi.length}`);
  console.log(`Rows with non-empty previousSkuCodes: ${withPrev.length}`);
  console.log("\nExamples of multi-colour rows:");
  console.log(JSON.stringify(multi.slice(0, 5), null, 2));
  console.log("\nExamples of previousSkuCodes rows:");
  console.log(JSON.stringify(withPrev.slice(0, 5), null, 2));

  // Now check the 105 "missing" SKUs against previousSkuCodes too
  const missingFromSheets = [
    "M RNT01 BLK","M RNT01 WHI","M EM01 NVY","M EM01 GRN","M POL01 BLK","M ST01 BLK","M LO02 BLK","M LO03 BLK","W RN02 BLK","K RN01 LMN","W SW09 MAR","M SW 15 BLN",
  ];
  const foundAsPrevious = await prisma.productMaster.findMany({
    where: { previousSkuCodes: { hasSome: missingFromSheets } },
    select: { skuCode: true, previousSkuCodes: true },
  });
  console.log(`\nOf ${missingFromSheets.length} sample missing SKUs, how many resolve via previousSkuCodes? ${foundAsPrevious.length}`);
  console.log(JSON.stringify(foundAsPrevious, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
