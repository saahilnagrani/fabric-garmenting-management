import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });

(async () => {
  const colours = await db.colour.findMany({ orderBy: { name: "asc" } });
  const rows = await db.$queryRaw<Array<{ colour: string; count: bigint }>>`
    SELECT TRIM(part) AS colour, COUNT(*)::bigint AS count
    FROM "Product",
         unnest(string_to_array("colourOrdered", '/')) AS part
    WHERE "articleNumber" IS NOT NULL
    GROUP BY TRIM(part)
  `;
  const counts = new Map(rows.map((r) => [r.colour, Number(r.count)]));
  const unused = colours.filter((c) => (counts.get(c.name) ?? 0) === 0);
  console.log(`Total colours: ${colours.length}`);
  console.log(`Unused (articleCount = 0): ${unused.length}`);
  for (const c of unused) console.log(`  - ${c.name} (${c.code})`);
  await db.$disconnect();
})();
