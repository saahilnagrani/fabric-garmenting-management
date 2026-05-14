/**
 * Apply ProductMaster updates needed before seeding Phase 2-3 orders.
 *
 *   A. Add 6 previousSkuCodes entries to existing masters.
 *   B. Create 5 new ProductMaster rows (isStrikedThrough=true) by cloning
 *      a template sibling and overriding a few fields.
 *
 * Idempotent: re-running is safe. A previousSkuCode is only added if absent;
 * a new master is only created if its skuCode doesn't already exist.
 *
 *   tsx scripts/apply-sku-updates.ts            # dry-run, no writes
 *   tsx scripts/apply-sku-updates.ts --apply    # commits the transaction
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });
const APPLY = process.argv.includes("--apply");

const PREV_SKU_ADDITIONS: { oldSku: string; targetSku: string }[] = [
  { oldSku: "K RN02 GRY", targetSku: "K RN01 GRY" },
  { oldSku: "M DO01 GRN", targetSku: "M RN06 OLV" },
  { oldSku: "M RNT01 ALU", targetSku: "M RN01 ALU" },
  { oldSku: "W SB01 BLK", targetSku: "W BR01 BLK" },
  { oldSku: "W SB01 WIN", targetSku: "W BR01 KOF" },
  { oldSku: "W SK01 ORA", targetSku: "W SK02 ORA" },
];

type NewMaster = {
  skuCode: string;
  templateSku: string;
  overrides: {
    fabricName?: string;
    fabric2Name?: string | null;
    coloursAvailable: string[];
    colours2Available?: string[];
  };
};

const NEW_MASTERS: NewMaster[] = [
  {
    skuCode: "M TM01 DGR",
    templateSku: "M TM01 BLK",
    overrides: { fabricName: "Nylon Feel Lycra", coloursAvailable: ["Dark Grey"] },
  },
  {
    skuCode: "M TM01 PIS",
    templateSku: "M TM01 BLK",
    overrides: { fabricName: "Nylon Feel Lycra", coloursAvailable: ["Pista"] },
  },
  {
    skuCode: "W DP01 BLK",
    templateSku: "W RN04 WHI",
    overrides: { fabricName: "Bubblegum Diamond", coloursAvailable: ["Black"] },
  },
  {
    skuCode: "W SK01 RED",
    templateSku: "W SK02 ORA",
    overrides: { fabricName: "Spectra", coloursAvailable: ["Red"] },
  },
  {
    skuCode: "W TB01 ROS",
    templateSku: "W TB01 WIN",
    overrides: { fabricName: "Spectra", fabric2Name: "Mirror", coloursAvailable: ["Rose"] },
  },
];

async function main() {
  console.log(APPLY ? "Mode: APPLY (writing)" : "Mode: DRY-RUN (no writes)");

  // ── A. previousSkuCodes additions ────────────────────────────────
  const prevActions: { targetSku: string; addSku: string; before: string[] }[] = [];
  for (const { oldSku, targetSku } of PREV_SKU_ADDITIONS) {
    const m = await prisma.productMaster.findUnique({
      where: { skuCode: targetSku },
      select: { previousSkuCodes: true },
    });
    if (!m) {
      console.log(`  ⚠ targetSku ${targetSku} not found — skipping`);
      continue;
    }
    if (m.previousSkuCodes.includes(oldSku)) {
      console.log(`  ✓ ${oldSku} already in ${targetSku}.previousSkuCodes — no-op`);
      continue;
    }
    prevActions.push({ targetSku, addSku: oldSku, before: m.previousSkuCodes });
    console.log(`  + ${targetSku}.previousSkuCodes: [${m.previousSkuCodes.join(", ")}] → [+${oldSku}]`);
  }

  // ── B. new masters ───────────────────────────────────────────────
  type CreateInput = { skuCode: string; data: any };
  const createActions: CreateInput[] = [];
  for (const spec of NEW_MASTERS) {
    const existing = await prisma.productMaster.findUnique({ where: { skuCode: spec.skuCode } });
    if (existing) {
      console.log(`  ✓ ${spec.skuCode} already exists — no-op`);
      continue;
    }
    const tmpl = await prisma.productMaster.findUnique({ where: { skuCode: spec.templateSku } });
    if (!tmpl) {
      console.log(`  ⚠ template ${spec.templateSku} not found — skipping ${spec.skuCode}`);
      continue;
    }
    // Strip id/timestamps; apply overrides.
    const { id, createdAt, updatedAt, manuallyCleanedAt, ...rest } = tmpl;
    const data: any = {
      ...rest,
      skuCode: spec.skuCode,
      coloursAvailable: spec.overrides.coloursAvailable,
      colours2Available: spec.overrides.colours2Available ?? [],
      isStrikedThrough: true,
      previousSkuCodes: [],
    };
    if (spec.overrides.fabricName !== undefined) data.fabricName = spec.overrides.fabricName;
    if (spec.overrides.fabric2Name !== undefined) data.fabric2Name = spec.overrides.fabric2Name;
    createActions.push({ skuCode: spec.skuCode, data });
    console.log(
      `  + create ${spec.skuCode}  fabric=${data.fabricName}${data.fabric2Name ? `/${data.fabric2Name}` : ""}  colour=${data.coloursAvailable.join("/")}  (cloned from ${spec.templateSku})`
    );
  }

  console.log(`\nPlanned: ${prevActions.length} previousSkuCode additions, ${createActions.length} new masters.`);

  if (!APPLY) {
    console.log("\nDry-run only. Re-run with --apply to commit.");
    return;
  }

  await prisma.$transaction(async (tx) => {
    for (const a of prevActions) {
      await tx.productMaster.update({
        where: { skuCode: a.targetSku },
        data: { previousSkuCodes: { push: a.addSku } },
      });
    }
    for (const c of createActions) {
      await tx.productMaster.create({ data: c.data });
    }
  });

  console.log("\n✓ Applied.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
