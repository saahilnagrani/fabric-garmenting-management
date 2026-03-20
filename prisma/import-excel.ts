import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as XLSX from "xlsx";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const EXCEL_PATH = "/Users/saahilnagrani/Documents/Projects/hyperballik/Phase 3 - Nov Mid 2026.xlsx";

// Map Excel vendor names to DB vendor names
const VENDOR_ALIASES: Record<string, string> = {
  "Global": "Global House",
  "Global & Pugazh": "Global House",
  "Mumtaz/Ultron": "Mumtaz",
  "Ultron/Mumtaz": "Ultron",
  "Pranera ": "Pranera",
  "Positex ": "Positex",
  "V print": "V Print",
};

// Additional vendors that need to be created
const EXTRA_VENDORS = [
  { name: "V Print", type: "OTHER" as const },
  { name: "KS Art & Craft", type: "ACCESSORIES" as const },
  { name: "MB Trading", type: "OTHER" as const },
  { name: "Niranjan & Co", type: "OTHER" as const },
];

const STATUS_MAP: Record<string, string> = {
  "Processing": "PROCESSING",
  "Sample with ST": "SAMPLE_WITH_ST",
  "Sample Ready": "SAMPLE_READY",
  "Ready at Garsem": "READY_AT_GARSEM",
  "Ready at Mumtaz": "READY_AT_MUMTAZ",
  "Received at Warehouse": "RECEIVED_AT_WAREHOUSE",
  "Shipped": "SHIPPED",
};

const SPEC_MAP: Record<string, string> = {
  "Fabric Vendor": "FABRIC_VENDOR",
  "Garmenting": "GARMENTING",
  "Brand Tag": "BRAND_TAG",
  "Accessories": "ACCESSORIES",
  "Shipping": "SHIPPING",
  "Packaging": "PACKAGING",
  "Other": "OTHER",
};

const FABRIC_STATUS_MAP: Record<string, string> = {
  "Fully Consumed": "FULLY_CONSUMED",
  "To Be Consumed": "TO_BE_CONSUMED",
  "Fully Inwarded": "FULLY_INWARDED",
  "Partially Inwarded": "PARTIALLY_INWARDED",
};

const GENDER_MAP: Record<string, string> = {
  "Mens": "MENS",
  "Womens": "WOMENS",
  "Women": "WOMENS",
  "Kids": "KIDS",
};

function s(val: unknown): string {
  if (val === null || val === undefined) return "";
  return String(val).trim();
}

function num(val: unknown): number | null {
  if (val === null || val === undefined || val === "") return null;
  const n = Number(val);
  return isNaN(n) ? null : n;
}

function int(val: unknown): number | null {
  const n = num(val);
  return n !== null ? Math.round(n) : null;
}

function excelDate(val: unknown): Date | null {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof val === "number") {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(val);
    return new Date(d.y, d.m - 1, d.d);
  }
  const d = new Date(String(val));
  return isNaN(d.getTime()) ? null : d;
}

async function main() {
  const wb = XLSX.readFile(EXCEL_PATH);

  // Ensure extra vendors exist
  for (const v of EXTRA_VENDORS) {
    await prisma.vendor.upsert({
      where: { name: v.name },
      update: {},
      create: v,
    });
  }

  // Load all vendors for lookup
  const allVendors = await prisma.vendor.findMany();
  const vendorMap = new Map<string, string>();
  for (const v of allVendors) {
    vendorMap.set(v.name.toLowerCase(), v.id);
  }

  function resolveVendorId(name: string | undefined): string | null {
    if (!name) return null;
    const trimmed = name.trim();
    const aliased = VENDOR_ALIASES[trimmed] || trimmed;
    return vendorMap.get(aliased.toLowerCase()) || null;
  }

  // Get Phase 3
  const phase = await prisma.phase.findUnique({ where: { number: 3 } });
  if (!phase) {
    console.error("Phase 3 not found. Run db:seed first.");
    process.exit(1);
  }

  // Clear existing data for Phase 3 to allow re-import
  await prisma.expense.deleteMany({ where: { phaseId: phase.id } });
  await prisma.fabricOrder.deleteMany({ where: { phaseId: phase.id } });
  await prisma.product.deleteMany({ where: { phaseId: phase.id } });
  console.log("Cleared existing Phase 3 data");

  // === Import New Designs ===
  const newDesigns = XLSX.utils.sheet_to_json(wb.Sheets["Phase 3 - New Designs"]);
  let newCount = 0;
  for (const row of newDesigns as Record<string, unknown>[]) {
    const fabricVendorId = resolveVendorId(s(row["Vendor"]));
    if (!fabricVendorId) { console.log("  Skip new design - no vendor:", s(row["Vendor"])); continue; }
    const styleNumber = s(row["Style Number"]);
    if (!styleNumber) continue;

    await prisma.product.create({
      data: {
        phaseId: phase.id,
        styleNumber,
        articleNumber: s(row["Article Number"]) || null,
        skuCode: s(row["SKU Code"]) || null,
        colourOrdered: s(row["Colour"]) || "Unknown",
        isRepeat: false,
        type: s(row["Type"]) || "Unknown",
        gender: (GENDER_MAP[s(row["Gender"])] || "MENS") as "MENS" | "WOMENS" | "KIDS",
        productName: s(row["Product  Name"]) || null,
        status: (STATUS_MAP[s(row["Status "])] || "PROCESSING") as "PROCESSING",
        fabricVendorId,
        fabricName: s(row["Fabric"]) || "Unknown",
        fabricGsm: num(row["GSM"]),
        fabricCostPerKg: num(row["Cost/Kg"]),
        assumedFabricGarmentsPerKg: num(row["No/Kg"]),
        fabric2Name: s(row["Second Fabric "]) || null,
        fabric2CostPerKg: null,
        assumedFabric2GarmentsPerKg: num(row["2nd Fabric No/Kg"]),
        fabricOrderedQuantityKg: num(row["Quantity Ordered"]),
        fabricShippedQuantityKg: num(row["Quantity Shipped "]),
        garmentNumber: int(row["Garment Number"]),
        actualStitchedXS: int(row["XS"]) || 0,
        actualStitchedS: int(row["S"]) || 0,
        actualStitchedM: int(row["M"]) || 0,
        actualStitchedL: int(row["L"]) || 0,
        actualStitchedXL: int(row["XL"]) || 0,
        actualStitchedXXL: int(row["XXL"]) || 0,
        stitchingCost: num(row["Stiching Cost"]),
        brandLogoCost: num(row["Brand Logo"]),
        neckTwillCost: num(row["Neck Twill"]),
        reflectorsCost: num(row["Reflectors"]),
        fusingCost: num(row["Fusing"]),
        accessoriesCost: num(row["Accessories"]),
        brandTagCost: num(row["Brand Tag Cost "]),
        sizeTagCost: num(row["Size Tag/hyperballik"]),
        packagingCost: num(row["Packaging"]),
        outwardShippingCost: num(row["Inward Shipping"]),
        proposedMrp: num(row["MRP"]),
      },
    });
    newCount++;
  }
  console.log(`Imported ${newCount} new designs`);

  // === Import Repeat Designs ===
  const repeatDesigns = XLSX.utils.sheet_to_json(wb.Sheets["Phase 3 - Repeat Designs"]);
  let repeatCount = 0;
  for (const row of repeatDesigns as Record<string, unknown>[]) {
    const fabricVendorId = resolveVendorId(s(row["Vendor"]));
    if (!fabricVendorId) { console.log("  Skip repeat - no vendor:", s(row["Vendor"])); continue; }

    const articleName = s(row["Article Name "]);
    const productName = s(row["Product Name "]);
    const type = s(row["Type"]);

    await prisma.product.create({
      data: {
        phaseId: phase.id,
        styleNumber: articleName || productName || "Unknown",
        articleNumber: row["Article Number"] ? s(row["Article Number"]) : null,
        skuCode: s(row["SKU Code"]) || null,
        colourOrdered: s(row["Colour 1"]) || "Unknown",
        isRepeat: true,
        type: type || "Unknown",
        gender: "MENS",
        productName: productName || null,
        status: "PROCESSING",
        fabricVendorId,
        fabricName: s(row["Fabric 1"]) || "Unknown",
        fabricGsm: null,
        fabricCostPerKg: null,
        assumedFabricGarmentsPerKg: num(row["No/Kg"]),
        fabric2Name: s(row["Fabric 2"]) || null,
        fabric2CostPerKg: null,
        assumedFabric2GarmentsPerKg: null,
        fabricOrderedQuantityKg: num(row["Fabric 1 Quantity"]),
        fabricShippedQuantityKg: null,
        garmentNumber: int(row["Number of Garment"]),
        actualStitchedXS: 0,
        actualStitchedS: int(row["S"]) || 0,
        actualStitchedM: int(row["M"]) || 0,
        actualStitchedL: int(row["L"]) || 0,
        actualStitchedXL: int(row["XL"]) || 0,
        actualStitchedXXL: int(row["XXL"]) || 0,
        stitchingCost: num(row["Stiching Cost"]),
        brandLogoCost: num(row["Brand Logo"]),
        neckTwillCost: num(row["Neck Twill"]),
        reflectorsCost: num(row["Reflectors"]),
        fusingCost: num(row["Fusing"]),
        accessoriesCost: num(row["Accessories"]),
        brandTagCost: num(row["Brand Tag Cost "]),
        sizeTagCost: num(row["Size Tag/hyperballik"]),
        packagingCost: num(row["Packaging"]),
        outwardShippingCost: num(row["Inward Shipping"]),
        proposedMrp: num(row["Proposed MRP"]),
        onlineMrp: num(row["Online MRP"]),
        garmentingAt: s(row["Garmenting At"]) || null,
      },
    });
    repeatCount++;
  }
  console.log(`Imported ${repeatCount} repeat designs`);

  // === Import Fabric Planning (New) ===
  const fabricNew = XLSX.utils.sheet_to_json(wb.Sheets["Phase 3 - Fabric Planning"]);
  let fabNewCount = 0;
  for (const row of fabricNew as Record<string, unknown>[]) {
    const fabricVendorId = resolveVendorId(s(row["Vendor"]));
    if (!fabricVendorId) { console.log("  Skip fabric new - no vendor:", s(row["Vendor"])); continue; }

    await prisma.fabricOrder.create({
      data: {
        phaseId: phase.id,
        fabricVendorId,
        gender: (GENDER_MAP[s(row["Gender"])] || null) as "MENS" | "WOMENS" | "KIDS" | null,
        invoiceNumber: s(row["Bill Number "]) || null,
        receivedAt: s(row["Fabric Received At"]) || null,
        styleNumbers: s(row["Style Number"]),
        fabricName: s(row["Name"]) || "Unknown",
        colour: s(row["Colour"]) || "Unknown",
        costPerUnit: num(row["MRP"]),
        fabricOrderedQuantityKg: num(row["Quantity"]),
        fabricShippedQuantityKg: num(row["Shipped Quantity"]),
        isRepeat: false,
      },
    });
    fabNewCount++;
  }
  console.log(`Imported ${fabNewCount} new fabric orders`);

  // === Import Fabric Planning (Repeat) ===
  const fabricRepeat = XLSX.utils.sheet_to_json(wb.Sheets["P3 - Fabric Planning for Repeat"]);
  let fabRepeatCount = 0;
  for (const row of fabricRepeat as Record<string, unknown>[]) {
    const fabricVendorId = resolveVendorId(s(row["Vendor "]) || s(row["Vendor"]));
    if (!fabricVendorId) { console.log("  Skip fabric repeat - no vendor:", s(row["Vendor "]) || s(row["Vendor"])); continue; }

    await prisma.fabricOrder.create({
      data: {
        phaseId: phase.id,
        fabricVendorId,
        gender: (GENDER_MAP[s(row["Gender"])] || null) as "MENS" | "WOMENS" | "KIDS" | null,
        invoiceNumber: s(row["Bill Number "]) || null,
        receivedAt: s(row["Fabric Received At"]) || null,
        styleNumbers: s(row["Style Number"]),
        fabricName: s(row["Fabric Name"]) || "Unknown",
        colour: s(row["Colour"]) || "Unknown",
        availableColour: s(row["Available Colour"]) || null,
        costPerUnit: num(row["MRP"]),
        fabricOrderedQuantityKg: num(row["Quantity"]),
        fabricShippedQuantityKg: num(row["Shipped Quantity"]),
        isRepeat: true,
      },
    });
    fabRepeatCount++;
  }
  console.log(`Imported ${fabRepeatCount} repeat fabric orders`);

  // === Import Expenses ===
  const expenses = XLSX.utils.sheet_to_json(wb.Sheets["Phase 3 - Expense Sheet"]);
  let expCount = 0;
  for (const row of expenses as Record<string, unknown>[]) {
    const spec = SPEC_MAP[s(row["Specification"])] || "OTHER";
    const vendorId = resolveVendorId(s(row["Vendor"]));
    const amount = num(row["Amount"]);
    if (amount === null) continue;

    await prisma.expense.create({
      data: {
        phaseId: phase.id,
        vendorId: vendorId,
        invoiceNumber: s(row["Invoice Number"]) || null,
        specification: spec as "FABRIC_VENDOR",
        date: excelDate(row["Date"]),
        description: s(row["Description"]) || null,
        quantity: s(row["Quantity"]) || null,
        amount,
        deliveredAt: s(row["Delivered At"]) || null,
        productNote: s(row["Product Note"]) || null,
        note: s(row["Note"]) || null,
        garmentBifurcation: s(row["Bifurcation of Garment Stiched"]) || null,
        totalGarments: int(row["Total Number of Garment "]),
        fabricStatus: (FABRIC_STATUS_MAP[s(row["Fabric Status"])] || null) as "FULLY_CONSUMED" | null,
      },
    });
    expCount++;
  }
  console.log(`Imported ${expCount} expenses`);

  console.log("\nImport complete!");
  console.log(`Total: ${newCount} new products, ${repeatCount} repeat products, ${fabNewCount + fabRepeatCount} fabric orders, ${expCount} expenses`);
}

main()
  .catch((e) => {
    console.error("Import failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
