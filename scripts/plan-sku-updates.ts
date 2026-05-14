/**
 * Plan the previousSkuCode additions and emit the list of new Colours that
 * need to be created from the FabricOrders sheet. Read-only — no writes.
 *
 *   tsx scripts/plan-sku-updates.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as XLSX from "xlsx";
import * as fs from "fs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const NORMALISED = "/Users/saahilnagrani/Documents/Projects/hyperballik/Data/Hyperballik_Phase 2-3 Data.normalised.xlsx";
const OUT = "/Users/saahilnagrani/Documents/Projects/hyperballik/Data/Hyperballik_Phase 2-3 Data.sku-plan.json";

// Normalisation: "K SW 16 PNK" → "K SW16 PNK", "M SW 15 BLN" → "M SW15 BLN"
function normaliseSku(s: string): string {
  return s.replace(/^([MWK])\s+SW\s+(\d+)\s+/i, (_, gender, num) => `${gender} SW${num} `);
}

// User-provided additions. Each entry says: this *old* code should be added
// to the previousSkuCodes of the master identified by `targetSku` OR by
// (`targetArticleNumber` + a colour hint inferred from the old-code suffix).
type Plan =
  | { oldSku: string; targetSku: string }
  | { oldSku: string; targetArticleNumber: string; colourHint: string };

// Colour suffix → likely colour-name fragments to match in coloursAvailable.
// Loose matching: lowercase substring or word match.
const COLOUR_SUFFIX_HINTS: Record<string, string[]> = {
  BLK: ["black"],
  WHI: ["white"],
  WHT: ["white"],
  NVY: ["navy"],
  GRY: ["grey", "gray"],
  GRE: ["green"],
  GRN: ["green"],
  RED: ["red"],
  BLU: ["blue"],
  AIR: ["airforce", "air force"],
  ALU: ["alu", "aluminium", "aluminum"],
  PIS: ["pista", "pistachio"],
  DGR: ["dark grey", "dark gray", "d grey", "d. grey"],
  DBLU: ["dark blue", "d blue"],
  PCH: ["peach"],
  PNK: ["pink"],
  MRN: ["maroon"],
  MAR: ["maroon"],
  TEL: ["teal"],
  TRQ: ["turquoise"],
  YLW: ["yellow"],
  LMN: ["lemon", "yellow"],
  OLV: ["olive"],
  PUR: ["purple"],
  LGR: ["light grey", "light gray", "l. grey"],
  BEI: ["beige"],
  COF: ["coffee"],
  ORA: ["orange"],
  WIN: ["wine"],
  KOF: ["coffee"],
  ROS: ["rose"],
  PBL: ["powder blue", "p blue", "pastel blue"],
  GRP: ["graphite", "grape"],
  BLN: ["blue navy", "blanco", "blue/navy"],
};

const PLANS: Plan[] = [
  { oldSku: "K RN02 GRY", targetSku: "K RN01 GRY" },
  // K SW * with space — normalised codes
  { oldSku: "K SW 16 PNK", targetSku: "K SW16 PNK" },
  { oldSku: "K SW 16 YLW", targetSku: "K SW16 YLW" },
  { oldSku: "K SW 17 BLU", targetSku: "K SW17 BLU" },
  { oldSku: "K SW 17 PNK", targetSku: "K SW17 PNK" },
  { oldSku: "K SW 17 TRQ", targetSku: "K SW17 TRQ" },
  { oldSku: "K SW 18 MRN", targetSku: "K SW18 MRN" },
  { oldSku: "K SW 19 BLU", targetSku: "K SW19 BLU" },
  { oldSku: "K SW 19 PIS", targetSku: "K SW19 PIS" },
  { oldSku: "K SW 19 YLW", targetSku: "K SW19 YLW" },
  { oldSku: "M SW 15 BLN", targetSku: "M SW15 BLN" },
  // Article-number-based
  { oldSku: "M DO01 GRN", targetArticleNumber: "2104", colourHint: "GRN" },
  { oldSku: "M FS01 AIR", targetArticleNumber: "2107", colourHint: "AIR" },
  { oldSku: "M FS01 BLU", targetArticleNumber: "2107", colourHint: "BLU" },
  { oldSku: "M RNT01 ALU", targetSku: "M RN01 ALU" },
  { oldSku: "M TM01 DGR", targetArticleNumber: "2103", colourHint: "DGR" },
  { oldSku: "M TM01 PIS", targetArticleNumber: "2103", colourHint: "PIS" },
  { oldSku: "W DP01 BLK", targetArticleNumber: "2002", colourHint: "BLK" },
  { oldSku: "W SB01 BLK", targetSku: "W BR01 BLK" },
  { oldSku: "W SB01 WIN", targetSku: "W BR01 KOF" },
  { oldSku: "W SK01 ORA", targetSku: "W SK02 ORA" },
  { oldSku: "W SK01 RED", targetArticleNumber: "1009-2", colourHint: "RED" },
  { oldSku: "W TB01 ROS", targetArticleNumber: "1005", colourHint: "ROS" },
];

async function main() {
  type Resolution =
    | { ok: true; oldSku: string; targetSku: string; targetMasterId: string; coloursAvailable: string[]; existingPrev: string[] }
    | { ok: false; oldSku: string; reason: string; candidates?: { skuCode: string; articleNumber: string | null; coloursAvailable: string[] }[] };

  const resolutions: Resolution[] = [];

  for (const plan of PLANS) {
    if ("targetSku" in plan) {
      const m = await prisma.productMaster.findUnique({
        where: { skuCode: plan.targetSku },
        select: { id: true, skuCode: true, coloursAvailable: true, previousSkuCodes: true },
      });
      if (!m) {
        resolutions.push({ ok: false, oldSku: plan.oldSku, reason: `targetSku ${plan.targetSku} not found in ProductMaster` });
        continue;
      }
      resolutions.push({
        ok: true,
        oldSku: plan.oldSku,
        targetSku: m.skuCode,
        targetMasterId: m.id,
        coloursAvailable: m.coloursAvailable,
        existingPrev: m.previousSkuCodes,
      });
    } else {
      const candidates = await prisma.productMaster.findMany({
        where: { articleNumber: plan.targetArticleNumber },
        select: { id: true, skuCode: true, articleNumber: true, coloursAvailable: true, previousSkuCodes: true },
      });
      if (candidates.length === 0) {
        resolutions.push({ ok: false, oldSku: plan.oldSku, reason: `no ProductMaster with articleNumber=${plan.targetArticleNumber}` });
        continue;
      }
      const hints = COLOUR_SUFFIX_HINTS[plan.colourHint.toUpperCase()] ?? [plan.colourHint.toLowerCase()];
      const matches = candidates.filter((c) =>
        c.coloursAvailable.some((col) => {
          const lc = col.toLowerCase();
          return hints.some((h) => lc.includes(h));
        })
      );
      if (matches.length === 1) {
        const m = matches[0];
        resolutions.push({
          ok: true,
          oldSku: plan.oldSku,
          targetSku: m.skuCode,
          targetMasterId: m.id,
          coloursAvailable: m.coloursAvailable,
          existingPrev: m.previousSkuCodes,
        });
      } else if (matches.length > 1) {
        resolutions.push({
          ok: false,
          oldSku: plan.oldSku,
          reason: `colour hint ${plan.colourHint} matched ${matches.length} masters under article ${plan.targetArticleNumber}`,
          candidates: matches.map((c) => ({ skuCode: c.skuCode, articleNumber: c.articleNumber, coloursAvailable: c.coloursAvailable })),
        });
      } else {
        resolutions.push({
          ok: false,
          oldSku: plan.oldSku,
          reason: `colour hint ${plan.colourHint} did not match any colour under article ${plan.targetArticleNumber}`,
          candidates: candidates.map((c) => ({ skuCode: c.skuCode, articleNumber: c.articleNumber, coloursAvailable: c.coloursAvailable })),
        });
      }
    }
  }

  // ─── Colour-from-fabric-orders that don't exist in the Colour table ────
  const wb = XLSX.readFile(NORMALISED);
  const fab = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets["FabricOrders"], { defval: null });
  const colourSet = new Set<string>();
  for (const row of fab) {
    for (const key of ["Colour", "AvailableColour"]) {
      const v = row[key];
      if (v !== null && v !== undefined && String(v).trim() !== "") {
        colourSet.add(String(v).trim());
      }
    }
  }
  const colourNames = Array.from(colourSet).sort();
  const existing = await prisma.colour.findMany({
    where: { name: { in: colourNames } },
    select: { name: true },
  });
  const existingSet = new Set(existing.map((c) => c.name));
  const missingColours = colourNames.filter((n) => !existingSet.has(n)).sort();

  const report = {
    skuResolutions: resolutions,
    summary: {
      sku: {
        ok: resolutions.filter((r) => r.ok).length,
        failed: resolutions.filter((r) => !r.ok).length,
      },
      colours: {
        totalDistinctInFabricOrders: colourNames.length,
        existingInDb: existingSet.size,
        missing: missingColours.length,
      },
    },
    missingColours,
  };

  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));

  console.log("\n=== SKU resolution plan ===");
  for (const r of resolutions) {
    if (r.ok) {
      console.log(`  OK  ${r.oldSku.padEnd(14)} → ${r.targetSku.padEnd(14)}  colour=${r.coloursAvailable.join("/")}  alreadyHasPrev=[${r.existingPrev.join(",")}]`);
    } else {
      console.log(`  FAIL ${r.oldSku.padEnd(14)} ${r.reason}`);
      if (r.candidates) {
        for (const c of r.candidates) {
          console.log(`        candidate ${c.skuCode}  article=${c.articleNumber}  colours=${c.coloursAvailable.join("/")}`);
        }
      }
    }
  }
  console.log(`\nSummary: ${report.summary.sku.ok} OK, ${report.summary.sku.failed} need attention`);
  console.log(`\n=== Colours from FabricOrders not in DB (${missingColours.length}) ===`);
  console.log(missingColours.join(", "));
  console.log(`\nFull JSON: ${OUT}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
