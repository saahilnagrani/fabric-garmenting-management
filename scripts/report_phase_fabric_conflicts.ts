/**
 * Reports per-bucket field-level disagreement for products that share a
 * (phaseId, productMasterId) but differ on fabric spec. Run after seed-phase-2-3
 * surfaces conflicts so we can decide on the resolution for each.
 *
 *   tsx scripts/report_phase_fabric_conflicts.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const PHASE_IDS = [
  "cmp1qa9ss0003r2u5k7lxqjul", // phase 2
  "cmp5gujp600hkr2u5iz1rfk97", // phase 3
];

const FIELDS = [
  "fabricName",
  "fabricVendorId",
  "fabricCostPerKg",
  "assumedFabricGarmentsPerKg",
  "fabric2Name",
  "fabric2VendorId",
  "fabric2CostPerKg",
  "assumedFabric2GarmentsPerKg",
] as const;

async function main() {
  const products = await prisma.product.findMany({
    where: { phaseId: { in: PHASE_IDS } },
    select: {
      id: true,
      phaseId: true,
      skuCode: true,
      articleNumber: true,
      isRepeat: true,
      colourOrdered: true,
      notes: true,
      fabricName: true,
      fabricVendor: { select: { name: true } },
      fabricVendorId: true,
      fabricCostPerKg: true,
      assumedFabricGarmentsPerKg: true,
      fabric2Name: true,
      fabric2VendorId: true,
      fabric2CostPerKg: true,
      assumedFabric2GarmentsPerKg: true,
    },
  });

  // Resolve sku → master id (handle renames)
  const skuSet = new Set(products.map((p) => p.skuCode).filter((s): s is string => !!s));
  const [byCur, byPrev] = await Promise.all([
    prisma.productMaster.findMany({
      where: { skuCode: { in: Array.from(skuSet) } },
      select: { id: true, skuCode: true, articleNumber: true },
    }),
    prisma.productMaster.findMany({
      where: { previousSkuCodes: { hasSome: Array.from(skuSet) } },
      select: { id: true, skuCode: true, articleNumber: true, previousSkuCodes: true },
    }),
  ]);
  const masterIdBySku = new Map<string, { id: string; articleNumber: string | null }>();
  for (const m of byCur) masterIdBySku.set(m.skuCode, { id: m.id, articleNumber: m.articleNumber });
  for (const m of byPrev) {
    for (const p of m.previousSkuCodes)
      if (!masterIdBySku.has(p)) masterIdBySku.set(p, { id: m.id, articleNumber: m.articleNumber });
  }

  // Group by (phase, masterId)
  type Bucket = { phaseId: string; masterId: string; articleNumber: string | null; products: typeof products };
  const buckets = new Map<string, Bucket>();
  for (const p of products) {
    if (!p.skuCode) continue;
    const master = masterIdBySku.get(p.skuCode);
    if (!master) continue;
    const key = `${p.phaseId}|${master.id}`;
    let b = buckets.get(key);
    if (!b) {
      b = { phaseId: p.phaseId, masterId: master.id, articleNumber: master.articleNumber, products: [] };
      buckets.set(key, b);
    }
    b.products.push(p);
  }

  const dec = (v: { toString(): string } | null) => (v == null ? null : v.toString());

  // Conflict = bucket where products disagree on any FIELDS value
  type Conflict = {
    articleNumber: string | null;
    phase: number;
    fieldDisagreements: Record<string, Array<{ value: unknown; products: string[]; isRepeats: boolean[]; colours: string[] }>>;
  };
  const conflicts: Conflict[] = [];
  for (const b of buckets.values()) {
    const groupedByField: Record<string, Map<string, { value: unknown; products: string[]; isRepeats: boolean[]; colours: string[] }>> = {};
    for (const f of FIELDS) {
      const map = new Map<string, { value: unknown; products: string[]; isRepeats: boolean[]; colours: string[] }>();
      for (const p of b.products) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const raw = (p as any)[f];
        const norm = raw && typeof raw === "object" && "toString" in raw ? dec(raw as { toString(): string }) : raw ?? null;
        const key = String(norm);
        if (!map.has(key)) map.set(key, { value: norm, products: [], isRepeats: [], colours: [] });
        map.get(key)!.products.push(`${p.skuCode} (${p.id.slice(-6)})`);
        map.get(key)!.isRepeats.push(p.isRepeat);
        map.get(key)!.colours.push(p.colourOrdered);
      }
      groupedByField[f] = map;
    }
    const fieldDisagreements: Conflict["fieldDisagreements"] = {};
    for (const f of FIELDS) {
      if (groupedByField[f].size > 1) {
        fieldDisagreements[f] = Array.from(groupedByField[f].values());
      }
    }
    if (Object.keys(fieldDisagreements).length > 0) {
      conflicts.push({
        articleNumber: b.articleNumber,
        phase: b.phaseId === PHASE_IDS[0] ? 2 : 3,
        fieldDisagreements,
      });
    }
  }

  // Sort by article number for readability
  conflicts.sort((a, b) => `${a.articleNumber}|${a.phase}`.localeCompare(`${b.articleNumber}|${b.phase}`));

  console.log(`Found ${conflicts.length} conflict bucket(s):\n`);
  for (const c of conflicts) {
    console.log(`━━ Article ${c.articleNumber} Phase ${c.phase} ━━`);
    for (const [field, groups] of Object.entries(c.fieldDisagreements)) {
      console.log(`  ${field}:`);
      for (const g of groups) {
        const reps = g.isRepeats.every((x) => x) ? "all-repeat" : g.isRepeats.every((x) => !x) ? "all-new" : "mixed";
        console.log(`    = ${JSON.stringify(g.value)}  ×${g.products.length}  (${reps})  → ${g.products.join(", ")}`);
      }
    }
    console.log();
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
