/**
 * Seed accessory BOM: link AccessoryMasters to ProductMasters by articleNumber.
 *
 * Input: hardcoded list of {articleNumber, accessoryDisplayName, qty}.
 * For each row, find all ProductMasters with that articleNumber and the
 * AccessoryMaster with matching displayName (whitespace-normalized). Upsert
 * ProductMasterAccessory with quantityPerPiece = qty. Duplicate (article,
 * accessory) rows in the input are summed.
 *
 * Usage:
 *   npx tsx scripts/seed-accessory-bom.ts --check   # dry-run, report mismatches
 *   npx tsx scripts/seed-accessory-bom.ts           # apply (refuses if mismatches)
 */
import { db } from "../src/lib/db";

type Row = { article: string; accessory: string; qty: number; applicableSizes?: string[] };

/**
 * Size-dependent accessories: when the BOM lists a single size variant (e.g.
 * "Round - Black - 34"), it stands in for a *family* of size-specific
 * variants. We expand into one BOM row per variant with the matching
 * applicableSizes so dispatch logic can compute per-size quantities.
 *
 * Currently only the "Round - Black" elastic uses this; add more here as
 * needed.
 */
type SizeExpansion = {
  // Variant accessory displayName (must exist in AccessoryMaster)
  accessory: string;
  applicableSizes: string[];
};
const SIZE_EXPANSIONS: Record<string, SizeExpansion[]> = {
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

const RAW_OLD_UNUSED = `1001|Round Dots|1
1001|1" - Silver Logo|1
1001|Regular Size Label|1
1001|Nylon Neck twill Tape with Brand Name - 10 mm|0.1905
1002|Round Dots|1
1002|1" - Silver Logo|1
1002|Regular Size Label|1
1002|Nylon Neck twill Tape with Brand Name - 10 mm|0.1905
1003|Regular Zipper - YKK|1
1003|1" - 3D Black Logo|1
1003|1" - 3D Black Logo|1
1003|Regular Zipper - YKK|1
1003|Regular Size Label|1
1003|Nylon Neck twill Tape with Brand Name - 10 mm|0.1905
1004|Regular Zipper - YKK|1
1004|1" - 3D Black Logo|1
1004|1" - 3D Black Logo|1
1004|Regular Zipper - YKK|1
1004|Regular Size Label|1
1004|Nylon Neck twill Tape with Brand Name - 10 mm|0.1905
1005|2"  Brand Name|1
1005|Gold Elastic 38mm |0.7112
1005|Regular Size Label|1
1005|Round - Black - 34|1
1007-1|Round Dots|1
1007-1|2"  Brand Name|1
1007-1|Gold Elastic 38mm |0.7112
1007-1|Regular Size Label|1
1007-1|Round - Black - 34|1
1007-2|Round Dots|1
1007-2|2"  Brand Name|1
1007-2|Gold Elastic 38mm |0.7112
1007-2|Regular Size Label|1
1007-2|Round - Black - 34|1
1007-3|Round Dots|1
1007-3|2"  Brand Name|1
1007-3|Gold Elastic 38mm |0.7112
1007-3|Regular Size Label|1
1007-3|Round - Black - 34|1
1008-1|1" - Silver Logo|1
1008-1|2"  Brand Name|1
1008-1|Concealed Zipper - YKK|1
1008-1|Regular Size Label|1
1008-2|1" - Silver Logo|1
1008-2|Concealed Zipper - YKK|1
1008-2|Regular Size Label|1
1008-3|1" - Silver Logo|1
1008-3|2"  Brand Name|1
1008-3|Concealed Zipper - YKK|1
1008-3|Regular Size Label|1
1009-1|2"  Brand Name|1
1009-1|Regular Size Label|1
1009-2|2"  Brand Name|1
1009-2|Regular Size Label|1
1101|1" - Silver Logo|1
1101|5mm Straight Line|1
1101|Regular Size Label|1
1101|Nylon Neck twill Tape with Brand Name - 10 mm|0.1905
1102|6" Vertical Brand Name|1
1102|1" - Silver Logo|1
1102|Regular Size Label|1
1102|Nylon Neck twill Tape with Brand Name - 10 mm|0.1905
1102|Round Dots|1
1103|6mm Straight Line|1
1103|1" - 3D Black Logo|1
1103|Regular Size Label|1
1103|Matte Finish - 18 Line Black Button with Brand Name |2
1103|Nylon Neck twill Tape with Brand Name - 10 mm|0.1905
2001|2"  Brand Name|1
2001|Nylon Neck twill Tape with Brand Name - 10 mm|0.1905
2001|Regular Size Label|1
2002|Progress Over Perfection|1
2002|6" Vertical Brand Name|1
2002|Regular Size Label|1
2002|Nylon Neck twill Tape with Brand Name - 10 mm|0.1905
2003|6" Vertical Brand Name|1
2003|1" - Silver Logo|1
2003|Regular Size Label|1
2003|Nylon Neck twill Tape with Brand Name - 10 mm|0.1905
2005|Concealed Zipper - YKK|1
2005|2"  Brand Name|1
2005|1" - Silver Logo|1
2005|Round Dots|1
2005|2"  Brand Name|1
2005|Regular Size Label|1
2005|Concealed Zipper - YKK|1
2006|6" Vertical Brand Name|1
2006|Round Dots|1
2006|Gold Elastic 38mm |0.7112
2006|Regular Size Label|1
2007-1|Round Dots|1
2007-1|2"  Brand Name|1
2007-1|Regular Size Label|1
2007-1|Gold Elastic 38mm |0.7112
2007-1|Round - Black - 34|1
2007-2|Round Dots|1
2007-2|2"  Brand Name|1
2007-2|Regular Size Label|1
2007-2|Elastic for Double support Bra with Brand Name|1
2007-2|Gold Elastic 38mm |0.7112
2007-2|Round - Black - 34|1
2008|2"  Brand Name|1
2008|Regular Size Label|1
2101|6" Vertical Brand Name|1
2101|1" - Silver Logo|1
2101|5mm Straight Line|1
2101|Regular Size Label|1
2101|Nylon Neck twill Tape with Brand Name - 10 mm|0.1905
2103|6" Vertical Brand Name|1
2103|6mm Cross Line|2
2103|1" - Silver Logo|1
2103|Regular Size Label|1
2103|Nylon Neck twill Tape with Brand Name - 10 mm|0.1905
2104|6" Vertical Brand Name|1
2104|6mm Cross Line|2
2104|1" - Silver Logo|1
2104|Regular Size Label|1
2104|Nylon Neck twill Tape with Brand Name - 10 mm|0.1905
2105|2"  Brand Name|1
2105|6mm Cross Line|2
2105|Regular Size Label|1
2105|Nylon Neck twill Tape with Brand Name - 10 mm|0.1905
2106|6" Vertical Brand Name|1
2106|1" - Silver Logo|1
2106|Regular Size Label|1
2106|Nylon Neck twill Tape with Brand Name - 10 mm|0.1905
2107|6" Vertical Brand Name|1
2107|5mm Straight Line|2
2107|Regular Size Label|1
2108|1" - 3D Black Logo|1
2108|Regular Size Label|1
2108|Matte Finish - 18 Line Black Button with Brand Name |2
2108|Nylon Neck twill Tape with Brand Name - 10 mm|0.1905
2109|6" Vertical Brand Name|1
2109|1" - Silver Logo|1
2109|Gold Elastic 38mm |0.7112
2109|Regular Zipper - YKK|2
2109|Regular Size Label|1
2109|Flat Drawcord with Metal Silver Cap - 54 Inch|1
2110|Box Dot|2
2110|1" - Silver Logo|1
2110|Regular Zipper - YKK|2
2110|Gold Elastic 38mm |0.7112
2110|Flat Drawcord with Metal Silver Cap - 54 Inch|1
2110|Regular Size Label|1
2111|1.25" Downward Arrow|2
2111|1" - Silver Logo|1
2111|Regular Zipper - YKK|1
2111|Gold Elastic 38mm |0.7112
2111|Flat Drawcord with Metal Silver Cap - 54 Inch|1
2111|Regular Size Label|1
2112|2"  Brand Name|1
2112|DTF Sticker|2
2112|Regular Size Label|1
2112|Nylon Neck twill Tape with Brand Name - 10 mm|0.1905
2201|2"  Brand Name|2
2201|Gold Elastic 38mm |0.7112
2201|Round Dots|1
2201|Nylon Neck twill Tape with Brand Name - 10 mm|0.1905
2201|Regular Size Label|2
3001|6" Vertical Brand Name|1
3001|1" - Silver Logo|1
3001|Regular Zipper - YKK|2
3001|Gold Elastic 38mm |0.7112
3001|Flat Drawcord with Metal Silver Cap - 54 Inch|1
3001|Regular Size Label|1
3002|6" Vertical Brand Name|1
3002|1" - Silver Logo|1
3002|Gold Elastic 38mm |0.7112
3002|Regular Zipper - YKK|2
3002|6mm Straight Line|4
3002|Regular Size Label|1
3002|Flat Drawcord with Metal Silver Cap - 54 Inch|1
3003|1" - Silver Logo|1
3003|1.25" Downward Arrow|2
3003|Gold Elastic 38mm |0.7112
3003|Regular Zipper - YKK|2
3003|Regular Size Label|1
3003|Flat Drawcord with Metal Silver Cap - 54 Inch|1
3004|1" - Silver Logo|1
3004|4" Brand Name|1
3004|Regular Size Label|1
3004|Flat Drawcord with Metal Silver Cap - 54 Inch|1
3004|Gold Elastic 38mm |0.7112
3005|4" Brand Name|1
3005|1" - Silver Logo|1
3005|Regular Zipper - YKK|2
3005|Flat Drawcord with Metal Silver Cap - 54 Inch|1
3005|Gold Elastic 38mm |0.7112
3005|Regular Size Label|1
3006|6" Vertical Brand Name|1
3006|1" - Silver Logo|1
3006|Flat Drawcord with Metal Silver Cap - 54 Inch|1
3006|Gold Elastic 38mm |0.7112
3006|Regular Zipper - YKK|2
3006|Regular Size Label|1
3111|4" Brand Name|1
3111|1" - Silver Logo|1
3111|Gold Elastic 38mm |0.7112
3111|Regular Zipper - YKK|2
3111|Regular Size Label|1
3111|Flat Drawcord with Metal Silver Cap - 54 Inch|1
3111|Nylon Neck twill Tape with Brand Name - 10 mm|0.1905
3112|Moving DTF|1
3112|4" Brand Name|1
3112|1" - Silver Logo|1
3112|Regular Size Label|1
3112|Nylon Neck twill Tape with Brand Name - 10 mm|0.1905
3113|4" Brand Name|1
3113|1" - Silver Logo|1
3113|Gold Elastic 38mm |0.7112
3113|Flat Drawcord with Metal Silver Cap - 54 Inch|1
3113|Regular Size Label|1
3114|Neon Downward Arrow|2
3114|2"  Brand Name|1
3114|Gold Elastic 38mm |0.7112
3114|Regular Size Label|1
3114|Flat Drawcord with Metal Silver Cap - 54 Inch|1
3121|4" Brand Name|1
3121|1" - Silver Logo|1
3121|Regular Zipper - YKK|1
3121|Regular Size Label|1
3122|Football|1
3122|4" Brand Name|1
3122|1" - Silver Logo|1
3122|Regular Size Label|1
3122|Nylon Neck twill Tape with Brand Name - 10 mm|0.1905
3123|4" Brand Name|1
3123|6" Vertical Brand Name|1
3123|1" - Silver Logo|2
3123|Regular Zipper - YKK|1
3123|Gold Elastic 38mm |0.7112
3123|Flat Drawcord with Metal Silver Cap - 54 Inch|1
3123|Nylon Neck twill Tape with Brand Name - 10 mm|0.1905
3123|Regular Size Label|2`;

const RAW = `1001|Round Dots|1
1001|1" - Silver Logo|1
1001|Regular Size Label|1
1001|Nylon Neck twill Tape with Brand Name - 10 mm|0.1905
1002|Round Dots|1
1002|1" - Silver Logo|1
1002|Regular Size Label|1
1002|Nylon Neck twill Tape with Brand Name - 10 mm|0.1905
1003|1" - 3D Black Logo|1
1003|Regular Zipper - YKK|1
1003|Regular Size Label|1
1003|Nylon Neck twill Tape with Brand Name - 10 mm|0.1905
1004|1" - 3D Black Logo|1
1004|Regular Zipper - YKK|1
1004|Regular Size Label|1
1004|Nylon Neck twill Tape with Brand Name - 10 mm|0.1905
1005|2"  Brand Name|1
1005|Gold Elastic 38mm |0.7112
1005|Regular Size Label|1
1005|Round - Black - 34|1
1007-1|Round Dots|1
1007-1|2"  Brand Name|1
1007-1|Gold Elastic 38mm |0.7112
1007-1|Regular Size Label|1
1007-1|Round - Black - 34|1
1007-2|Round Dots|1
1007-2|2"  Brand Name|1
1007-2|Gold Elastic 38mm |0.7112
1007-2|Regular Size Label|1
1007-2|Round - Black - 34|1
1007-3|Round Dots|1
1007-3|2"  Brand Name|1
1007-3|Gold Elastic 38mm |0.7112
1007-3|Regular Size Label|1
1007-3|Round - Black - 34|1
1008-1|1" - Silver Logo|1
1008-1|2"  Brand Name|1
1008-1|Concealed Zipper - YKK|1
1008-1|Regular Size Label|1
1008-2|1" - Silver Logo|1
1008-2|Concealed Zipper - YKK|1
1008-2|Regular Size Label|1
1008-3|1" - Silver Logo|1
1008-3|2"  Brand Name|1
1008-3|Concealed Zipper - YKK|1
1008-3|Regular Size Label|1
1009-1|2"  Brand Name|1
1009-1|Regular Size Label|1
1009-2|2"  Brand Name|1
1009-2|Regular Size Label|1
1101|1" - Silver Logo|1
1101|5mm Straight Line|1
1101|Regular Size Label|1
1101|Nylon Neck twill Tape with Brand Name - 10 mm|0.1905
1102|6" Vertical Brand Name|1
1102|1" - Silver Logo|1
1102|Regular Size Label|1
1102|Nylon Neck twill Tape with Brand Name - 10 mm|0.1905
1102|Round Dots|1
1103|6mm Straight Line|1
1103|1" - 3D Black Logo|1
1103|Regular Size Label|1
1103|Matte Finish - 18 Line Black Button with Brand Name |2
1103|Nylon Neck twill Tape with Brand Name - 10 mm|0.1905
2001|2"  Brand Name|1
2001|Nylon Neck twill Tape with Brand Name - 10 mm|0.1905
2001|Regular Size Label|1
2002|Progress Over Perfection|1
2002|6" Vertical Brand Name|1
2002|Regular Size Label|1
2002|Nylon Neck twill Tape with Brand Name - 10 mm|0.1905
2003|6" Vertical Brand Name|1
2003|1" - Silver Logo|1
2003|Regular Size Label|1
2003|Nylon Neck twill Tape with Brand Name - 10 mm|0.1905
2005|1" - Silver Logo|1
2005|2"  Brand Name|1
2005|Regular Size Label|1
2005|Concealed Zipper - YKK|1
2006|6" Vertical Brand Name|1
2006|Round Dots|1
2006|Gold Elastic 38mm |0.7112
2006|Regular Size Label|1
2007-1|Round Dots|1
2007-1|2"  Brand Name|1
2007-1|Regular Size Label|1
2007-1|Gold Elastic 38mm |0.7112
2007-1|Round - Black - 34|1
2007-2|Round Dots|1
2007-2|2"  Brand Name|1
2007-2|Regular Size Label|1
2007-2|Elastic for Double support Bra with Brand Name|0.75
2007-2|Gold Elastic 38mm |0.7112
2007-2|Round - Black - 34|1
2008|2"  Brand Name|1
2008|Regular Size Label|1
2101|6" Vertical Brand Name|1
2101|1" - Silver Logo|1
2101|5mm Straight Line|1
2101|Regular Size Label|1
2101|Nylon Neck twill Tape with Brand Name - 10 mm|0.1905
2103|6" Vertical Brand Name|1
2103|6mm Cross Line|2
2103|1" - Silver Logo|1
2103|Regular Size Label|1
2103|Nylon Neck twill Tape with Brand Name - 10 mm|0.1905
2104|6" Vertical Brand Name|1
2104|6mm Cross Line|2
2104|1" - Silver Logo|1
2104|Regular Size Label|1
2104|Nylon Neck twill Tape with Brand Name - 10 mm|0.1905
2105|2"  Brand Name|1
2105|6mm Cross Line|2
2105|Regular Size Label|1
2105|Nylon Neck twill Tape with Brand Name - 10 mm|0.1905
2106|6" Vertical Brand Name|1
2106|1" - Silver Logo|1
2106|Regular Size Label|1
2106|Nylon Neck twill Tape with Brand Name - 10 mm|0.1905
2107|6" Vertical Brand Name|1
2107|5mm Straight Line|2
2107|Regular Size Label|1
2108|1" - 3D Black Logo|1
2108|Regular Size Label|1
2108|Matte Finish - 18 Line Black Button with Brand Name |2
2108|Nylon Neck twill Tape with Brand Name - 10 mm|0.1905
2109|6" Vertical Brand Name|1
2109|1" - Silver Logo|1
2109|Gold Elastic 38mm |0.7112
2109|Regular Zipper - YKK|2
2109|Regular Size Label|1
2109|Flat Drawcord with Metal Silver Cap - 54 Inch|1
2110|Box Dot|2
2110|1" - Silver Logo|1
2110|Regular Zipper - YKK|2
2110|Gold Elastic 38mm |0.7112
2110|Flat Drawcord with Metal Silver Cap - 54 Inch|1
2110|Regular Size Label|1
2111|1.25" Downward Arrow|2
2111|1" - Silver Logo|1
2111|Regular Zipper - YKK|1
2111|Gold Elastic 38mm |0.7112
2111|Flat Drawcord with Metal Silver Cap - 54 Inch|1
2111|Regular Size Label|1
2112|2"  Brand Name|1
2112|DTF Sticker|2
2112|Regular Size Label|1
2112|Nylon Neck twill Tape with Brand Name - 10 mm|0.1905
2201|2"  Brand Name|2
2201|Gold Elastic 38mm |0.7112
2201|Round Dots|1
2201|Nylon Neck twill Tape with Brand Name - 10 mm|0.1905
2201|Kids Size Label|2
3001|6" Vertical Brand Name|1
3001|1" - Silver Logo|1
3001|Regular Zipper - YKK|2
3001|Gold Elastic 38mm |0.7112
3001|Flat Drawcord with Metal Silver Cap - 54 Inch|1
3001|Regular Size Label|1
3002|6" Vertical Brand Name|1
3002|1" - Silver Logo|1
3002|Gold Elastic 38mm |0.7112
3002|Regular Zipper - YKK|2
3002|6mm Straight Line|4
3002|Regular Size Label|1
3002|Flat Drawcord with Metal Silver Cap - 54 Inch|1
3003|1" - Silver Logo|1
3003|1.25" Downward Arrow|2
3003|Gold Elastic 38mm |0.7112
3003|Regular Zipper - YKK|2
3003|Regular Size Label|1
3003|Flat Drawcord with Metal Silver Cap - 54 Inch|1
3004|1" - Silver Logo|1
3004|4" Brand Name|1
3004|Regular Size Label|1
3004|Flat Drawcord with Metal Silver Cap - 54 Inch|1
3004|Gold Elastic 38mm |0.7112
3005|4" Brand Name|1
3005|1" - Silver Logo|1
3005|Regular Zipper - YKK|2
3005|Flat Drawcord with Metal Silver Cap - 54 Inch|1
3005|Gold Elastic 38mm |0.7112
3005|Regular Size Label|1
3006|6" Vertical Brand Name|1
3006|1" - Silver Logo|1
3006|Flat Drawcord with Metal Silver Cap - 54 Inch|1
3006|Gold Elastic 38mm |0.7112
3006|Regular Zipper - YKK|2
3006|Regular Size Label|1
3111|4" Brand Name|1
3111|1" - Silver Logo|1
3111|Gold Elastic 38mm |0.7112
3111|Regular Zipper - YKK|2
3111|Regular Size Label|1
3111|Flat Drawcord with Metal Silver Cap - 54 Inch|1
3111|Nylon Neck twill Tape with Brand Name - 10 mm|0.1905
3112|Moving DTF|1
3112|4" Brand Name|1
3112|1" - Silver Logo|1
3112|Regular Size Label|1
3112|Nylon Neck twill Tape with Brand Name - 10 mm|0.1905
3113|4" Brand Name|1
3113|1" - Silver Logo|1
3113|Gold Elastic 38mm |0.7112
3113|Flat Drawcord with Metal Silver Cap - 54 Inch|1
3113|Regular Size Label|1
3114|Neon Downward Arrow|2
3114|2"  Brand Name|1
3114|Gold Elastic 38mm |0.7112
3114|Regular Size Label|1
3114|Flat Drawcord with Metal Silver Cap - 54 Inch|1
3121|4" Brand Name|1
3121|1" - Silver Logo|1
3121|Regular Zipper - YKK|1
3121|Kids Size Label|1
3122|Football|1
3122|4" Brand Name|1
3122|1" - Silver Logo|1
3122|Kids Size Label|1
3122|Nylon Neck twill Tape with Brand Name - 10 mm|0.1905
3123|4" Brand Name|1
3123|6" Vertical Brand Name|1
3123|1" - Silver Logo|2
3123|Regular Zipper - YKK|1
3123|Gold Elastic 38mm |0.7112
3123|Flat Drawcord with Metal Silver Cap - 54 Inch|1
3123|Nylon Neck twill Tape with Brand Name - 10 mm|0.1905
3123|Kids Size Label|2`;

function normalize(s: string): string {
  return s.trim().replace(/\s+/g, " ");
}

function parseRows(): Row[] {
  const out: Row[] = [];
  for (const line of RAW.split("\n")) {
    const [article, accessory, qty] = line.split("|");
    const a = article.trim();
    const acc = normalize(accessory);
    const q = Number(qty);
    const expansion = SIZE_EXPANSIONS[acc];
    if (expansion) {
      for (const v of expansion) {
        out.push({ article: a, accessory: v.accessory, qty: q, applicableSizes: v.applicableSizes });
      }
    } else {
      out.push({ article: a, accessory: acc, qty: q });
    }
  }
  return out;
}

async function main() {
  const apply = !process.argv.includes("--check") && !process.argv.includes("--dump");
  const dump = process.argv.includes("--dump");
  const rows = parseRows();
  console.log(`Loaded ${rows.length} BOM rows.`);

  // Dedupe: duplicate (article, accessory, sizes) rows in the input are
  // unintentional pastes — keep the last occurrence's qty, do not sum. If a
  // row repeats with conflicting qty, warn so the source can be cleaned up.
  const deduped = new Map<string, Row>();
  const conflicts: string[] = [];
  for (const r of rows) {
    const key = `${r.article}|${r.accessory}|${(r.applicableSizes ?? []).join(",")}`;
    const existing = deduped.get(key);
    if (existing && existing.qty !== r.qty) {
      conflicts.push(`${r.article} / "${r.accessory}": ${existing.qty} vs ${r.qty}`);
    }
    deduped.set(key, { ...r });
  }
  const unique = [...deduped.values()];
  if (unique.length !== rows.length) {
    console.log(`  Deduplicated ${rows.length} → ${unique.length} rows (kept last value for each repeat).`);
  }
  if (conflicts.length) {
    console.log(`  Conflicting qty in repeated rows (using last value):`);
    for (const c of conflicts) console.log(`    - ${c}`);
  }

  const articleNumbers = [...new Set(unique.map((r) => r.article))];
  const accessoryNames = [...new Set(unique.map((r) => r.accessory))];

  // Distinct articleNumbers that exist in ProductMaster — we only write BOM
  // for articles that have at least one SKU.
  const products = await db.productMaster.findMany({
    where: { articleNumber: { in: articleNumbers } },
    select: { articleNumber: true },
  });
  const existingArticles = new Set(products.map((p) => p.articleNumber).filter((x): x is string => !!x));

  const allAccessories = await db.accessoryMaster.findMany({
    select: { id: true, displayName: true },
  });
  const accessoryByName = new Map<string, { id: string; displayName: string }>();
  for (const a of allAccessories) accessoryByName.set(normalize(a.displayName), a);

  const missingArticles = articleNumbers.filter((a) => !existingArticles.has(a));
  const missingAccessories = accessoryNames.filter((n) => !accessoryByName.has(n));

  if (missingArticles.length) {
    console.log(`\nMissing articleNumbers (${missingArticles.length}):`);
    for (const a of missingArticles) console.log(`  - ${a}`);
  }
  if (missingAccessories.length) {
    console.log(`\nMissing accessory displayNames (${missingAccessories.length}):`);
    for (const n of missingAccessories) console.log(`  - "${n}"`);
  }

  console.log(`\nArticles found: ${articleNumbers.length - missingArticles.length}/${articleNumbers.length}`);
  console.log(`Accessories found: ${accessoryNames.length - missingAccessories.length}/${accessoryNames.length}`);
  console.log(`ArticleAccessory rows that would be touched: ${unique.filter((r) => existingArticles.has(r.article) && accessoryByName.has(r.accessory)).length}`);

  if (dump) {
    // Tab-separated, paste-into-Excel friendly. One row per (article, accessory).
    console.log(["articleNumber", "accessory", "qty", "applicableSizes"].join("\t"));
    const sortedArticles = [...existingArticles].sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true }),
    );
    for (const article of sortedArticles) {
      const articleRows = unique.filter((r) => r.article === article);
      for (const r of articleRows) {
        if (!accessoryByName.has(r.accessory)) continue;
        console.log([
          article,
          r.accessory,
          r.qty,
          (r.applicableSizes ?? []).join("/"),
        ].join("\t"));
      }
    }
    return;
  }

  if (!apply) {
    console.log(`\n[--check] Dry-run only. Re-run without --check to apply.`);
    return;
  }

  if (missingAccessories.length) {
    console.log(`\nRefusing to apply: ${missingAccessories.length} missing accessory displayName(s).`);
    process.exit(1);
  }
  if (missingArticles.length) {
    console.log(`\nWarning: ${missingArticles.length} article(s) not in ProductMaster — their BOM rows will be skipped.`);
  }

  // Replace mode: for each article in the input, drop all existing BOM rows
  // and insert the new set. Lets the input be the source of truth (so e.g.
  // dropping a 'Regular Size Label' line and adding 'Kids Size Label' works).
  const rowsByArticle = new Map<string, Row[]>();
  for (const r of unique) {
    if (!existingArticles.has(r.article)) continue;
    if (!accessoryByName.has(r.accessory)) continue;
    const arr = rowsByArticle.get(r.article) ?? [];
    arr.push(r);
    rowsByArticle.set(r.article, arr);
  }

  // --only-changed: skip articles whose DB state already matches the input
  // exactly (same accessories, qty, applicableSizes). Avoids needlessly
  // re-writing rows where there's no real change.
  if (process.argv.includes("--only-changed")) {
    const existingLinks = await db.articleAccessory.findMany({
      where: { articleNumber: { in: [...rowsByArticle.keys()] } },
      include: { accessory: { select: { displayName: true } } },
    });
    const dbByArticle = new Map<string, Map<string, number>>();
    for (const l of existingLinks) {
      const m = dbByArticle.get(l.articleNumber) ?? new Map<string, number>();
      const key = `${normalize(l.accessory.displayName)}|${[...l.applicableSizes].sort().join(",")}`;
      m.set(key, Number(l.quantityPerPiece));
      dbByArticle.set(l.articleNumber, m);
    }
    const skipped: string[] = [];
    for (const article of [...rowsByArticle.keys()]) {
      const inputRows = rowsByArticle.get(article)!;
      const dbMap = dbByArticle.get(article);
      if (!dbMap) continue; // no DB rows → must apply
      const inputMap = new Map(
        inputRows.map((r) => [
          `${r.accessory}|${(r.applicableSizes ?? []).slice().sort().join(",")}`,
          r.qty,
        ]),
      );
      if (inputMap.size !== dbMap.size) continue;
      let same = true;
      for (const [k, v] of inputMap.entries()) {
        if (Math.abs((dbMap.get(k) ?? NaN) - v) > 1e-6) { same = false; break; }
      }
      if (same) {
        rowsByArticle.delete(article);
        skipped.push(article);
      }
    }
    console.log(`[--only-changed] Skipped ${skipped.length} unchanged article(s): ${skipped.join(", ") || "(none)"}`);
    console.log(`Will apply to ${rowsByArticle.size} article(s).`);
  }

  let inserts = 0;
  let deleted = 0;
  for (const [article, articleRows] of rowsByArticle.entries()) {
    const del = await db.articleAccessory.deleteMany({ where: { articleNumber: article } });
    deleted += del.count;
    if (articleRows.length === 0) continue;
    const created = await db.articleAccessory.createMany({
      data: articleRows.map((r) => ({
        articleNumber: article,
        accessoryId: accessoryByName.get(r.accessory)!.id,
        quantityPerPiece: r.qty,
        applicableSizes: r.applicableSizes ?? [],
      })),
      skipDuplicates: true,
    });
    inserts += created.count;
  }
  console.log(`\nDone. Deleted ${deleted} stale rows, inserted ${inserts} new ArticleAccessory rows across ${rowsByArticle.size} articles.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
