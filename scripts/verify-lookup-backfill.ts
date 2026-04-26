/**
 * Bundle 1 lookup verifier.
 *
 * Run periodically while the dual-write phase is active. Compares each consumer's string column
 * against its FK column (and array columns against their join tables). Reports any drift so we
 * can catch missed write paths before Phase C drops the strings.
 *
 * Run: npx tsx scripts/verify-lookup-backfill.ts
 */

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });

type ScalarCheck = {
  table: string;
  stringCol: string;
  fkCol: string;
  master: string;
};

const scalarChecks: ScalarCheck[] = [
  { table: "Product",          stringCol: "type",                 fkCol: "typeRefId",               master: "ProductType" },
  { table: "Product",          stringCol: "colourOrdered",        fkCol: "colourOrderedId",         master: "Colour" },
  { table: "Product",          stringCol: "garmentingAt",         fkCol: "garmentingAtId",          master: "GarmentingLocation" },
  { table: "ProductMaster",    stringCol: "type",                 fkCol: "typeRefId",               master: "ProductType" },
  { table: "FabricOrder",      stringCol: "colour",               fkCol: "colourId",                master: "Colour" },
  { table: "FabricOrder",      stringCol: "availableColour",      fkCol: "availableColourId",       master: "Colour" },
  { table: "FabricOrder",      stringCol: "garmentingAt",         fkCol: "garmentingAtId",          master: "GarmentingLocation" },
  { table: "FabricBalance",    stringCol: "colour",               fkCol: "colourId",                master: "Colour" },
  { table: "FabricBalance",    stringCol: "garmentingLocation",   fkCol: "garmentingLocationId",    master: "GarmentingLocation" },
  { table: "AccessoryMaster",  stringCol: "colour",               fkCol: "colourId",                master: "Colour" },
  { table: "AccessoryDispatch",stringCol: "destinationGarmenter", fkCol: "destinationGarmenterId",  master: "GarmentingLocation" },
];

async function checkScalar(c: ScalarCheck) {
  // unmapped: string is set, FK is null
  const unmappedSql = `
    SELECT COUNT(*)::int AS n
    FROM "${c.table}" t
    WHERE t."${c.stringCol}" IS NOT NULL
      AND TRIM(t."${c.stringCol}") <> ''
      AND t."${c.fkCol}" IS NULL`;
  // mismatched: FK is set, but the master's name doesn't match the consumer's string
  const mismatchedSql = `
    SELECT COUNT(*)::int AS n
    FROM "${c.table}" t
    JOIN "${c.master}" m ON m.id = t."${c.fkCol}"
    WHERE TRIM(t."${c.stringCol}") <> m.name`;
  // populated: rows where FK is non-null (indicates total backfill coverage)
  const populatedSql = `SELECT COUNT(*)::int AS n FROM "${c.table}" WHERE "${c.fkCol}" IS NOT NULL`;

  const [unmapped, mismatched, populated] = await Promise.all([
    db.$queryRawUnsafe<Array<{ n: number }>>(unmappedSql),
    db.$queryRawUnsafe<Array<{ n: number }>>(mismatchedSql),
    db.$queryRawUnsafe<Array<{ n: number }>>(populatedSql),
  ]);

  return {
    label: `${c.table}.${c.fkCol}`,
    populated: populated[0].n,
    unmapped: unmapped[0].n,
    mismatched: mismatched[0].n,
  };
}

async function checkFabricMasterColours() {
  // For each FabricMaster, compare the set of names in coloursAvailable against
  // the set of Colour.name values reachable through FabricMasterColour. Mismatches
  // mean either an array entry has no join row, or vice-versa.
  const result = await db.$queryRawUnsafe<Array<{ mismatch: number }>>(`
    WITH array_pairs AS (
      SELECT fm.id AS fmid, TRIM(arr.name) AS name
      FROM "FabricMaster" fm
      CROSS JOIN LATERAL unnest(fm."coloursAvailable") AS arr(name)
      WHERE arr.name IS NOT NULL AND TRIM(arr.name) <> ''
    ),
    join_pairs AS (
      SELECT fmc."fabricMasterId" AS fmid, c.name
      FROM "FabricMasterColour" fmc
      JOIN "Colour" c ON c.id = fmc."colourId"
    ),
    diff AS (
      SELECT * FROM array_pairs EXCEPT SELECT * FROM join_pairs
      UNION ALL
      SELECT * FROM join_pairs EXCEPT SELECT * FROM array_pairs
    )
    SELECT COUNT(*)::int AS mismatch FROM diff
  `);
  const total = await db.fabricMasterColour.count();
  return { label: "FabricMaster.coloursAvailable ↔ FabricMasterColour", populated: total, unmapped: 0, mismatched: result[0].mismatch };
}

async function checkProductMasterColours() {
  const result = await db.$queryRawUnsafe<Array<{ mismatch: number }>>(`
    WITH array_pairs AS (
      SELECT pm.id AS pmid, slot, TRIM(name) AS name FROM "ProductMaster" pm
      CROSS JOIN LATERAL (
        SELECT 1 AS slot, unnest(pm."coloursAvailable")  AS name UNION ALL
        SELECT 2,         unnest(pm."colours2Available") UNION ALL
        SELECT 3,         unnest(pm."colours3Available") UNION ALL
        SELECT 4,         unnest(pm."colours4Available")
      ) arr
      WHERE name IS NOT NULL AND TRIM(name) <> ''
    ),
    join_pairs AS (
      SELECT pmc."productMasterId" AS pmid, pmc.slot, c.name
      FROM "ProductMasterColour" pmc
      JOIN "Colour" c ON c.id = pmc."colourId"
    ),
    diff AS (
      SELECT * FROM array_pairs EXCEPT SELECT * FROM join_pairs
      UNION ALL
      SELECT * FROM join_pairs EXCEPT SELECT * FROM array_pairs
    )
    SELECT COUNT(*)::int AS mismatch FROM diff
  `);
  const total = await db.productMasterColour.count();
  return { label: "ProductMaster.coloursNAvailable ↔ ProductMasterColour", populated: total, unmapped: 0, mismatched: result[0].mismatch };
}

function fmt(n: number) {
  return String(n).padStart(5, " ");
}

async function main() {
  const scalar = await Promise.all(scalarChecks.map(checkScalar));
  const fmC = await checkFabricMasterColours();
  const pmC = await checkProductMasterColours();
  const all = [...scalar, fmC, pmC];

  let totalIssues = 0;
  console.log("");
  console.log("Bundle 1 lookup backfill verification");
  console.log("─".repeat(76));
  console.log(`  ${"Column".padEnd(48)} ${"populated".padStart(9)} ${"unmapped".padStart(9)} ${"mismatch".padStart(9)}`);
  for (const r of all) {
    const status = r.unmapped + r.mismatched === 0 ? "✓" : "✗";
    if (r.unmapped + r.mismatched > 0) totalIssues++;
    console.log(`${status} ${r.label.padEnd(48)} ${fmt(r.populated)} ${fmt(r.unmapped)} ${fmt(r.mismatched)}`);
  }
  console.log("─".repeat(76));
  if (totalIssues === 0) {
    console.log("✓ All clean. Dual-write is keeping FKs in sync with strings.");
    console.log("  When you've seen this for a week or two, you're ready for Phase C.");
  } else {
    console.log(`✗ ${totalIssues} column(s) have drift. Investigate before proceeding to Phase C.`);
    console.log("  unmapped = string was set but FK is null (a write path missed dual-write)");
    console.log("  mismatch = FK row's name differs from string (rename action missed a column)");
  }
  console.log("");

  await db.$disconnect();
  process.exit(totalIssues === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error(err);
  await db.$disconnect();
  process.exit(2);
});
