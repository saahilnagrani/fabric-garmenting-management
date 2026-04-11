import { composeDisplayName } from "./accessory-categories";

/**
 * Resolve the display string for an accessory row. Prefers the stored
 * `displayName` column (new v2 schema); falls back to composing from
 * category + attributes (if the row was written through the new flow but
 * displayName hasn't been refreshed); falls back to the legacy
 * baseName/colour/size concatenation for any old row still in the wild.
 *
 * All three consumers (grid, sheet, BOM, dispatch note) go through this
 * helper so a single place owns the logic.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function accessoryDisplayName(row: any): string {
  if (row?.displayName && typeof row.displayName === "string" && row.displayName.trim()) {
    return row.displayName;
  }
  if (row?.category && row?.attributes && typeof row.attributes === "object") {
    return composeDisplayName(row.category, row.attributes as Record<string, unknown>);
  }
  return [row?.baseName, row?.colour, row?.size].filter(Boolean).join(" / ");
}
