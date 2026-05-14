/**
 * Size keys are stored canonically as XS/S/M/L/XL/XXL across the schema
 * (Product.actualInward*, BOM.applicableSizes, etc). For kids articles, the
 * physical size label shown to operators and customers is age-banded
 * (6-7Y, 8-9Y, ...). This helper does the display-only translation; storage
 * stays unchanged.
 */
export type SizeKey = "XS" | "S" | "M" | "L" | "XL" | "XXL";

export const KIDS_SIZE_LABELS: Record<SizeKey, string> = {
  XS: "XS",
  S: "6-7Y",
  M: "8-9Y",
  L: "10-11Y",
  XL: "12-13Y",
  XXL: "14-15Y",
};

export function sizeLabelForGender(
  gender: string | null | undefined,
  sizeKey: string,
): string {
  if (gender === "KIDS" && sizeKey in KIDS_SIZE_LABELS) {
    return KIDS_SIZE_LABELS[sizeKey as SizeKey];
  }
  return sizeKey;
}

export function isKidsGender(gender: string | null | undefined): boolean {
  return gender === "KIDS";
}
