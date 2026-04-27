/**
 * One-shot bulk fill of `garmentingAt` on ProductMaster + ProductOrder rows
 * from a hard-coded article-number → garmenter mapping. Resolves the
 * GarmentingLocation FK alongside the string column, mirrors what
 * createProductMaster / updateProductMaster do via the lookup resolver.
 *
 * Behaviour for Article Orders (Product rows): only fills rows whose
 * garmentingAt is currently NULL — never overwrites an explicit value.
 *
 * Article Master rows: writes to all matching rows of an article number,
 * since the master is per-SKU but we treat garmenter as article-level.
 *
 * Usage:
 *   DATABASE_URL=postgresql://... npx tsx scripts/set-garmenting-at-from-list.ts
 */
import { db } from "../src/lib/db";

const MAPPING: Record<string, string> = {
  "1001": "Mumtaz", "1002": "Mumtaz", "1003": "Mumtaz", "1004": "Mumtaz",
  "1005": "Mumtaz", "1007": "Mumtaz", "1007-1": "Mumtaz", "1007-2": "Mumtaz",
  "1007-3": "Mumtaz", "1008-1": "Mumtaz", "1008-2": "Mumtaz", "1008-3": "Mumtaz",
  "1009-1": "Mumtaz", "1009-2": "Mumtaz",
  "1101": "Walknit", "1102": "Walknit", "1103": "Walknit",
  "2001": "Mumtaz", "2002": "Garsem", "2003": "Garsem", "2004": "Mumtaz",
  "2005": "Mumtaz", "2006": "Mumtaz", "2007-1": "Mumtaz", "2008": "Mumtaz",
  "2101": "Garsem", "2102": "Garsem", "2103": "Garsem", "2104": "Garsem",
  "2105": "Garsem", "2106": "Garsem", "2107": "Garsem",
  "2108": "Walknit", "2109": "Walknit", "2110": "Walknit",
  "2111": "Garsem", "2112": "Garsem", "2201": "Mumtaz",
  "3001": "Garsem", "3002": "Garsem", "3003": "Garsem", "3004": "Garsem",
  "3005": "Garsem", "3006": "Garsem",
  "3111": "Garsem", "3112": "Garsem", "3113": "Garsem", "3114": "Garsem",
  "3121": "Garsem", "3122": "Garsem", "3123": "Garsem",
  "3601": "KS Art & Craft", "3602": "KS Art & Craft", "3603": "KS Art & Craft",
  "3604": "KS Art & Craft", "3605": "KS Art & Craft", "3606": "KS Art & Craft",
  "3607": "Mumtaz", "3608": "Mumtaz", "3609": "Mumtaz", "3610": "Mumtaz",
  "3611": "Mumtaz", "3612": "Mumtaz", "3613": "Mumtaz",
  "3614": "KS Art & Craft", "3615": "KS Art & Craft",
  "3616": "Mumtaz", "3617": "Mumtaz", "3618": "Mumtaz", "3619": "Mumtaz",
};

async function main() {
  // Resolve location ids up-front
  const allNames = [...new Set(Object.values(MAPPING))];
  const locations = await db.garmentingLocation.findMany({
    where: { name: { in: allNames } },
    select: { id: true, name: true },
  });
  const idByName = new Map(locations.map((l) => [l.name, l.id]));
  const missing = allNames.filter((n) => !idByName.has(n));
  if (missing.length > 0) {
    console.error(`Missing GarmentingLocation rows: ${missing.join(", ")}`);
    process.exit(1);
  }

  let masterRowsUpdated = 0;
  let articleNumbersWithNoMaster: string[] = [];
  let orderRowsFilled = 0;

  for (const [articleNumber, locationName] of Object.entries(MAPPING)) {
    const locationId = idByName.get(locationName)!;

    // Master: update every row for this article number.
    const masterRes = await db.productMaster.updateMany({
      where: { articleNumber },
      data: { garmentingAt: locationName, garmentingAtId: locationId },
    });
    if (masterRes.count === 0) {
      articleNumbersWithNoMaster.push(articleNumber);
    } else {
      masterRowsUpdated += masterRes.count;
    }

    // Article orders: fill blanks only.
    const orderRes = await db.product.updateMany({
      where: { articleNumber, garmentingAt: null },
      data: { garmentingAt: locationName, garmentingAtId: locationId },
    });
    orderRowsFilled += orderRes.count;
  }

  console.log(`Article masters updated: ${masterRowsUpdated}`);
  console.log(`Article orders filled (where null): ${orderRowsFilled}`);
  if (articleNumbersWithNoMaster.length > 0) {
    console.log(`Article numbers with no matching master row (skipped): ${articleNumbersWithNoMaster.join(", ")}`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await db.$disconnect(); });
