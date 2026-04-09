/**
 * One-time script to populate the Colours table from existing
 * FabricMaster.coloursAvailable and ProductMaster.coloursAvailable data.
 *
 * Usage: npx tsx scripts/populate-colours.ts
 */

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });

function generateCode(name: string): string {
  // Take first 3 letters, uppercase. Handle short names.
  const cleaned = name.replace(/[^a-zA-Z]/g, "").toUpperCase();
  if (cleaned.length >= 3) return cleaned.slice(0, 3);
  return cleaned.padEnd(3, "X");
}

async function main() {
  console.log("Fetching colours from Fabric Masters...");
  const fabricMasters = await db.fabricMaster.findMany({
    select: { coloursAvailable: true },
  });
  const fabricColours = new Set<string>();
  for (const fm of fabricMasters) {
    for (const c of fm.coloursAvailable) {
      if (c.trim()) fabricColours.add(c.trim());
    }
  }
  console.log(`  Found ${fabricColours.size} unique colours from Fabric Masters`);

  console.log("Fetching colours from Product Masters...");
  const productMasters = await db.productMaster.findMany({
    select: { coloursAvailable: true },
  });
  const productColours = new Set<string>();
  for (const pm of productMasters) {
    for (const c of pm.coloursAvailable) {
      if (c.trim()) productColours.add(c.trim());
    }
  }
  console.log(`  Found ${productColours.size} unique colours from Product Masters`);

  // Merge all colours
  const allColours = new Set([...fabricColours, ...productColours]);
  console.log(`\nTotal unique colours: ${allColours.size}`);

  // Get existing colours
  const existing = await db.colour.findMany({ select: { name: true } });
  const existingNames = new Set(existing.map((c) => c.name.toLowerCase()));
  console.log(`Existing colours in DB: ${existing.length}`);

  // Find missing colours
  const missing: string[] = [];
  for (const colour of allColours) {
    if (!existingNames.has(colour.toLowerCase())) {
      missing.push(colour);
    }
  }

  if (missing.length === 0) {
    console.log("\nAll colours already exist. Nothing to do.");
    return;
  }

  console.log(`\nInserting ${missing.length} new colours:`);
  // Collect codes to avoid duplicates
  const usedCodes = new Set(
    (await db.colour.findMany({ select: { code: true } })).map((c) => c.code)
  );

  let inserted = 0;
  for (const name of missing.sort()) {
    let code = generateCode(name);
    // Ensure unique code
    let suffix = 1;
    while (usedCodes.has(code)) {
      code = generateCode(name).slice(0, 2) + String(suffix);
      suffix++;
    }
    usedCodes.add(code);

    try {
      await db.colour.create({ data: { name, code } });
      console.log(`  + ${name} (${code})`);
      inserted++;
    } catch (err) {
      console.log(`  ! Skipped "${name}" — already exists or error`);
    }
  }

  console.log(`\nDone. Inserted ${inserted} colours.`);
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
