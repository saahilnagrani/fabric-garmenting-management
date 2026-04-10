/** Compose the display name for an accessory from its three identity columns. */
export function accessoryDisplayName(row: {
  baseName: string;
  colour: string | null;
  size: string | null;
}): string {
  return [row.baseName, row.colour, row.size].filter(Boolean).join(" / ");
}
