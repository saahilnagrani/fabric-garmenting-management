// Per-category attribute schema for AccessoryMaster.
//
// Adding a new category = add an entry to CATEGORIES and redeploy. The shape
// is validated client-side in the master sheet; the DB stores attributes as a
// free-form JSONB column so nothing needs to migrate when fields are added.
//
// Each category has a list of fields that appear in the sheet when the
// category is selected, and a `displayFields` array used by `composeDisplayName`
// to build the canonical "Reflector · 4 inch · 6m" label.

export type AttributeFieldType = "text" | "number" | "select";

export type AttributeField = {
  key: string;
  label: string;
  type: AttributeFieldType;
  // For select fields, the list of choices the user can pick.
  options?: string[];
  // Unit suffix appended after the value in display text ("mm", "inch", "m").
  unit?: string;
  // Helper text under the input.
  helper?: string;
  // Whether the field is required on save.
  required?: boolean;
};

export type CategoryConfig = {
  value: string;           // stored in AccessoryMaster.category
  label: string;           // human-facing
  fields: AttributeField[];
  // Fields (or composed segments) to show in the display name, in order. The
  // final display name is `<label> · <segment1> · <segment2> ...`, skipping
  // any segment that's empty.
  displayFields: string[]; // subset of fields[].key
  // Optional hint shown in the sheet header for new records of this category.
  description?: string;
};

export const CATEGORIES: CategoryConfig[] = [
  {
    value: "REFLECTOR",
    label: "Reflector",
    description:
      "Reflective tapes, dots, arrows, and patches used on tops and shorts. Variants are discriminated by design ref, width, length, shape and finish.",
    fields: [
      { key: "designRef",   label: "Design ref",  type: "text",
        helper: "Vendor's catalog item number, e.g. #4 or 2/12" },
      { key: "variant",     label: "Variant",     type: "text",
        helper: "Free text for non-standard variants (Logo, Moving, etc.)" },
      { key: "widthInches", label: "Width",       type: "number", unit: "inch" },
      { key: "widthMm",     label: "Width",       type: "number", unit: "mm" },
      { key: "lengthM",     label: "Length",      type: "number", unit: "m" },
      { key: "thicknessMm", label: "Thickness",   type: "number", unit: "mm" },
      { key: "shape",       label: "Shape",       type: "select",
        options: ["Strip", "Round dot", "Cross", "Box Dot", "Dot Arrow", "Football", "Logo"] },
      { key: "finish",      label: "Finish",      type: "select",
        options: ["Standard", "DTF", "Neon", "Chrome"] },
    ],
    displayFields: ["variant", "designRef", "shape", "widthInches", "widthMm", "lengthM", "thicknessMm", "finish"],
  },
  {
    value: "BUTTON",
    label: "Button",
    fields: [
      { key: "baseName", label: "Type",   type: "text",
        helper: "e.g. YKK #5, Snap, Metal shank" },
      { key: "size",     label: "Size",   type: "text",
        helper: "e.g. 24L, 18mm" },
      { key: "colour",   label: "Colour", type: "text" },
    ],
    displayFields: ["baseName", "colour", "size"],
  },
  {
    value: "ZIPPER",
    label: "Zipper",
    fields: [
      { key: "baseName", label: "Type",   type: "text",
        helper: "e.g. YKK #5, Nylon coil, Metal" },
      { key: "size",     label: "Length", type: "text",
        helper: "e.g. 15cm, 20cm" },
      { key: "colour",   label: "Colour", type: "text" },
    ],
    displayFields: ["baseName", "colour", "size"],
  },
  {
    value: "LABEL",
    label: "Label",
    fields: [
      { key: "baseName",    label: "Type",       type: "select",
        options: ["Brand", "Size", "Wash Care", "Content", "Composite"] },
      { key: "variant",     label: "Description", type: "text",
        helper: "e.g. sewn-in, heat-press, woven" },
    ],
    displayFields: ["baseName", "variant"],
  },
  {
    value: "TAPE",
    label: "Tape / Binding",
    fields: [
      { key: "baseName", label: "Type",   type: "text",
        helper: "e.g. twill tape, elastic binding" },
      { key: "widthMm",  label: "Width",  type: "number", unit: "mm" },
      { key: "colour",   label: "Colour", type: "text" },
    ],
    displayFields: ["baseName", "widthMm", "colour"],
  },
  {
    value: "DRAWCORD",
    label: "Drawcord",
    fields: [
      { key: "baseName", label: "Type",   type: "text" },
      { key: "widthMm",  label: "Diameter", type: "number", unit: "mm" },
      { key: "colour",   label: "Colour", type: "text" },
    ],
    displayFields: ["baseName", "widthMm", "colour"],
  },
  {
    value: "ELASTIC",
    label: "Elastic",
    fields: [
      { key: "baseName", label: "Type",   type: "text" },
      { key: "widthMm",  label: "Width",  type: "number", unit: "mm" },
      { key: "colour",   label: "Colour", type: "text" },
    ],
    displayFields: ["baseName", "widthMm", "colour"],
  },
  {
    value: "PACKAGING",
    label: "Packaging",
    fields: [
      { key: "baseName", label: "Item",   type: "text",
        helper: "e.g. poly bag, carton, hang tag, size sticker" },
      { key: "size",     label: "Size",   type: "text" },
    ],
    displayFields: ["baseName", "size"],
  },
  {
    value: "OTHER",
    label: "Other",
    fields: [
      { key: "baseName", label: "Name", type: "text", required: true },
      { key: "variant",  label: "Variant", type: "text" },
    ],
    displayFields: ["baseName", "variant"],
  },
];

export function getCategoryConfig(value: string | null | undefined): CategoryConfig | null {
  if (!value) return null;
  return CATEGORIES.find((c) => c.value === value) ?? null;
}

export function getCategoryLabel(value: string | null | undefined): string {
  return getCategoryConfig(value)?.label ?? value ?? "";
}

/**
 * Build the canonical display name for an accessory master from its category
 * config and attributes JSON. The result is used in grids, BOMs, dispatch
 * notes, and anywhere else the accessory is referenced by name.
 *
 * Format: `<CategoryLabel> · <segment1> · <segment2> ...`
 * Segments come from the category's displayFields in order, skipping any
 * that are empty. Numeric segments append their field's unit.
 */
export function composeDisplayName(
  category: string,
  attributes: Record<string, unknown>,
): string {
  const cfg = getCategoryConfig(category);
  if (!cfg) {
    // Fallback: join all non-empty attribute values.
    const vals = Object.values(attributes)
      .filter((v) => v != null && v !== "")
      .map(String);
    return vals.length > 0 ? vals.join(" · ") : category || "Accessory";
  }

  const segments: string[] = [];
  for (const fieldKey of cfg.displayFields) {
    const field = cfg.fields.find((f) => f.key === fieldKey);
    const raw = attributes[fieldKey];
    if (raw == null || raw === "") continue;
    const str = String(raw);
    if (field?.unit && field.type === "number") {
      segments.push(`${str} ${field.unit}`);
    } else {
      segments.push(str);
    }
  }

  return segments.length > 0 ? `${cfg.label} · ${segments.join(" · ")}` : cfg.label;
}

export type PriceTier = { minQty: number; maxQty?: number; rate: number };

/**
 * Resolve the rate for a given order quantity from a priceTiers array.
 * Returns null if no tier matches and the caller should fall back to
 * AccessoryMaster.defaultCostPerUnit.
 */
export function resolveTierRate(
  priceTiers: PriceTier[] | null | undefined,
  qty: number,
): number | null {
  if (!priceTiers || priceTiers.length === 0) return null;
  const match = priceTiers.find((t) => {
    if (qty < t.minQty) return false;
    if (t.maxQty != null && qty > t.maxQty) return false;
    return true;
  });
  return match ? Number(match.rate) : null;
}
