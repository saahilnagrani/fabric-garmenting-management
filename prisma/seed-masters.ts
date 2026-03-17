import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as XLSX from "xlsx";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const EXCEL_PATH = "/Users/saahilnagrani/Documents/Projects/hyperballik/Phase 3 - Nov Mid 2026.xlsx";

const VENDOR_ALIASES: Record<string, string> = {
  "Global": "Global House",
  "Global & Pugazh": "Global House",
  "Mumtaz/Ultron": "Mumtaz",
  "Ultron/Mumtaz": "Ultron",
  "Pranera ": "Pranera",
  "Positex ": "Positex",
  "V print": "V Print",
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

async function main() {
  const wb = XLSX.readFile(EXCEL_PATH);

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

  // === Seed Fabric Masters ===
  // Collect unique fabrics from both fabric planning sheets
  const fabricMap = new Map<string, {
    fabricName: string;
    vendorId: string;
    genders: Set<string>;
    styleNumbers: Set<string>;
    colours: Set<string>;
    mrps: number[];
  }>();

  function processFabricRow(row: Record<string, unknown>, fabricNameKey: string, isRepeat: boolean) {
    const fabricName = s(row[fabricNameKey]);
    if (!fabricName || fabricName === "Unknown") return;

    const vendorKey = isRepeat ? (s(row["Vendor "]) || s(row["Vendor"])) : s(row["Vendor"]);
    const vendorId = resolveVendorId(vendorKey);
    if (!vendorId) return;

    const key = fabricName.toLowerCase();
    if (!fabricMap.has(key)) {
      fabricMap.set(key, {
        fabricName,
        vendorId,
        genders: new Set(),
        styleNumbers: new Set(),
        colours: new Set(),
        mrps: [],
      });
    }

    const entry = fabricMap.get(key)!;
    const gender = GENDER_MAP[s(row["Gender"])];
    if (gender) entry.genders.add(gender);

    const styleNum = s(row["Style Number"]);
    if (styleNum) {
      // Style numbers can be comma-separated
      styleNum.split(",").forEach((sn) => {
        const trimmed = sn.trim();
        if (trimmed) entry.styleNumbers.add(trimmed);
      });
    }

    const colour = s(row["Colour"]);
    if (colour) entry.colours.add(colour);
    if (isRepeat) {
      const availColour = s(row["Available Colour"]);
      if (availColour) entry.colours.add(availColour);
    }

    const mrp = num(row["MRP"]);
    if (mrp !== null) entry.mrps.push(mrp);
  }

  // New fabric planning
  const fabricNew = XLSX.utils.sheet_to_json(wb.Sheets["Phase 3 - Fabric Planning"]);
  for (const row of fabricNew as Record<string, unknown>[]) {
    processFabricRow(row, "Name", false);
  }

  // Repeat fabric planning
  const fabricRepeat = XLSX.utils.sheet_to_json(wb.Sheets["P3 - Fabric Planning for Repeat"]);
  for (const row of fabricRepeat as Record<string, unknown>[]) {
    processFabricRow(row, "Fabric Name", true);
  }

  // Upsert fabric masters
  let fabCount = 0;
  for (const entry of fabricMap.values()) {
    const avgMrp = entry.mrps.length > 0
      ? entry.mrps.reduce((a, b) => a + b, 0) / entry.mrps.length
      : null;

    await prisma.fabricMaster.upsert({
      where: { fabricName: entry.fabricName },
      update: {
        vendorId: entry.vendorId,
        genders: Array.from(entry.genders),
        styleNumbers: Array.from(entry.styleNumbers),
        coloursAvailable: Array.from(entry.colours),
        mrp: avgMrp,
      },
      create: {
        fabricName: entry.fabricName,
        vendorId: entry.vendorId,
        genders: Array.from(entry.genders),
        styleNumbers: Array.from(entry.styleNumbers),
        coloursAvailable: Array.from(entry.colours),
        mrp: avgMrp,
      },
    });
    fabCount++;
  }
  console.log(`Seeded ${fabCount} fabric masters`);

  // === Seed Product Masters ===
  const productMap = new Map<string, {
    styleNumber: string;
    skuCode: string | null;
    fabricName: string;
    type: string;
    gender: string;
    productName: string | null;
    coloursAvailable: Set<string>;
    colours2Available: Set<string>;
    garmentsPerKg: number | null;
    garmentsPerKg2: number | null;
    stitchingCost: number | null;
    brandLogoCost: number | null;
    neckTwillCost: number | null;
    reflectorsCost: number | null;
    fusingCost: number | null;
    accessoriesCost: number | null;
    brandTagCost: number | null;
    sizeTagCost: number | null;
    packagingCost: number | null;
    fabricCostPerKg: number | null;
    fabric2CostPerKg: number | null;
    inwardShipping: number | null;
    proposedMrp: number | null;
    onlineMrp: number | null;
  }>();

  // New designs
  const newDesigns = XLSX.utils.sheet_to_json(wb.Sheets["Phase 3 - New Designs"]);
  for (const row of newDesigns as Record<string, unknown>[]) {
    const styleNumber = s(row["Style Number"]);
    if (!styleNumber) continue;

    const key = styleNumber.toLowerCase();
    if (!productMap.has(key)) {
      productMap.set(key, {
        styleNumber,
        skuCode: s(row["SKU Code"]) || null,
        fabricName: s(row["Fabric"]) || "Unknown",
        type: s(row["Type"]) || "Unknown",
        gender: GENDER_MAP[s(row["Gender"])] || "MENS",
        productName: s(row["Product  Name"]) || null,
        coloursAvailable: new Set(),
        colours2Available: new Set(),
        garmentsPerKg: num(row["No/Kg"]),
        garmentsPerKg2: num(row["2nd Fabric No/Kg"]),
        stitchingCost: num(row["Stiching Cost"]),
        brandLogoCost: num(row["Brand Logo"]),
        neckTwillCost: num(row["Neck Twill"]),
        reflectorsCost: num(row["Reflectors"]),
        fusingCost: num(row["Fusing"]),
        accessoriesCost: num(row["Accessories"]),
        brandTagCost: num(row["Brand Tag Cost "]),
        sizeTagCost: num(row["Size Tag/hyperballik"]),
        packagingCost: num(row["Packaging"]),
        fabricCostPerKg: num(row["Cost/Kg"]),
        fabric2CostPerKg: null,
        inwardShipping: num(row["Inward Shipping"]),
        proposedMrp: null,
        onlineMrp: null,
      });
    }

    const entry = productMap.get(key)!;
    const colour = s(row["Colour"]);
    if (colour) entry.coloursAvailable.add(colour);
  }

  // Repeat designs
  const repeatDesigns = XLSX.utils.sheet_to_json(wb.Sheets["Phase 3 - Repeat Designs"]);
  for (const row of repeatDesigns as Record<string, unknown>[]) {
    const articleName = s(row["Article Name "]);
    const productName = s(row["Product Name "]);
    const styleNumber = articleName || productName;
    if (!styleNumber || styleNumber === "Unknown") continue;

    const key = styleNumber.toLowerCase();
    if (!productMap.has(key)) {
      productMap.set(key, {
        styleNumber,
        skuCode: s(row["SKU Code"]) || null,
        fabricName: s(row["Fabric 1"]) || "Unknown",
        type: s(row["Type"]) || "Unknown",
        gender: "MENS",
        productName: productName || null,
        coloursAvailable: new Set(),
        colours2Available: new Set(),
        garmentsPerKg: num(row["No/Kg"]),
        garmentsPerKg2: null,
        stitchingCost: num(row["Stiching Cost"]),
        brandLogoCost: num(row["Brand Logo"]),
        neckTwillCost: num(row["Neck Twill"]),
        reflectorsCost: num(row["Reflectors"]),
        fusingCost: num(row["Fusing"]),
        accessoriesCost: num(row["Accessories"]),
        brandTagCost: num(row["Brand Tag Cost "]),
        sizeTagCost: num(row["Size Tag/hyperballik"]),
        packagingCost: num(row["Packaging"]),
        fabricCostPerKg: null,
        fabric2CostPerKg: null,
        inwardShipping: num(row["Inward Shipping"]),
        proposedMrp: num(row["Proposed MRP"]),
        onlineMrp: num(row["Online MRP"]),
      });
    }

    const entry = productMap.get(key)!;
    const colour1 = s(row["Colour 1"]);
    if (colour1) entry.coloursAvailable.add(colour1);
  }

  // Upsert product masters
  let prodCount = 0;
  for (const entry of productMap.values()) {
    await prisma.productMaster.upsert({
      where: { styleNumber: entry.styleNumber },
      update: {
        fabricName: entry.fabricName,
        type: entry.type,
        gender: entry.gender as "MENS" | "WOMENS" | "KIDS",
        productName: entry.productName,
        coloursAvailable: Array.from(entry.coloursAvailable),
        colours2Available: Array.from(entry.colours2Available),
        garmentsPerKg: entry.garmentsPerKg,
        garmentsPerKg2: entry.garmentsPerKg2,
        stitchingCost: entry.stitchingCost,
        brandLogoCost: entry.brandLogoCost,
        neckTwillCost: entry.neckTwillCost,
        reflectorsCost: entry.reflectorsCost,
        fusingCost: entry.fusingCost,
        accessoriesCost: entry.accessoriesCost,
        brandTagCost: entry.brandTagCost,
        sizeTagCost: entry.sizeTagCost,
        packagingCost: entry.packagingCost,
        fabricCostPerKg: entry.fabricCostPerKg,
        fabric2CostPerKg: entry.fabric2CostPerKg,
        inwardShipping: entry.inwardShipping,
        proposedMrp: entry.proposedMrp,
        onlineMrp: entry.onlineMrp,
      },
      create: {
        styleNumber: entry.styleNumber,
        skuCode: entry.skuCode,
        fabricName: entry.fabricName,
        type: entry.type,
        gender: entry.gender as "MENS" | "WOMENS" | "KIDS",
        productName: entry.productName,
        coloursAvailable: Array.from(entry.coloursAvailable),
        colours2Available: Array.from(entry.colours2Available),
        garmentsPerKg: entry.garmentsPerKg,
        garmentsPerKg2: entry.garmentsPerKg2,
        stitchingCost: entry.stitchingCost,
        brandLogoCost: entry.brandLogoCost,
        neckTwillCost: entry.neckTwillCost,
        reflectorsCost: entry.reflectorsCost,
        fusingCost: entry.fusingCost,
        accessoriesCost: entry.accessoriesCost,
        brandTagCost: entry.brandTagCost,
        sizeTagCost: entry.sizeTagCost,
        packagingCost: entry.packagingCost,
        fabricCostPerKg: entry.fabricCostPerKg,
        fabric2CostPerKg: entry.fabric2CostPerKg,
        inwardShipping: entry.inwardShipping,
        proposedMrp: entry.proposedMrp,
        onlineMrp: entry.onlineMrp,
      },
    });
    prodCount++;
  }
  console.log(`Seeded ${prodCount} product masters`);

  console.log("\nMaster seed complete!");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
