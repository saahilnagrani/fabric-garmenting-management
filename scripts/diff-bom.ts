/**
 * Compare current ArticleAccessory rows in DB against what seed-accessory-bom
 * would write. Reports any differences so we can decide whether to overwrite.
 */
import { db } from "../src/lib/db";
import { readFileSync } from "fs";

type Row = { article: string; accessory: string; qty: number; applicableSizes: string[] };

const SIZE_EXPANSIONS: Record<string, Array<{ accessory: string; applicableSizes: string[] }>> = {
  "Round - Black - 34": [
    { accessory: "Round - Black - 34", applicableSizes: ["S", "M"] },
    { accessory: "Round - Black - 36", applicableSizes: ["L", "XL"] },
    { accessory: "Round - Black - 38", applicableSizes: ["XXL"] },
  ],
  "Regular Size Label": [
    { accessory: "Regular Size Label (S)", applicableSizes: ["S"] },
    { accessory: "Regular Size Label (M)", applicableSizes: ["M"] },
    { accessory: "Regular Size Label (L)", applicableSizes: ["L"] },
    { accessory: "Regular Size Label (XL)", applicableSizes: ["XL"] },
    { accessory: "Regular Size Label (XXL)", applicableSizes: ["XXL"] },
  ],
  "Kids Size Label": [
    { accessory: "Kids Size Label (6-7Y)", applicableSizes: ["S"] },
    { accessory: "Kids Size Label (8-9Y)", applicableSizes: ["M"] },
    { accessory: "Kids Size Label (10-11Y)", applicableSizes: ["L"] },
    { accessory: "Kids Size Label (12-13Y)", applicableSizes: ["XL"] },
    { accessory: "Kids Size Label (14-15Y)", applicableSizes: ["XXL"] },
  ],
};

function normalize(s: string): string {
  return s.trim().replace(/\s+/g, " ");
}

function parseInput(): Row[] {
  const src = readFileSync("scripts/seed-accessory-bom.ts", "utf8");
  const matches = [...src.matchAll(/const RAW = `([\s\S]*?)`;/g)];
  const raw = matches[matches.length - 1][1];
  const out: Row[] = [];
  for (const line of raw.split("\n")) {
    const [article, accessory, qty] = line.split("|");
    const a = article.trim();
    const acc = normalize(accessory);
    const q = Number(qty);
    const exp = SIZE_EXPANSIONS[acc];
    if (exp) {
      for (const v of exp) out.push({ article: a, accessory: v.accessory, qty: q, applicableSizes: v.applicableSizes });
    } else {
      out.push({ article: a, accessory: acc, qty: q, applicableSizes: [] });
    }
  }
  return out;
}

async function main() {
  const input = parseInput();
  // Dedupe input by (article, accessory, sizes) — last wins
  const inputByArticle = new Map<string, Map<string, Row>>();
  for (const r of input) {
    if (!inputByArticle.has(r.article)) inputByArticle.set(r.article, new Map());
    const key = `${r.accessory}|${r.applicableSizes.slice().sort().join(",")}`;
    inputByArticle.get(r.article)!.set(key, r);
  }

  const articles = [...inputByArticle.keys()];
  const allLinks = await db.articleAccessory.findMany({
    where: { articleNumber: { in: articles } },
    include: { accessory: { select: { displayName: true } } },
  });
  const dbByArticle = new Map<string, Array<{ accessory: string; qty: number; applicableSizes: string[] }>>();
  for (const l of allLinks) {
    const arr = dbByArticle.get(l.articleNumber) ?? [];
    arr.push({
      accessory: normalize(l.accessory.displayName),
      qty: Number(l.quantityPerPiece),
      applicableSizes: [...l.applicableSizes].sort(),
    });
    dbByArticle.set(l.articleNumber, arr);
  }

  const changed: string[] = [];
  const unchanged: string[] = [];
  const newOnes: string[] = [];

  for (const article of articles.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))) {
    const inputRows = [...inputByArticle.get(article)!.values()];
    const dbRows = dbByArticle.get(article) ?? [];
    if (dbRows.length === 0) {
      newOnes.push(article);
      continue;
    }
    // Build sets keyed by accessory+sizes
    const inputKeys = new Map<string, number>(
      inputRows.map((r) => [`${r.accessory}|${r.applicableSizes.slice().sort().join(",")}`, r.qty]),
    );
    const dbKeys = new Map<string, number>(
      dbRows.map((r) => [`${r.accessory}|${r.applicableSizes.join(",")}`, r.qty]),
    );

    const diffs: string[] = [];
    for (const [k, q] of inputKeys.entries()) {
      if (!dbKeys.has(k)) diffs.push(`  + ${k.replace("|", " [")}] qty=${q} (in input, missing in DB)`);
      else if (Math.abs(dbKeys.get(k)! - q) > 1e-6)
        diffs.push(`  ≠ ${k.replace("|", " [")}] qty input=${q} vs db=${dbKeys.get(k)}`);
    }
    for (const [k, q] of dbKeys.entries()) {
      if (!inputKeys.has(k)) diffs.push(`  − ${k.replace("|", " [")}] qty=${q} (in DB, missing from input)`);
    }
    if (diffs.length > 0) {
      changed.push(article);
      console.log(`\n[${article}] DIFFERS:`);
      for (const d of diffs) console.log(d);
    } else {
      unchanged.push(article);
    }
  }

  console.log(`\n\nSUMMARY:`);
  console.log(`  Unchanged (would be a no-op re-write): ${unchanged.length}`);
  console.log(`    ${unchanged.join(", ")}`);
  console.log(`  Changed (input differs from DB): ${changed.length}`);
  console.log(`    ${changed.join(", ")}`);
  console.log(`  New (no BOM in DB yet): ${newOnes.length}`);
  console.log(`    ${newOnes.join(", ")}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
