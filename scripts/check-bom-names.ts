import { db } from "../src/lib/db";

async function main() {
  const candidates = [
    "Brand Name",
    "Matte Finish",
    "Gold 38mm",
  ];
  for (const c of candidates) {
    const rows = await db.accessoryMaster.findMany({
      where: { displayName: { contains: c, mode: "insensitive" } },
      select: { displayName: true },
    });
    console.log(`\n${c} =>`);
    for (const r of rows) console.log(`  [${r.displayName}]`);
  }

  const articles = ["2106","2107","2108","2112","1102","2110","2111","2109","2001","2002","2003","1002","2007","2007 Double Support","1009 Slitted","1008","2008","2006","2201"];
  console.log("\nArticle scan:");
  for (const a of articles) {
    const rows = await db.productMaster.findMany({
      where: { articleNumber: a },
      select: { skuCode: true, articleNumber: true },
      take: 1,
    });
    if (!rows.length) {
      const sim = await db.productMaster.findMany({
        where: { articleNumber: { contains: a } },
        select: { articleNumber: true },
        take: 5,
      });
      console.log(`  ${a}: NONE; similar: ${sim.map((r) => r.articleNumber).join(", ") || "(none)"}`);
    } else {
      console.log(`  ${a}: OK`);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
