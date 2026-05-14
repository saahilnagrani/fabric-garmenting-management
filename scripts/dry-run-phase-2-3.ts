/**
 * Dry-run reconciliation for Hyperballik_Phase 2-3 Data.xlsx.
 *
 * - Reads every sheet, normalises rows, applies vendor/garmenter aliases.
 * - Reports: missing ProductMasters (by skuCode), missing Vendors,
 *   overlap candidates against existing Products and FabricOrders, and
 *   any "Cut to Piece" / non-numeric Cost/Kg rows.
 * - Writes a normalised workbook to Data/Hyperballik_Phase 2-3 Data.normalised.xlsx
 *   that the actual seeder will consume. No DB writes.
 *
 *   tsx scripts/dry-run-phase-2-3.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import * as XLSX from "xlsx";
import * as fs from "fs";
import * as path from "path";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const SRC = "/Users/saahilnagrani/Documents/Projects/hyperballik/Data/Hyperballik_Phase 2-3 Data.xlsx";
const OUT = "/Users/saahilnagrani/Documents/Projects/hyperballik/Data/Hyperballik_Phase 2-3 Data.normalised.xlsx";
const REPORT = "/Users/saahilnagrani/Documents/Projects/hyperballik/Data/Hyperballik_Phase 2-3 Data.dry-run.json";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const VENDOR_ALIASES: Record<string, string> = {
  Global: "Global House",
  "Global & Pugazh": "Global House",
  "Swimwear Delhi": "KS Art & Craft",
  "Mumtaz/Ultron": "Mumtaz",
  "Ultron/Mumtaz": "Ultron",
  "Pranera ": "Pranera",
  "Positex ": "Positex",
  "V print": "V Print",
  // Data-quality fixes confirmed for this workbook:
  Puvazh: "Pugazh",
  "Poly Spandex": "Global House",
  Nylon: "Shree Fabrics",
  Surat: "Swarangi Synthetics",
  "Swarangi Surat": "Swarangi Synthetics",
};

const aliasVendor = (raw: unknown): string | null => {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  if (!s) return null;
  return VENDOR_ALIASES[s] ?? VENDOR_ALIASES[s + " "] ?? s;
};

// Canonicalisation map for fabric-order colour values that don't match any
// existing Colour row verbatim. Verified against the DB.
const COLOUR_MAP: Record<string, string | null> = {
  Airforce: "Airforce Blue",
  Cofee: "Kofee",
  "D Grey": "Dark Grey",
  "Dark grey": "Dark Grey",
  "Lemon yellow": "Lemon Yellow",
  "Light grey": "Light Grey",
  "Lt Grey": "Light Grey",
  "M Grey": "Medium Grey",
  SkyBlue: "Sky Blue",
  "Black & grey": "Black",
  "Grey & Black": "Grey",
  "All above colours": null,
  NA: null,
};

// canonicaliseColour: returns the canonical colour and (optionally) a note
// describing the mapping for seed provenance.
function canonicaliseColour(raw: string): { colour: string | null; note: string | null } {
  if (!raw) return { colour: null, note: null };
  if (!(raw in COLOUR_MAP)) return { colour: raw, note: null };
  const mapped = COLOUR_MAP[raw];
  const note =
    mapped === null
      ? `Seed data colour was "${raw}"; left blank.`
      : `Seed data colour was "${raw}"; assigned ${mapped}.`;
  return { colour: mapped, note };
}

const s = (v: unknown) => (v === null || v === undefined ? "" : String(v).trim());

// Workbook-level SKU typo fix: "K SW 16 PNK" → "K SW16 PNK", "M SW 15 BLN" → "M SW15 BLN".
function normaliseSkuWhitespace(raw: string): string {
  return raw.replace(/^([MWK])\s+SW\s+(\d+)\s+/i, (_, gender, num) => `${gender} SW${num} `);
}
const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const isMostlyEmpty = (row: Record<string, unknown>) =>
  Object.values(row).filter((v) => v !== null && v !== undefined && v !== "").length <= 1;

type ArticleRow = {
  sheet: string;
  phaseNumber: 2 | 3;
  isRepeat: boolean;
  articleNumber: string;
  skuCode: string;
  fabricVendors: string[];
  fabricNames: string[];
  fabric2Name: string | null;
  gsm: number | null;
  costPerKg: number | null;
  costPerKg2: number | null;
  fabric1OrderedKg: number | null;
  fabric1ShippedKg: number | null;
  fabric2OrderedKg: number | null;
  fabric1GarmentsPerKg: number | null;
  fabric2GarmentsPerKg: number | null;
  garmentingAt: string | null;
  status: string | null;
  garmentNumber: number | null;
  actualS: number;
  actualM: number;
  actualL: number;
  actualXL: number;
  actualXXL: number;
  stitchingCost: number | null;
  brandLogoCost: number | null;
  neckTwillCost: number | null;
  reflectorsCost: number | null;
  fusingCost: number | null;
  accessoriesCost: number | null;
  brandTagCost: number | null;
  sizeTagCost: number | null;
  packagingCost: number | null;
  inwardShipping: number | null;
  proposedMrp: number | null;
  onlineMrp: number | null;
};

type FabricRow = {
  sheet: string;
  phaseNumber: 2 | 3;
  isRepeat: boolean;
  vendor: string;
  fabricName: string;
  articleNumbers: string;
  colour: string | null;
  availableColour: string | null;
  gender: string | null;
  orderedKg: number | null;
  shippedKg: number | null;
  costPerKg: number | null;
  costPerKgIsCutToPiece: boolean;
  receivedAt: string | null;
  invoiceNumber: string | null;
  notes: string | null;
};

const articleRows: ArticleRow[] = [];
const fabricRows: FabricRow[] = [];
const cutToPieceRows: { sheet: string; row: number; fabric: string; vendor: string; colour: string }[] = [];

function pick<T = unknown>(row: Record<string, unknown>, ...keys: string[]): T | undefined {
  for (const k of keys) {
    if (k in row && row[k] !== null && row[k] !== undefined && row[k] !== "") return row[k] as T;
  }
  return undefined;
}

function splitList(raw: unknown): string[] {
  const t = s(raw);
  if (!t) return [];
  return t.split(",").map((x) => x.trim()).filter(Boolean);
}

function parseArticleSheet(
  wb: XLSX.WorkBook,
  sheet: string,
  phaseNumber: 2 | 3,
  isRepeat: boolean
) {
  if (!wb.Sheets[sheet]) return;
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sheet], { defval: null });
  for (const row of rows) {
    if (isMostlyEmpty(row)) continue;
    const skuCode = normaliseSkuWhitespace(s(pick(row, "SKU Code", "Article Code/SKU Code", "Article Code/SKU COde")));
    const articleNumber = s(pick(row, "Article Number"));
    if (!skuCode && !articleNumber) continue;
    // Section header rows like "MENS" sometimes have a single string value
    if (!skuCode && !articleNumber) continue;

    const fabricVendorsRaw = s(
      pick(row, "Fabric Vendor(s) (Comma separated)", "Fabric Vendor", "Fabric 1 Vendor", "Vendor")
    );
    const fabricVendors = splitList(fabricVendorsRaw).map((v) => aliasVendor(v) ?? v);
    const fabricNamesRaw = s(
      pick(row, "Fabric(s) Used (Comma separated)", "Fabric Used", "Fabrics", "Fabric", "Fabric 1")
    );
    const fabricNames = splitList(fabricNamesRaw);
    // Fabric-2 NAME: either second token of the comma-list, or the dedicated
    // "Fabric 2" column on P3-AO-Rpt. The "Second Fabric " column on P3-AO-New
    // and P3-AO-SWM is the fabric-2 QUANTITY (kg), not a name — never read it here.
    const fabric2 = fabricNames[1] ?? s(pick(row, "Fabric 2"));
    // Fabric-2 ordered quantity (kg) — lives in "Second Fabric " (P3-AO-New,
    // P3-AO-SWM) or "Fabric 2 Quantity" (P3-AO-Rpt).
    const fabric2OrderedKg = num(pick(row, "Second Fabric ", "Fabric 2 Quantity"));

    articleRows.push({
      sheet,
      phaseNumber,
      isRepeat,
      articleNumber,
      skuCode,
      fabricVendors,
      fabricNames,
      fabric2Name: fabric2 || null,
      gsm: num(pick(row, "GSM")),
      costPerKg: num(pick(row, "Cost/Kg")),
      costPerKg2: num(pick(row, "2nd Fabric Cost", "Second Fabric Cost")),
      fabric1OrderedKg: num(
        pick(row, "Fabric 1 Quantity Ordered", "Fabric 1 Quantity", "Order Quantity(Kg)", "Shipped Quantity")
      ),
      fabric1ShippedKg: num(pick(row, "Fabric 1 Quantity Shipped", "Shipped Quantity")),
      fabric2OrderedKg,
      fabric1GarmentsPerKg: num(
        pick(row, "Fabric 1 Garments/kg", "Fabric 1 Garments/Kg", "Fabric 1 garments/Kg", "Fabric 1 Garments Per Kg")
      ),
      fabric2GarmentsPerKg: num(pick(row, "Fabric 2 Garments/kg")),
      garmentingAt: (() => {
        const v = s(pick(row, "Garmenting At"));
        if (!v) return null;
        return aliasVendor(v) ?? v;
      })(),
      status: s(pick(row, "Status ", "Status")) || null,
      garmentNumber: num(
        pick(
          row,
          "Target Qty (Number of Garments)",
          "Target Quantity(Number of Garments)",
          "Target Quantity (No of Garments)",
          "Target Quantity (Number of Garments)",
          "Target Quantity(Number of Garment)",
          "Number of Garment",
          "Total QTY"
        )
      ),
      actualS: num(pick(row, "Actual Stitched S", "S")) ?? 0,
      actualM: num(pick(row, "Actual Stitched M", "M")) ?? 0,
      actualL: num(pick(row, "Actual Stitched L", "L")) ?? 0,
      actualXL: num(pick(row, "Actual Stitched XL", "XL")) ?? 0,
      actualXXL: num(pick(row, "Actual Stitched XXL", "XXL")) ?? 0,
      stitchingCost: num(pick(row, "Stiching Cost")),
      brandLogoCost: num(pick(row, "Brand Logo")),
      neckTwillCost: num(pick(row, "Neck Twill")),
      reflectorsCost: num(pick(row, "Reflectors")),
      fusingCost: num(pick(row, "Fusing")),
      accessoriesCost: num(pick(row, "Accessories")),
      brandTagCost: num(pick(row, "Brand Tag Cost ", "Brand Tag Cost")),
      sizeTagCost: num(pick(row, "Size Tag/hyperballik", "Size Tag/hyperballik+Fusing")),
      packagingCost: num(pick(row, "Packaging")),
      inwardShipping: num(pick(row, "Inward Shipping")),
      proposedMrp: num(pick(row, "Proposed MRP", "Prposed MRP", "MRP")),
      onlineMrp: num(pick(row, "Online MRP")),
    });
  }
}

function parseFabricSheet(
  wb: XLSX.WorkBook,
  sheet: string,
  phaseNumber: 2 | 3,
  isRepeat: boolean
) {
  if (!wb.Sheets[sheet]) return;
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sheet], { defval: null });
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (isMostlyEmpty(row)) continue;
    const vendorRaw = s(pick(row, "Vendor", "Vendor "));
    if (!vendorRaw) continue;
    const vendor = aliasVendor(vendorRaw) ?? vendorRaw;
    const fabricName = s(pick(row, "Fabric Name", "Name", "Fabric"));
    const articleNumbers = s(
      pick(row, "Used for article numbers (comma separated)", "Used for Article Numbers", "Article Numbers", "Style Number")
    );
    const colour = s(pick(row, "Colour"));
    const costRaw = pick(row, "Cost/Kg", "Cost/kg");
    let costPerKg: number | null = null;
    let isCutToPiece = false;
    if (costRaw !== undefined && costRaw !== null && costRaw !== "") {
      const n = Number(costRaw);
      if (Number.isFinite(n)) {
        costPerKg = n;
      } else if (s(costRaw).toLowerCase().includes("cut to piece")) {
        isCutToPiece = true;
        cutToPieceRows.push({ sheet, row: i + 2, fabric: fabricName, vendor, colour });
      }
    }
    // P3-FO-New: MRP column is actually cost/kg
    if (costPerKg === null && !isCutToPiece) {
      const mrp = num(pick(row, "MRP"));
      if (mrp !== null) costPerKg = mrp;
    }
    const colourCanon = canonicaliseColour(colour);
    const availableRaw = s(pick(row, "Available Colour"));
    const availableCanon = availableRaw ? canonicaliseColour(availableRaw) : { colour: null, note: null };
    const noteParts: string[] = [];
    if (colourCanon.note) noteParts.push(colourCanon.note);
    if (availableCanon.note) noteParts.push(`Available colour: ${availableCanon.note}`);
    fabricRows.push({
      sheet,
      phaseNumber,
      isRepeat,
      vendor,
      fabricName,
      articleNumbers,
      colour: colourCanon.colour,
      availableColour: availableCanon.colour,
      gender: s(pick(row, "Gender")) || null,
      orderedKg: num(pick(row, "Quantity Ordered", "Quantity", "Fabric(s) Quantity (kgs)")),
      shippedKg: num(pick(row, "Shipped Quantity", "Quantity Received")),
      costPerKg,
      costPerKgIsCutToPiece: isCutToPiece,
      receivedAt: s(pick(row, "Fabric Received At", "To Be Delivered ", "To Be Delivered")) || null,
      invoiceNumber: s(pick(row, "Bill Number ", "Bill Number")) || null,
      notes: noteParts.length ? noteParts.join(" ") : null,
    });
  }
}

async function main() {
  const wb = XLSX.readFile(SRC);

  parseArticleSheet(wb, "P2-AO-Rpt", 2, true);
  parseArticleSheet(wb, "P2-AO-New", 2, false);
  parseArticleSheet(wb, "P3-AO-New", 3, false);
  parseArticleSheet(wb, "P3-AO-SWM", 3, false);
  parseArticleSheet(wb, "P3-AO-SWD", 3, false);
  parseArticleSheet(wb, "P3-AO-Rpt", 3, true);

  parseFabricSheet(wb, "P2-FO-New", 2, false);
  parseFabricSheet(wb, "P3-FO-New", 3, false);
  parseFabricSheet(wb, "P3-FO-Rpt", 3, true);

  // ─── Reconcile against DB ────────────────────────────────────────
  const skuCodes = Array.from(new Set(articleRows.map((r) => r.skuCode).filter(Boolean)));
  const articleNumbers = Array.from(new Set(articleRows.map((r) => r.articleNumber).filter(Boolean)));
  const vendorNamesFromArticles = new Set<string>();
  for (const r of articleRows) {
    for (const v of r.fabricVendors) vendorNamesFromArticles.add(v);
    if (r.garmentingAt) vendorNamesFromArticles.add(r.garmentingAt);
  }
  const vendorNamesFromFabrics = new Set(fabricRows.map((r) => r.vendor));
  const allVendorNames = Array.from(new Set([...vendorNamesFromArticles, ...vendorNamesFromFabrics]));

  const [masters, mastersByPrev, existingVendors, existingProducts, existingFabricOrders, phases] = await Promise.all([
    prisma.productMaster.findMany({
      where: { skuCode: { in: skuCodes } },
      select: { skuCode: true, coloursAvailable: true },
    }),
    prisma.productMaster.findMany({
      where: { previousSkuCodes: { hasSome: skuCodes } },
      select: { skuCode: true, previousSkuCodes: true, coloursAvailable: true },
    }),
    prisma.vendor.findMany({
      where: { name: { in: allVendorNames } },
      select: { name: true, type: true },
    }),
    prisma.product.findMany({
      where: { skuCode: { in: skuCodes } },
      select: { id: true, skuCode: true, phaseId: true, phase: { select: { number: true } } },
    }),
    prisma.fabricOrder.findMany({
      where: {
        OR: [
          { articleNumbers: { in: articleNumbers } },
          ...articleNumbers.map((n) => ({ articleNumbers: { contains: n } })),
        ],
      },
      select: {
        id: true,
        fabricName: true,
        colour: true,
        articleNumbers: true,
        fabricVendor: { select: { name: true } },
        phase: { select: { number: true } },
      },
    }),
    prisma.phase.findMany({ select: { id: true, number: true } }),
  ]);

  const masterSkuSet = new Set(masters.map((m) => m.skuCode));
  // Map: oldSku → {currentSku, colour}
  const renameMap = new Map<string, { currentSku: string; colour: string | null }>();
  for (const m of mastersByPrev) {
    for (const prev of m.previousSkuCodes) {
      if (skuCodes.includes(prev)) {
        renameMap.set(prev, { currentSku: m.skuCode, colour: m.coloursAvailable[0] ?? null });
      }
    }
  }
  const existingVendorMap = new Map(existingVendors.map((v) => [v.name, v.type]));
  const phaseByNumber = new Map(phases.map((p) => [p.number, p.id]));

  const missingSkus = skuCodes
    .filter((s) => !masterSkuSet.has(s) && !renameMap.has(s))
    .sort();
  const renamedSkus = Array.from(renameMap.entries())
    .map(([oldSku, { currentSku }]) => ({ oldSku, currentSku }))
    .sort((a, b) => a.oldSku.localeCompare(b.oldSku));
  const missingVendors = allVendorNames.filter((n) => !existingVendorMap.has(n)).sort();

  // Existing-product overlap: same skuCode + same phase already inserted
  const productOverlaps: { skuCode: string; phaseNumber: number; existingProductId: string }[] = [];
  for (const r of articleRows) {
    if (!r.skuCode) continue;
    const phaseId = phaseByNumber.get(r.phaseNumber);
    const matches = existingProducts.filter(
      (p) => p.skuCode === r.skuCode && p.phaseId === phaseId
    );
    for (const m of matches) {
      productOverlaps.push({
        skuCode: r.skuCode,
        phaseNumber: r.phaseNumber,
        existingProductId: m.id,
      });
    }
  }

  // Fabric-order overlap: same fabricName + same colour + article-number in list + same phase
  const fabricOrderOverlaps: {
    sheet: string;
    fabricName: string;
    colour: string;
    articleNumbers: string;
    phaseNumber: number;
    existingFabricOrderId: string;
    existingVendor: string;
    existingArticleNumbers: string;
  }[] = [];
  for (const r of fabricRows) {
    const wanted = splitList(r.articleNumbers);
    for (const ex of existingFabricOrders) {
      if (ex.phase?.number !== r.phaseNumber) continue;
      if (ex.fabricName !== r.fabricName) continue;
      if ((ex.colour ?? "") !== r.colour) continue;
      const exList = splitList(ex.articleNumbers);
      const intersect = wanted.some((w) => exList.includes(w));
      if (!intersect) continue;
      fabricOrderOverlaps.push({
        sheet: r.sheet,
        fabricName: r.fabricName,
        colour: r.colour,
        articleNumbers: r.articleNumbers,
        phaseNumber: r.phaseNumber,
        existingFabricOrderId: ex.id,
        existingVendor: ex.fabricVendor.name,
        existingArticleNumbers: ex.articleNumbers,
      });
    }
  }

  // ─── Build normalised workbook ───────────────────────────────────
  const out = XLSX.utils.book_new();

  const articleOut = articleRows.map((r) => ({
    Sheet: r.sheet,
    Phase: r.phaseNumber,
    IsRepeat: r.isRepeat,
    ArticleNumber: r.articleNumber,
    SkuCode: r.skuCode,
    SkuExistsInMaster: masterSkuSet.has(r.skuCode),
    ResolvedSkuCode: renameMap.get(r.skuCode)?.currentSku ?? (masterSkuSet.has(r.skuCode) ? r.skuCode : null),
    ResolvedColour: renameMap.get(r.skuCode)?.colour ?? (masters.find((m) => m.skuCode === r.skuCode)?.coloursAvailable[0] ?? null),
    FabricVendors: r.fabricVendors.join(", "),
    FabricNames: r.fabricNames.join(", "),
    Fabric2Name: r.fabric2Name,
    GSM: r.gsm,
    CostPerKg: r.costPerKg,
    Fabric2CostPerKg: r.costPerKg2,
    Fabric1OrderedKg: r.fabric1OrderedKg,
    Fabric1ShippedKg: r.fabric1ShippedKg,
    Fabric2OrderedKg: r.fabric2OrderedKg,
    Fabric1GarmentsPerKg: r.fabric1GarmentsPerKg,
    Fabric2GarmentsPerKg: r.fabric2GarmentsPerKg,
    GarmentingAt: r.garmentingAt,
    Status: r.status,
    GarmentNumber: r.garmentNumber,
    ActualStitched_S: r.actualS,
    ActualStitched_M: r.actualM,
    ActualStitched_L: r.actualL,
    ActualStitched_XL: r.actualXL,
    ActualStitched_XXL: r.actualXXL,
    StitchingCost: r.stitchingCost,
    BrandLogoCost: r.brandLogoCost,
    NeckTwillCost: r.neckTwillCost,
    ReflectorsCost: r.reflectorsCost,
    FusingCost: r.fusingCost,
    AccessoriesCost: r.accessoriesCost,
    BrandTagCost: r.brandTagCost,
    SizeTagCost: r.sizeTagCost,
    PackagingCost: r.packagingCost,
    InwardShipping: r.inwardShipping,
    ProposedMrp: r.proposedMrp,
    OnlineMrp: r.onlineMrp,
  }));
  XLSX.utils.book_append_sheet(out, XLSX.utils.json_to_sheet(articleOut), "ArticleOrders");

  const fabricOut = fabricRows.map((r) => ({
    Sheet: r.sheet,
    Phase: r.phaseNumber,
    IsRepeat: r.isRepeat,
    Vendor: r.vendor,
    VendorExists: existingVendorMap.has(r.vendor),
    FabricName: r.fabricName,
    ArticleNumbers: r.articleNumbers,
    Colour: r.colour,
    AvailableColour: r.availableColour,
    Gender: r.gender,
    OrderedKg: r.orderedKg,
    ShippedKg: r.shippedKg,
    CostPerKg: r.costPerKg,
    CostPerKgWasCutToPiece: r.costPerKgIsCutToPiece,
    ReceivedAt: r.receivedAt,
    InvoiceNumber: r.invoiceNumber,
    Notes: r.notes,
  }));
  XLSX.utils.book_append_sheet(out, XLSX.utils.json_to_sheet(fabricOut), "FabricOrders");

  XLSX.utils.book_append_sheet(
    out,
    XLSX.utils.json_to_sheet(missingSkus.map((s) => ({ SkuCode: s }))),
    "Missing SKUs"
  );
  XLSX.utils.book_append_sheet(
    out,
    XLSX.utils.json_to_sheet(renamedSkus),
    "Renamed SKUs"
  );
  XLSX.utils.book_append_sheet(
    out,
    XLSX.utils.json_to_sheet(
      missingVendors.map((v) => ({ Vendor: v, AppearedIn: vendorNamesFromArticles.has(v) ? "articles" : "fabrics" }))
    ),
    "Missing Vendors"
  );
  XLSX.utils.book_append_sheet(out, XLSX.utils.json_to_sheet(cutToPieceRows), "Cut To Piece");
  XLSX.utils.book_append_sheet(out, XLSX.utils.json_to_sheet(productOverlaps), "Product Overlaps");
  XLSX.utils.book_append_sheet(out, XLSX.utils.json_to_sheet(fabricOrderOverlaps), "FabricOrder Overlaps");

  XLSX.writeFile(out, OUT);

  const report = {
    sourceFile: SRC,
    normalisedFile: OUT,
    counts: {
      articleRows: articleRows.length,
      fabricRows: fabricRows.length,
      uniqueSkus: skuCodes.length,
      uniqueArticleNumbers: articleNumbers.length,
      uniqueVendors: allVendorNames.length,
      missingSkus: missingSkus.length,
      renamedSkus: renamedSkus.length,
      missingVendors: missingVendors.length,
      cutToPieceRows: cutToPieceRows.length,
      productOverlaps: productOverlaps.length,
      fabricOrderOverlaps: fabricOrderOverlaps.length,
      phasesResolved: Array.from(phaseByNumber.entries()).map(([n, id]) => ({ number: n, id })),
    },
    missingSkus,
    missingVendors,
    cutToPieceRows,
    productOverlapsPreview: productOverlaps.slice(0, 20),
    fabricOrderOverlapsPreview: fabricOrderOverlaps.slice(0, 20),
  };

  fs.writeFileSync(REPORT, JSON.stringify(report, null, 2));

  console.log("\n=== DRY RUN SUMMARY ===");
  console.log(JSON.stringify(report.counts, null, 2));
  console.log(`\nMissing SKUs (${missingSkus.length}):`);
  console.log(missingSkus.length ? missingSkus.join(", ") : "  (none)");
  console.log(`\nMissing Vendors (${missingVendors.length}):`);
  console.log(missingVendors.length ? missingVendors.join(", ") : "  (none)");
  console.log(`\nCut-to-piece rows: ${cutToPieceRows.length}`);
  console.log(`Existing Product overlaps (skuCode + phase already present): ${productOverlaps.length}`);
  console.log(`Existing FabricOrder overlaps: ${fabricOrderOverlaps.length}`);
  console.log(`\nNormalised workbook: ${OUT}`);
  console.log(`Full JSON report: ${REPORT}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
