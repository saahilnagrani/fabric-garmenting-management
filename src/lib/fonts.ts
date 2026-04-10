// Single source of truth for user-selectable fonts.
//
// The CSS variable names here must match the ones declared in
// src/app/layout.tsx via next/font/google. The `value` is what we store in
// localStorage; the `cssVar` is what we write into the document root so every
// descendant inherits it via `--font-sans`.

export type FontChoice = {
  /** Persistence key stored in localStorage. */
  value: string;
  /** Human-friendly label shown in the picker. */
  label: string;
  /** CSS variable declared by next/font (without the var() wrapper). */
  cssVar: string;
  /** Short description of the font's character, shown as helper text. */
  description: string;
};

export const FONT_CHOICES: FontChoice[] = [
  {
    value: "inter",
    label: "Inter",
    cssVar: "--font-inter",
    description: "Tall x-height, designed for dense UI. Recommended default.",
  },
  {
    value: "roboto",
    label: "Roboto",
    cssVar: "--font-roboto",
    description: "Google's general-purpose sans, warm and familiar.",
  },
  {
    value: "open-sans",
    label: "Open Sans",
    cssVar: "--font-open-sans",
    description: "Humanist, highly legible at small sizes.",
  },
  {
    value: "lato",
    label: "Lato",
    cssVar: "--font-lato",
    description: "Balanced, slightly warm, good for long reading.",
  },
  {
    value: "poppins",
    label: "Poppins",
    cssVar: "--font-poppins",
    description: "Geometric, modern, slightly quirky at small sizes.",
  },
  {
    value: "source-sans-3",
    label: "Source Sans 3",
    cssVar: "--font-source-sans",
    description: "Adobe's open-source UI workhorse, very neutral.",
  },
  {
    value: "work-sans",
    label: "Work Sans",
    cssVar: "--font-work-sans",
    description: "Optimised for on-screen at medium sizes, slightly friendly.",
  },
  {
    value: "manrope",
    label: "Manrope",
    cssVar: "--font-manrope",
    description: "Modern geometric, good numerals, popular in dashboards.",
  },
  {
    value: "nunito",
    label: "Nunito",
    cssVar: "--font-nunito",
    description: "Rounded terminals, softer feel.",
  },
  {
    value: "dm-sans",
    label: "DM Sans",
    cssVar: "--font-dm-sans",
    description: "Low-contrast geometric, clean at every size.",
  },
  {
    value: "ibm-plex-sans",
    label: "IBM Plex Sans",
    cssVar: "--font-ibm-plex-sans",
    description: "Corporate, slightly mechanical, strong weights.",
  },
  {
    value: "montserrat",
    label: "Montserrat",
    cssVar: "--font-montserrat",
    description: "Display font, wider than most. Current default.",
  },
];

export const DEFAULT_FONT = "inter";

export function getFontChoice(value: string | null | undefined): FontChoice {
  return FONT_CHOICES.find((f) => f.value === value) ?? FONT_CHOICES[0];
}
