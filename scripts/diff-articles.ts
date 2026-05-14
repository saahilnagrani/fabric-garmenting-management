import { db } from "../src/lib/db";
import { readFileSync } from "fs";

async function main() {
  const src = readFileSync("scripts/seed-accessory-bom.ts", "utf8");
  const matches = [...src.matchAll(/const RAW = `([\s\S]*?)`;/g)];
  const m = matches[matches.length - 1];
  const inputArticles = new Set(
    m![1].split("\n").map((l) => l.split("|")[0].trim()).filter(Boolean),
  );
  const pms = await db.productMaster.findMany({
    where: { articleNumber: { not: null }, isStrikedThrough: false },
    select: { articleNumber: true },
    distinct: ["articleNumber"],
  });
  const dbArticles = new Set(pms.map((p) => p.articleNumber!).filter(Boolean));
  const onlyInDb = [...dbArticles].filter((a) => !inputArticles.has(a));
  const onlyInInput = [...inputArticles].filter((a) => !dbArticles.has(a));
  console.log("Total DB articles:", dbArticles.size);
  console.log("Total input articles:", inputArticles.size);
  console.log("\nIn DB but NOT in input (" + onlyInDb.length + "):");
  for (const a of onlyInDb.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))) {
    console.log("  " + a);
  }
  console.log("\nIn input but NOT in DB (" + onlyInInput.length + "):");
  for (const a of onlyInInput) console.log("  " + a);
}
main().finally(() => db.$disconnect());
