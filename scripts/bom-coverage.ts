import { db } from "../src/lib/db";
import { readFileSync } from "fs";

async function main() {
  const src = readFileSync("scripts/seed-accessory-bom.ts", "utf8");
  const matches = [...src.matchAll(/const RAW = `([\s\S]*?)`;/g)];
  const inputArticles = new Set(
    matches[matches.length - 1][1]
      .split("\n")
      .map((l) => l.split("|")[0].trim())
      .filter(Boolean),
  );
  const rows = await db.articleAccessory.groupBy({
    by: ["articleNumber"],
    _count: { _all: true },
  });
  const dbBomMap = new Map(rows.map((r) => [r.articleNumber, r._count._all]));
  const withBom: string[] = [];
  const withoutBom: string[] = [];
  for (const a of [...inputArticles].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))) {
    if (dbBomMap.has(a)) withBom.push(a + " (" + dbBomMap.get(a) + " rows)");
    else withoutBom.push(a);
  }
  console.log("Input articles WITH existing BOM (" + withBom.length + "):");
  for (const a of withBom) console.log("  " + a);
  console.log("\nInput articles WITHOUT existing BOM (" + withoutBom.length + "):");
  for (const a of withoutBom) console.log("  " + a);
}
main().finally(() => db.$disconnect());
