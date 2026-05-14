import { db } from "../src/lib/db";

async function main() {
  const rows = await db.productMaster.findMany({
    where: { articleNumber: { not: null } },
    select: { articleNumber: true },
  });
  const counts = new Map<string, number>();
  for (const r of rows) {
    const a = r.articleNumber!;
    counts.set(a, (counts.get(a) ?? 0) + 1);
  }
  const sorted = [...counts.entries()].sort((a, b) =>
    a[0].localeCompare(b[0], undefined, { numeric: true }),
  );
  for (const [a, n] of sorted) console.log(`${a}\t${n}`);
  console.log(`\nTotal distinct articleNumbers: ${sorted.length}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
