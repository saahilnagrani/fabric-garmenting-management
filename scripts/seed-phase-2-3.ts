/**
 * Seeder for Hyperballik Phase 2-3 data.
 *
 * Reads the normalised workbook produced by dry-run-phase-2-3.ts and inserts
 * the rows into the live DB in stages. Idempotent: every stage skips work
 * already on disk so it can be run repeatedly.
 *
 *   tsx scripts/seed-phase-2-3.ts                      (dry-run, all stages)
 *   tsx scripts/seed-phase-2-3.ts --apply              (apply, all stages)
 *   tsx scripts/seed-phase-2-3.ts --stage=masters --apply
 *   tsx scripts/seed-phase-2-3.ts --stage=products
 *   tsx scripts/seed-phase-2-3.ts --stage=fabric-orders
 *   tsx scripts/seed-phase-2-3.ts --stage=phase-fabric
 *
 * Stages:
 *   masters       — resolve SKUs (current + previousSkuCodes), report any
 *                   missing vendors/colours and upsert the missing ones.
 *   products      — create Product rows (article orders). Skips a row if a
 *                   Product already exists for (phaseId, skuCode).
 *   fabric-orders — create FabricOrder rows + rebuild product links the same
 *                   way `syncFabricOrderProductLinks` does in the action.
 *                   Skips a row if a matching FabricOrder already exists.
 *   phase-fabric  — for each (phaseId, productMasterId) bucket created by
 *                   the products stage, compare the bucket's agreed fabric
 *                   spec against the master's resolved-at-phase spec; if
 *                   they diverge, upsert a PhaseFabric row at that phase.
 *                   Fails loudly when products in the same bucket disagree.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import * as XLSX from "xlsx";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const NORMALISED =
  "/Users/saahilnagrani/Documents/Projects/hyperballik/Data/Hyperballik_Phase 2-3 Data.normalised.xlsx";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// ─── CLI ─────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const APPLY = argv.includes("--apply");
const stageArg =
  argv.find((a) => a.startsWith("--stage="))?.slice("--stage=".length) ?? "all";
const STAGES = new Set(
  stageArg === "all"
    ? ["masters", "products", "fabric-orders", "phase-fabric"]
    : stageArg.split(","),
);
const mode = APPLY ? "APPLY" : "DRY-RUN";

// ─── Workbook row types (mirror normalised columns) ──────────────
type ArticleRow = {
  Sheet: string;
  Phase: number;
  IsRepeat: boolean;
  ArticleNumber: string;
  SkuCode: string;
  SkuExistsInMaster: boolean;
  ResolvedSkuCode: string | null;
  ResolvedColour: string | null;
  FabricVendors: string; // comma-separated
  FabricNames: string; // comma-separated
  Fabric2Name: string | null;
  GSM: number | null;
  CostPerKg: number | null;
  Fabric2CostPerKg: number | null;
  Fabric1OrderedKg: number | null;
  Fabric1ShippedKg: number | null;
  Fabric2OrderedKg: number | null;
  Fabric1GarmentsPerKg: number | null;
  Fabric2GarmentsPerKg: number | null;
  GarmentingAt: string | null;
  Status: string | null;
  GarmentNumber: number | null;
  ActualStitched_S: number;
  ActualStitched_M: number;
  ActualStitched_L: number;
  ActualStitched_XL: number;
  ActualStitched_XXL: number;
  StitchingCost: number | null;
  BrandLogoCost: number | null;
  NeckTwillCost: number | null;
  ReflectorsCost: number | null;
  FusingCost: number | null;
  AccessoriesCost: number | null;
  BrandTagCost: number | null;
  SizeTagCost: number | null;
  PackagingCost: number | null;
  InwardShipping: number | null;
  ProposedMrp: number | null;
  OnlineMrp: number | null;
};

type FabricRow = {
  Sheet: string;
  Phase: number;
  IsRepeat: boolean;
  Vendor: string;
  VendorExists: boolean;
  FabricName: string;
  ArticleNumbers: string;
  Colour: string | null;
  AvailableColour: string | null;
  Gender: string | null;
  OrderedKg: number | null;
  ShippedKg: number | null;
  CostPerKg: number | null;
  CostPerKgWasCutToPiece: boolean;
  ReceivedAt: string | null;
  InvoiceNumber: string | null;
  Notes: string | null;
};

const norm = (s: string | null | undefined) => (s || "").trim();

function splitList(s: string | null | undefined): string[] {
  return norm(s)
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

// ─── Workbook load ───────────────────────────────────────────────
function loadWorkbook(): { articles: ArticleRow[]; fabrics: FabricRow[] } {
  const wb = XLSX.readFile(NORMALISED);
  const articles = XLSX.utils.sheet_to_json<ArticleRow>(wb.Sheets["ArticleOrders"], {
    defval: null,
  });
  const fabrics = XLSX.utils.sheet_to_json<FabricRow>(wb.Sheets["FabricOrders"], {
    defval: null,
  });
  return { articles, fabrics };
}

// ─── Shared lookups, built in stage 1 and reused below ───────────
type Ctx = {
  articles: ArticleRow[];
  fabrics: FabricRow[];
  phaseIdByNumber: Map<number, string>;
  vendorIdByName: Map<string, string>;
  vendorIdByFabricName: Map<string, string>;
  mrpByFabricName: Map<string, number>;
  garmentingLocationIdByName: Map<string, string>;
  colourIdByName: Map<string, string>;
  // SKU resolution: raw workbook SKU → master row (incl renames)
  masterBySku: Map<
    string,
    {
      id: string;
      currentSkuCode: string;
      articleNumber: string | null;
      type: string;
      gender: string;
      productName: string | null;
      typeRefId: string | null;
      coloursAvailable: string[];
    }
  >;
};

async function stageMasters(): Promise<Ctx> {
  const { articles, fabrics } = loadWorkbook();
  console.log(`[masters] loaded ${articles.length} article rows, ${fabrics.length} fabric rows`);

  const phases = await prisma.phase.findMany({
    select: { id: true, number: true },
  });
  const phaseIdByNumber = new Map<number, string>(
    phases.map((p) => [p.number, p.id]),
  );
  for (const n of [2, 3]) {
    if (!phaseIdByNumber.has(n)) {
      throw new Error(`Phase ${n} not found in DB — seed Phase rows first.`);
    }
  }

  // Fabric → vendor fallback map (workbook leaves vendor blank for some rows;
  // FabricMaster knows the canonical vendor for the fabric name).
  const fabricNames = new Set<string>();
  for (const r of articles) {
    for (const n of splitList(r.FabricNames)) fabricNames.add(n);
    if (r.Fabric2Name) fabricNames.add(norm(r.Fabric2Name));
  }
  const fabricMasters = await prisma.fabricMaster.findMany({
    where: { fabricName: { in: Array.from(fabricNames) } },
    select: { fabricName: true, vendorId: true, mrp: true },
  });
  const vendorIdByFabricName = new Map(fabricMasters.map((f) => [f.fabricName, f.vendorId]));
  const mrpByFabricName = new Map(
    fabricMasters
      .filter((f) => f.mrp != null)
      .map((f) => [f.fabricName, Number(f.mrp)]),
  );

  // SKUs to resolve
  const rawSkus = Array.from(
    new Set(articles.map((r) => norm(r.SkuCode)).filter(Boolean)),
  );

  const [byCurrent, byPrev] = await Promise.all([
    prisma.productMaster.findMany({
      where: { skuCode: { in: rawSkus } },
      select: {
        id: true,
        skuCode: true,
        articleNumber: true,
        type: true,
        gender: true,
        productName: true,
        typeRefId: true,
        coloursAvailable: true,
      },
    }),
    prisma.productMaster.findMany({
      where: { previousSkuCodes: { hasSome: rawSkus } },
      select: {
        id: true,
        skuCode: true,
        articleNumber: true,
        type: true,
        gender: true,
        productName: true,
        typeRefId: true,
        coloursAvailable: true,
        previousSkuCodes: true,
      },
    }),
  ]);

  const masterBySku = new Map<string, Ctx["masterBySku"] extends Map<string, infer V> ? V : never>();
  for (const m of byCurrent) {
    masterBySku.set(m.skuCode, {
      id: m.id,
      currentSkuCode: m.skuCode,
      articleNumber: m.articleNumber,
      type: m.type,
      gender: m.gender as unknown as string,
      productName: m.productName,
      typeRefId: m.typeRefId,
      coloursAvailable: m.coloursAvailable,
    });
  }
  for (const m of byPrev) {
    for (const prev of m.previousSkuCodes) {
      if (rawSkus.includes(prev) && !masterBySku.has(prev)) {
        masterBySku.set(prev, {
          id: m.id,
          currentSkuCode: m.skuCode,
          articleNumber: m.articleNumber,
          type: m.type,
          gender: m.gender as unknown as string,
          productName: m.productName,
          typeRefId: m.typeRefId,
          coloursAvailable: m.coloursAvailable,
        });
      }
    }
  }
  const unresolvedSkus = rawSkus.filter((s) => !masterBySku.has(s));
  if (unresolvedSkus.length > 0) {
    console.error(`[masters] ABORT — unresolved SKUs:\n  ${unresolvedSkus.join("\n  ")}`);
    throw new Error(`${unresolvedSkus.length} SKU(s) not found in ProductMaster`);
  }
  console.log(
    `[masters] resolved ${rawSkus.length} SKUs (${byCurrent.length} current + ${rawSkus.length - byCurrent.length} via previousSkuCodes)`,
  );

  // Vendors used in articles + fabrics + garmenting locations
  const vendorNames = new Set<string>();
  const garmentingNames = new Set<string>();
  for (const r of articles) {
    for (const v of splitList(r.FabricVendors)) vendorNames.add(v);
    if (r.GarmentingAt) garmentingNames.add(norm(r.GarmentingAt));
  }
  for (const r of fabrics) {
    if (r.Vendor) vendorNames.add(norm(r.Vendor));
  }

  const existingVendors = await prisma.vendor.findMany({
    where: { name: { in: Array.from(vendorNames) } },
    select: { id: true, name: true },
  });
  const vendorIdByName = new Map<string, string>(
    existingVendors.map((v) => [v.name, v.id]),
  );
  const missingVendors = Array.from(vendorNames).filter((n) => !vendorIdByName.has(n));
  if (missingVendors.length > 0) {
    console.error(
      `[masters] ABORT — missing vendors (must be created manually first):\n  ${missingVendors.join("\n  ")}`,
    );
    throw new Error(`${missingVendors.length} vendor(s) missing`);
  }
  console.log(`[masters] all ${vendorNames.size} vendors resolved`);

  const existingGarmenters = await prisma.garmentingLocation.findMany({
    where: { name: { in: Array.from(garmentingNames) } },
    select: { id: true, name: true },
  });
  const garmentingLocationIdByName = new Map<string, string>(
    existingGarmenters.map((g) => [g.name, g.id]),
  );
  const missingGarmenters = Array.from(garmentingNames).filter(
    (n) => !garmentingLocationIdByName.has(n),
  );
  if (missingGarmenters.length > 0) {
    console.warn(
      `[masters] WARN — missing garmenting locations (will leave garmentingAtId null):\n  ${missingGarmenters.join("\n  ")}`,
    );
  }

  // Colours used as ordered/available
  const colourNames = new Set<string>();
  for (const r of articles) if (r.ResolvedColour) colourNames.add(norm(r.ResolvedColour));
  for (const r of fabrics) {
    if (r.Colour) colourNames.add(norm(r.Colour));
    if (r.AvailableColour) colourNames.add(norm(r.AvailableColour));
  }
  const existingColours = await prisma.colour.findMany({
    where: { name: { in: Array.from(colourNames) } },
    select: { id: true, name: true },
  });
  const colourIdByName = new Map<string, string>(
    existingColours.map((c) => [c.name, c.id]),
  );
  const missingColours = Array.from(colourNames).filter((n) => !colourIdByName.has(n));
  if (missingColours.length > 0) {
    console.warn(
      `[masters] WARN — colours not in DB (will leave colourId null):\n  ${missingColours.join("\n  ")}`,
    );
    // Don't auto-create: colour table has a `code` field which we can't infer.
  }
  console.log(
    `[masters] colours: ${colourIdByName.size} found, ${missingColours.length} missing (left unlinked)`,
  );

  return {
    articles,
    fabrics,
    phaseIdByNumber,
    vendorIdByName,
    vendorIdByFabricName,
    mrpByFabricName,
    garmentingLocationIdByName,
    colourIdByName,
    masterBySku,
  };
}

// ─── Stage: products ─────────────────────────────────────────────
async function stageProducts(ctx: Ctx): Promise<void> {
  console.log(`\n[products] ${mode}`);
  // Dedup must use the RESOLVED (current) sku code, not the workbook's raw sku,
  // because renamed SKUs are stored under their current value in Product.
  const resolvedSkus = Array.from(
    new Set(
      ctx.articles
        .map((r) => ctx.masterBySku.get(norm(r.SkuCode))?.currentSkuCode)
        .filter((s): s is string => !!s),
    ),
  );
  const existing = await prisma.product.findMany({
    where: { skuCode: { in: resolvedSkus } },
    select: { skuCode: true, phaseId: true, articleNumber: true, fabricName: true, isRepeat: true, notes: true },
  });
  // Bucket by (skuCode, phaseId, isRepeat, fabricName) so we can detect when
  // the SAME workbook row was already seeded but allow legitimate dupes
  // (e.g. same sku in P3-AO-New and P3-AO-Rpt — different isRepeat).
  const existingCount = new Map<string, number>();
  for (const p of existing) {
    const key = `${p.skuCode}|${p.phaseId}|${p.isRepeat}|${p.fabricName}`;
    existingCount.set(key, (existingCount.get(key) ?? 0) + 1);
  }

  let toCreate = 0;
  let skipped = 0;
  let created = 0;
  for (const row of ctx.articles) {
    const sku = norm(row.SkuCode);
    if (!sku) continue;
    const master = ctx.masterBySku.get(sku);
    if (!master) continue; // already errored in masters stage
    const phaseId = ctx.phaseIdByNumber.get(row.Phase);
    if (!phaseId) continue;

    const fabricVendors = splitList(row.FabricVendors);
    const fabricNames = splitList(row.FabricNames);
    const fabricName = fabricNames[0] ?? "";
    const fabric2Name = norm(row.Fabric2Name) || fabricNames[1] || null;
    // Dedup: same (sku, phase, isRepeat, fabricName) row already in DB? skip.
    // This allows legit duplicates (same sku in *-New + *-Rpt sheets, different
    // isRepeat) while suppressing genuine re-runs.
    const dedupKey = `${master.currentSkuCode}|${phaseId}|${row.IsRepeat}|${fabricName}`;
    if ((existingCount.get(dedupKey) ?? 0) > 0) {
      existingCount.set(dedupKey, existingCount.get(dedupKey)! - 1);
      skipped++;
      continue;
    }
    // Vendor: row first, fall back to FabricMaster.vendorId by fabric name
    const fabricVendor1Id =
      (fabricVendors[0] ? ctx.vendorIdByName.get(fabricVendors[0]) : undefined) ??
      (fabricName ? ctx.vendorIdByFabricName.get(fabricName) : undefined);
    const fabricVendor2Id =
      (fabricVendors[1] ? ctx.vendorIdByName.get(fabricVendors[1]) : undefined) ??
      (fabric2Name ? ctx.vendorIdByFabricName.get(fabric2Name) : undefined);
    if (!fabricVendor1Id) {
      console.warn(`[products] skip ${sku} P${row.Phase}: no vendor (fabric="${fabricName}")`);
      continue;
    }

    const colourOrdered = norm(row.ResolvedColour);
    const garmentingAt = norm(row.GarmentingAt) || null;
    const garmentingAtId =
      garmentingAt ? ctx.garmentingLocationIdByName.get(garmentingAt) ?? null : null;

    const workbookStatus = norm(row.Status);
    const notes = [
      `Seeded from ${row.Sheet} (Phase ${row.Phase}${row.IsRepeat ? ", repeat" : ""}).`,
      sku !== master.currentSkuCode ? `Workbook SKU "${sku}" → current "${master.currentSkuCode}".` : null,
      workbookStatus ? `Workbook status: "${workbookStatus}".` : null,
    ]
      .filter(Boolean)
      .join(" ");

    const data = {
      phaseId,
      orderDate: row.Phase === 2 ? "15 Apr 2025" : "15 Aug 2025",
      styleNumber: "",
      articleNumber: master.articleNumber,
      skuCode: master.currentSkuCode,
      colourOrdered,
      colourOrderedId: ctx.colourIdByName.get(colourOrdered) ?? null,
      isRepeat: row.IsRepeat,
      type: master.type,
      gender: master.gender as never,
      productName: master.productName,
      typeRefId: master.typeRefId ?? null,
      status: "PLANNED" as never,
      fabricVendorId: fabricVendor1Id,
      fabricName,
      fabricGsm: row.GSM,
      fabricCostPerKg: row.CostPerKg,
      assumedFabricGarmentsPerKg: row.Fabric1GarmentsPerKg,
      fabric2Name,
      fabric2CostPerKg: row.Fabric2CostPerKg,
      assumedFabric2GarmentsPerKg: row.Fabric2GarmentsPerKg,
      fabric2VendorId: fabricVendor2Id ?? null,
      fabricOrderedQuantityKg: row.Fabric1OrderedKg,
      fabricShippedQuantityKg: row.Fabric1ShippedKg,
      fabric2OrderedQuantityKg: row.Fabric2OrderedKg,
      garmentNumber: row.GarmentNumber,
      actualStitchedS: row.ActualStitched_S ?? 0,
      actualStitchedM: row.ActualStitched_M ?? 0,
      actualStitchedL: row.ActualStitched_L ?? 0,
      actualStitchedXL: row.ActualStitched_XL ?? 0,
      actualStitchedXXL: row.ActualStitched_XXL ?? 0,
      stitchingCost: row.StitchingCost,
      brandLogoCost: row.BrandLogoCost,
      neckTwillCost: row.NeckTwillCost,
      reflectorsCost: row.ReflectorsCost,
      fusingCost: row.FusingCost,
      accessoriesCost: row.AccessoriesCost,
      brandTagCost: row.BrandTagCost,
      sizeTagCost: row.SizeTagCost,
      packagingCost: row.PackagingCost,
      proposedMrp: row.ProposedMrp,
      onlineMrp: row.OnlineMrp,
      garmentingAt,
      garmentingAtId,
      notes,
    };

    toCreate++;
    if (APPLY) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await prisma.product.create({ data: data as any });
      created++;
    }
  }
  console.log(
    `[products] would-create=${toCreate} skip-existing=${skipped}` +
      (APPLY ? ` created=${created}` : ""),
  );
}

// ─── Stage: fabric-orders ────────────────────────────────────────
async function stageFabricOrders(ctx: Ctx): Promise<void> {
  console.log(`\n[fabric-orders] ${mode}`);
  // Pre-fetch existing fabric orders for the article numbers we touch, so we
  // can de-dupe on (phaseId, fabricName, colour, articleNumbers intersection)
  // the same way the dry-run does.
  const articleNumbers = Array.from(
    new Set(ctx.fabrics.flatMap((r) => splitList(r.ArticleNumbers))),
  );
  const phaseIds = Array.from(ctx.phaseIdByNumber.values());
  const existing = await prisma.fabricOrder.findMany({
    where: {
      OR: [
        // Empty-articleNumbers FabricOrders in our phases (otherwise the
        // sub-clauses below would miss them since they only match by article).
        { phaseId: { in: phaseIds }, articleNumbers: "" },
        { articleNumbers: { in: articleNumbers } },
        ...articleNumbers.map((n) => ({ articleNumbers: { contains: n } })),
      ],
    },
    select: {
      id: true,
      phaseId: true,
      fabricName: true,
      colour: true,
      articleNumbers: true,
    },
  });

  function overlaps(row: FabricRow, ex: (typeof existing)[number]): boolean {
    if (ctx.phaseIdByNumber.get(row.Phase) !== ex.phaseId) return false;
    if (ex.fabricName !== row.FabricName) return false;
    if (norm(ex.colour) !== norm(row.Colour)) return false;
    const wanted = splitList(row.ArticleNumbers);
    const have = splitList(ex.articleNumbers);
    // Empty articleNumbers on both sides → treat as the same bucket. Without
    // this, rows with blank article numbers (e.g. raw fabric buys not tied to
    // any article) bypass dedup and duplicate on every re-run.
    if (wanted.length === 0 && have.length === 0) return true;
    return wanted.some((w) => have.includes(w));
  }

  let toCreate = 0;
  let skipped = 0;
  let created = 0;
  let cutToPiecePlaceholder = 0;
  for (const row of ctx.fabrics) {
    const phaseId = ctx.phaseIdByNumber.get(row.Phase);
    if (!phaseId) continue;
    const fabricVendorId = ctx.vendorIdByName.get(norm(row.Vendor));
    if (!fabricVendorId) {
      console.warn(`[fabric-orders] skip ${row.FabricName}: vendor "${row.Vendor}" unresolved`);
      continue;
    }
    if (existing.some((ex) => overlaps(row, ex))) {
      skipped++;
      continue;
    }
    const colour = norm(row.Colour);
    const availableColour = norm(row.AvailableColour) || null;
    // Cut-to-piece rows have non-numeric cost in the workbook; the dry-run
    // already flagged them. Fall back to FabricMaster.mrp as a placeholder so
    // the row still inserts; the note records the substitution.
    let costPerUnit: number | null = row.CostPerKg;
    let cutToPieceNote: string | null = null;
    if (row.CostPerKgWasCutToPiece) {
      const mrp = ctx.mrpByFabricName.get(norm(row.FabricName));
      costPerUnit = mrp ?? null;
      cutToPieceNote = `Cut-to-piece order; cost-per-kg substituted with FabricMaster.mrp${mrp != null ? ` (${mrp})` : " (unset)"} as a placeholder.`;
      cutToPiecePlaceholder++;
    }
    // Workbook Gender is freeform ("Mens", "Womens & Kids", "Collars", etc.);
    // map only clean single-gender values to the enum, otherwise null + note.
    const genderRaw = norm(row.Gender);
    const genderEnum =
      genderRaw === "Mens" ? "MENS" :
      genderRaw === "Womens" ? "WOMENS" :
      genderRaw === "Kids" ? "KIDS" : null;
    const genderNote =
      genderRaw && !genderEnum ? `Workbook gender: "${genderRaw}".` : null;
    const data = {
      phaseId,
      fabricVendorId,
      gender: genderEnum as never,
      articleNumbers: norm(row.ArticleNumbers),
      fabricName: norm(row.FabricName),
      colour,
      colourId: colour ? ctx.colourIdByName.get(colour) ?? null : null,
      availableColour,
      availableColourId:
        availableColour ? ctx.colourIdByName.get(availableColour) ?? null : null,
      costPerUnit,
      fabricOrderedQuantityKg: row.OrderedKg,
      fabricShippedQuantityKg: row.ShippedKg,
      isRepeat: row.IsRepeat,
      invoiceNumber: norm(row.InvoiceNumber) || null,
      receivedAt: norm(row.ReceivedAt) || null,
      orderStatus: "FULLY_SETTLED" as never,
      statusChangedAt: new Date(),
      notes: [
        `Seeded from ${row.Sheet} (Phase ${row.Phase}${row.IsRepeat ? ", repeat" : ""}).`,
        cutToPieceNote,
        genderNote,
        norm(row.Notes) || null,
      ]
        .filter(Boolean)
        .join(" "),
    };
    toCreate++;
    if (APPLY) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const created_ = await prisma.fabricOrder.create({ data: data as any });
      created++;
      await syncFabricOrderProductLinks(created_.id);
    }
  }
  console.log(
    `[fabric-orders] would-create=${toCreate} skip-existing=${skipped} cut-to-piece-mrp-fallback=${cutToPiecePlaceholder}` +
      (APPLY ? ` created=${created}` : ""),
  );
}

/**
 * Inlined copy of src/actions/fabric-orders.ts → syncFabricOrderProductLinks
 * (the original requires an authenticated session). Keep behaviour parallel.
 */
async function syncFabricOrderProductLinks(fabricOrderId: string) {
  const fo = await prisma.fabricOrder.findUnique({ where: { id: fabricOrderId } });
  if (!fo) return;
  await prisma.productFabricOrder.deleteMany({ where: { fabricOrderId } });
  const articles = splitList(fo.articleNumbers);
  if (articles.length === 0) return;
  const candidates = await prisma.product.findMany({
    where: { phaseId: fo.phaseId, articleNumber: { in: articles } },
    select: { id: true, colourOrdered: true, fabricName: true, fabric2Name: true },
  });
  const matchColour = (a: string | null | undefined, b: string | null | undefined) =>
    (a || "").toLowerCase().trim() === (b || "").toLowerCase().trim();
  const links: Array<{ productId: string; fabricOrderId: string; fabricSlot: number }> = [];
  for (const p of candidates) {
    if (!matchColour(p.colourOrdered, fo.colour)) continue;
    const slot =
      p.fabricName === fo.fabricName ? 1 : p.fabric2Name === fo.fabricName ? 2 : null;
    if (slot === null) continue;
    links.push({ productId: p.id, fabricOrderId, fabricSlot: slot });
  }
  if (links.length > 0) {
    await prisma.productFabricOrder.createMany({ data: links, skipDuplicates: true });
  }
}

// ─── Stage: phase-fabric writeback ───────────────────────────────
// Group Products by (phaseId, productMasterId). For each bucket, confirm the
// products agree on (fabricName, fabricCostPerKg, garmentsPerKg, fabric2Name,
// fabric2CostPerKg, garmentsPerKg2, fabricVendorId, fabric2VendorId). If they
// disagree, fail loudly. If the agreed values differ from the master's
// resolved-at-phase spec, upsert a PhaseFabric row.
async function stagePhaseFabric(ctx: Ctx): Promise<void> {
  console.log(`\n[phase-fabric] ${mode}`);
  const phase2Id = ctx.phaseIdByNumber.get(2)!;
  const phase3Id = ctx.phaseIdByNumber.get(3)!;
  const products = await prisma.product.findMany({
    where: { phaseId: { in: [phase2Id, phase3Id] } },
    select: {
      id: true,
      phaseId: true,
      skuCode: true,
      articleNumber: true,
      fabricName: true,
      fabricVendorId: true,
      fabricCostPerKg: true,
      assumedFabricGarmentsPerKg: true,
      fabric2Name: true,
      fabric2VendorId: true,
      fabric2CostPerKg: true,
      assumedFabric2GarmentsPerKg: true,
    },
  });

  // Resolve each product's master id via skuCode + previousSkuCodes
  const skuSet = new Set(products.map((p) => p.skuCode).filter(Boolean) as string[]);
  const [byCurrent, byPrev] = await Promise.all([
    prisma.productMaster.findMany({
      where: { skuCode: { in: Array.from(skuSet) } },
      select: { id: true, skuCode: true },
    }),
    prisma.productMaster.findMany({
      where: { previousSkuCodes: { hasSome: Array.from(skuSet) } },
      select: { id: true, skuCode: true, previousSkuCodes: true },
    }),
  ]);
  const masterIdBySku = new Map<string, string>();
  for (const m of byCurrent) masterIdBySku.set(m.skuCode, m.id);
  for (const m of byPrev) {
    for (const p of m.previousSkuCodes) if (!masterIdBySku.has(p)) masterIdBySku.set(p, m.id);
  }

  type Bucket = {
    phaseId: string;
    productMasterId: string;
    sampleArticle: string | null;
    fabricName: Set<string | null>;
    fabricVendorId: Set<string | null>;
    fabricCostPerKg: Set<string | null>;
    garmentsPerKg: Set<string | null>;
    fabric2Name: Set<string | null>;
    fabric2VendorId: Set<string | null>;
    fabric2CostPerKg: Set<string | null>;
    garmentsPerKg2: Set<string | null>;
  };
  const buckets = new Map<string, Bucket>();
  const dec = (v: { toString: () => string } | null) => (v == null ? null : v.toString());
  for (const p of products) {
    const masterId = p.skuCode ? masterIdBySku.get(p.skuCode) : null;
    if (!masterId) continue;
    const key = `${p.phaseId}|${masterId}`;
    let b = buckets.get(key);
    if (!b) {
      b = {
        phaseId: p.phaseId,
        productMasterId: masterId,
        sampleArticle: p.articleNumber,
        fabricName: new Set(),
        fabricVendorId: new Set(),
        fabricCostPerKg: new Set(),
        garmentsPerKg: new Set(),
        fabric2Name: new Set(),
        fabric2VendorId: new Set(),
        fabric2CostPerKg: new Set(),
        garmentsPerKg2: new Set(),
      };
      buckets.set(key, b);
    }
    b.fabricName.add(p.fabricName ?? null);
    b.fabricVendorId.add(p.fabricVendorId ?? null);
    b.fabricCostPerKg.add(dec(p.fabricCostPerKg));
    b.garmentsPerKg.add(dec(p.assumedFabricGarmentsPerKg));
    b.fabric2Name.add(p.fabric2Name ?? null);
    b.fabric2VendorId.add(p.fabric2VendorId ?? null);
    b.fabric2CostPerKg.add(dec(p.fabric2CostPerKg));
    b.garmentsPerKg2.add(dec(p.assumedFabric2GarmentsPerKg));
  }

  const sole = <T>(s: Set<T>): T | undefined => (s.size === 1 ? s.values().next().value : undefined);

  // Existing master + phase data for comparison
  const masterIds = Array.from(new Set(Array.from(buckets.values()).map((b) => b.productMasterId)));
  const masters = await prisma.productMaster.findMany({
    where: { id: { in: masterIds } },
    select: {
      id: true,
      articleNumber: true,
      fabricName: true,
      fabricCostPerKg: true,
      garmentsPerKg: true,
      fabric2Name: true,
      fabric2CostPerKg: true,
      garmentsPerKg2: true,
    },
  });
  const masterById = new Map(masters.map((m) => [m.id, m]));

  const existingPhaseFabric = await prisma.phaseFabric.findMany({
    where: {
      phaseId: { in: [phase2Id, phase3Id] },
      productMasterId: { in: masterIds },
    },
  });
  const phaseFabricByKey = new Map(
    existingPhaseFabric.map((r) => [`${r.phaseId}|${r.productMasterId}`, r]),
  );

  let conflicts = 0;
  let toUpsert = 0;
  let upserted = 0;
  let unchanged = 0;
  for (const [key, b] of buckets) {
    const fabricName = sole(b.fabricName);
    if (fabricName === undefined) {
      conflicts++;
      console.error(
        `[phase-fabric] CONFLICT ${b.sampleArticle ?? "?"} phase=${b.phaseId === phase2Id ? 2 : 3}: fabricName values=${JSON.stringify(Array.from(b.fabricName))}`,
      );
      continue;
    }
    const fabricVendorId = sole(b.fabricVendorId);
    const fabricCostPerKg = sole(b.fabricCostPerKg);
    const garmentsPerKg = sole(b.garmentsPerKg);
    const fabric2Name = sole(b.fabric2Name);
    const fabric2VendorId = sole(b.fabric2VendorId);
    const fabric2CostPerKg = sole(b.fabric2CostPerKg);
    const garmentsPerKg2 = sole(b.garmentsPerKg2);
    if (
      fabricVendorId === undefined ||
      fabricCostPerKg === undefined ||
      garmentsPerKg === undefined ||
      fabric2Name === undefined ||
      fabric2VendorId === undefined ||
      fabric2CostPerKg === undefined ||
      garmentsPerKg2 === undefined
    ) {
      conflicts++;
      console.error(
        `[phase-fabric] CONFLICT ${b.sampleArticle ?? "?"} phase=${b.phaseId === phase2Id ? 2 : 3}: products disagree on fabric spec`,
      );
      continue;
    }

    const master = masterById.get(b.productMasterId);
    if (!master) continue;

    // Compute what the phase row would be vs master defaults — only write
    // fields that diverge from master (so PhaseFabric only stores deltas).
    const masterCmp = {
      fabricName: master.fabricName ?? null,
      fabricCostPerKg: dec(master.fabricCostPerKg),
      garmentsPerKg: dec(master.garmentsPerKg),
      fabric2Name: master.fabric2Name ?? null,
      fabric2CostPerKg: dec(master.fabric2CostPerKg),
      garmentsPerKg2: dec(master.garmentsPerKg2),
    };

    const updateData: Record<string, unknown> = {};
    if (fabricName !== masterCmp.fabricName) updateData.fabricName = fabricName;
    if (fabricCostPerKg !== masterCmp.fabricCostPerKg)
      updateData.fabricCostPerKg = fabricCostPerKg;
    if (garmentsPerKg !== masterCmp.garmentsPerKg) updateData.garmentsPerKg = garmentsPerKg;
    if (fabric2Name !== masterCmp.fabric2Name) updateData.fabric2Name = fabric2Name;
    if (fabric2CostPerKg !== masterCmp.fabric2CostPerKg)
      updateData.fabric2CostPerKg = fabric2CostPerKg;
    if (garmentsPerKg2 !== masterCmp.garmentsPerKg2)
      updateData.garmentsPerKg2 = garmentsPerKg2;
    // Vendor IDs aren't on master columns; they only live on PhaseFabric.
    if (fabricVendorId) updateData.fabricVendorId = fabricVendorId;
    if (fabric2VendorId) updateData.fabric2VendorId = fabric2VendorId;

    if (Object.keys(updateData).length === 0) {
      unchanged++;
      continue;
    }

    const existing = phaseFabricByKey.get(key);
    const sameAsExisting =
      existing &&
      Object.entries(updateData).every(([k, v]) => {
        const ex = (existing as unknown as Record<string, unknown>)[k];
        const exStr = ex && typeof ex === "object" && "toString" in (ex as object)
          ? (ex as { toString(): string }).toString()
          : ex;
        return String(exStr ?? "") === String(v ?? "");
      });
    if (sameAsExisting) {
      unchanged++;
      continue;
    }

    toUpsert++;
    if (APPLY) {
      await prisma.phaseFabric.upsert({
        where: {
          phaseId_productMasterId: {
            phaseId: b.phaseId,
            productMasterId: b.productMasterId,
          },
        },
        update: updateData,
        create: {
          phaseId: b.phaseId,
          productMasterId: b.productMasterId,
          ...updateData,
        },
      });
      upserted++;
    }
  }

  console.log(
    `[phase-fabric] buckets=${buckets.size} conflicts=${conflicts} would-upsert=${toUpsert} unchanged=${unchanged}` +
      (APPLY ? ` upserted=${upserted}` : ""),
  );
  if (conflicts > 0) {
    throw new Error(`${conflicts} bucket(s) had conflicting fabric specs across products`);
  }
}

// ─── Main ────────────────────────────────────────────────────────
async function main() {
  console.log(`=== seed-phase-2-3 :: ${mode} :: stages=${Array.from(STAGES).join(",")} ===`);
  const ctx = await stageMasters(); // always run; builds shared lookups
  if (STAGES.has("products")) await stageProducts(ctx);
  if (STAGES.has("fabric-orders")) await stageFabricOrders(ctx);
  if (STAGES.has("phase-fabric")) await stagePhaseFabric(ctx);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
