"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import Script from "next/script";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { DEFAULT_FONT, FONT_CHOICES, getFontChoice } from "@/lib/fonts";

const FONT_STORAGE_KEY = "hb:font";

type AppearanceContextValue = {
  font: string;
  setFont: (value: string) => void;
};

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

/**
 * Wraps next-themes for dark mode plus our own tiny font-preference context.
 *
 * The font is persisted in localStorage under `hb:font` and applied by writing
 * `--font-sans` on <html> whenever it changes, so every descendant that reads
 * the CSS variable swaps instantly. A blocking inline <script> in
 * AppearanceScript reads the same key pre-hydration to avoid a flash of the
 * wrong font.
 */
export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const [font, setFontState] = useState<string>(DEFAULT_FONT);
  const [mounted, setMounted] = useState(false);

  // Load the persisted font on mount.
  useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem(FONT_STORAGE_KEY);
      if (stored && FONT_CHOICES.some((f) => f.value === stored)) {
        setFontState(stored);
      }
    } catch {
      // localStorage unavailable (SSR or privacy mode); fall back to default.
    }
  }, []);

  // Apply the font whenever it changes.
  useEffect(() => {
    if (!mounted) return;
    const choice = getFontChoice(font);
    const root = document.documentElement;
    root.style.setProperty("--font-sans", `var(${choice.cssVar})`);
  }, [font, mounted]);

  const setFont = useCallback((value: string) => {
    const choice = getFontChoice(value);
    setFontState(choice.value);
    try {
      localStorage.setItem(FONT_STORAGE_KEY, choice.value);
    } catch {
      // ignore
    }
  }, []);

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      // Explicit list so next-themes will set any of these as the class
      // on <html>. Each non-light theme has a matching palette block in
      // globals.css and is included in the `dark:` custom variant matcher
      // so Tailwind `dark:*` utilities still resolve under all three.
      themes={["light", "dark", "dim", "cool-dark"]}
    >
      <AppearanceContext.Provider value={{ font, setFont }}>
        <AppearanceScript />
        {children}
      </AppearanceContext.Provider>
    </NextThemesProvider>
  );
}

/**
 * Blocking pre-hydration script that reads the persisted font choice from
 * localStorage and writes the CSS variable before the first paint. Without
 * this, the page paints with the default font and then flashes to the user's
 * choice after React mounts.
 */
function AppearanceScript() {
  const script = `
(function(){
  try {
    var f = localStorage.getItem(${JSON.stringify(FONT_STORAGE_KEY)});
    var map = ${JSON.stringify(
      Object.fromEntries(FONT_CHOICES.map((c) => [c.value, c.cssVar]))
    )};
    var cssVar = map[f] || map[${JSON.stringify(DEFAULT_FONT)}];
    if (cssVar) document.documentElement.style.setProperty('--font-sans', 'var(' + cssVar + ')');
  } catch (e) {}
})();
`;
  return <Script id="appearance-font-init" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: script }} />;
}

export function useAppearance() {
  const ctx = useContext(AppearanceContext);
  if (!ctx) throw new Error("useAppearance must be used within AppearanceProvider");
  return ctx;
}
