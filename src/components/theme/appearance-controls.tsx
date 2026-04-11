"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun, Check, Contrast, Droplet } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { FONT_CHOICES, getFontChoice } from "@/lib/fonts";
import { useAppearance } from "./appearance-provider";
import { cn } from "@/lib/utils";

type Mode = "light" | "dark" | "dim" | "cool-dark" | "system";

const DARK_VARIANTS: ReadonlyArray<Mode> = ["dark", "dim", "cool-dark"];

/**
 * Shared appearance controls: theme toggle (system/light/dark) plus a font
 * picker. Used in both the full preferences page and the compact avatar
 * popover so both stay in lockstep.
 *
 * `variant` controls layout density:
 *  - "inline"  : horizontal buttons, narrow (popover)
 *  - "full"    : vertical list with descriptions (preferences page)
 */
export function AppearanceControls({ variant = "inline" }: { variant?: "inline" | "full" }) {
  const { theme, setTheme } = useTheme();
  const { font, setFont } = useAppearance();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Until mounted, render a placeholder so the initial HTML is consistent
  // with the client render (theme is only known after hydration).
  const currentTheme: Mode = mounted ? ((theme as Mode) || "system") : "system";
  const isDarkFamily = DARK_VARIANTS.includes(currentTheme);

  // Primary theme options — the top-level choice the user makes.
  // Selecting "Dark" applies whichever dark variant is currently active
  // (defaults to plain "dark").
  const themeOptions: Array<{ value: Mode; label: string; icon: typeof Sun }> = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
  ];

  // Dark-family variant options — only shown when a dark variant is active.
  const darkVariantOptions: Array<{
    value: Mode;
    label: string;
    description: string;
    icon: typeof Moon;
  }> = [
    {
      value: "dark",
      label: "Classic",
      description: "Neutral grey, highest contrast.",
      icon: Moon,
    },
    {
      value: "dim",
      label: "Dim",
      description: "Softer middle grey, reduced contrast — easier for long sessions.",
      icon: Contrast,
    },
    {
      value: "cool-dark",
      label: "Cool",
      description: "Blue-tinted charcoal, IDE-inspired.",
      icon: Droplet,
    },
  ];

  if (variant === "full") {
    return (
      <div className="space-y-6">
        <section>
          <h3 className="text-sm font-semibold mb-2">Theme</h3>
          <p className="text-xs text-muted-foreground mb-3">
            Choose light, dark, or follow your operating system.
          </p>
          <div className="grid grid-cols-3 gap-2 max-w-md">
            {themeOptions.map((opt) => {
              const Icon = opt.icon;
              // "Dark" button lights up for any dark-family variant so the
              // top-level selection stays stable when a user picks a subvariant.
              const active =
                opt.value === "dark"
                  ? isDarkFamily
                  : currentTheme === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    // When re-selecting "Dark", preserve the user's current
                    // dark variant if they already had one; otherwise default
                    // to plain "dark".
                    if (opt.value === "dark" && isDarkFamily) return;
                    setTheme(opt.value);
                  }}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-lg border-2 p-3 text-xs transition-colors",
                    active
                      ? "border-primary bg-accent/10"
                      : "border-border hover:border-muted-foreground/50"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span className="font-medium">{opt.label}</span>
                  {active && <Check className="h-3 w-3 text-primary" />}
                </button>
              );
            })}
          </div>
        </section>

        {isDarkFamily && (
          <section>
            <h3 className="text-sm font-semibold mb-2">Dark variant</h3>
            <p className="text-xs text-muted-foreground mb-3">
              Pick a flavour of dark mode. All variants keep the terracotta accent.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 max-w-2xl">
              {darkVariantOptions.map((opt) => {
                const Icon = opt.icon;
                const active = currentTheme === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setTheme(opt.value)}
                    className={cn(
                      "flex flex-col items-start gap-1.5 rounded-lg border-2 p-3 text-left transition-colors",
                      active
                        ? "border-primary bg-accent/10"
                        : "border-border hover:border-muted-foreground/50"
                    )}
                  >
                    <div className="flex items-center gap-1.5">
                      <Icon className="h-4 w-4" />
                      <span className="text-sm font-medium">{opt.label}</span>
                      {active && <Check className="h-3 w-3 text-primary ml-auto" />}
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-snug">
                      {opt.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        <section>
          <h3 className="text-sm font-semibold mb-2">Font</h3>
          <p className="text-xs text-muted-foreground mb-3">
            Applies to all text across the app. Preview shows immediately.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-2xl">
            {FONT_CHOICES.map((choice) => {
              const active = font === choice.value;
              return (
                <button
                  key={choice.value}
                  type="button"
                  onClick={() => setFont(choice.value)}
                  className={cn(
                    "flex items-start justify-between gap-3 rounded-lg border-2 px-3 py-2 text-left transition-colors",
                    active
                      ? "border-primary bg-accent/10"
                      : "border-border hover:border-muted-foreground/50"
                  )}
                  style={{ fontFamily: `var(${choice.cssVar}), ui-sans-serif, system-ui, sans-serif` }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium flex items-center gap-1.5">
                      {choice.label}
                      {active && <Check className="h-3 w-3 text-primary" />}
                    </div>
                    <div className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                      {choice.description}
                    </div>
                    <div className="text-[11px] text-muted-foreground/70 mt-1">
                      The quick brown fox jumps over the lazy dog 0123456789
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    );
  }

  // Inline (popover) variant
  return (
    <div className="space-y-3 p-1">
      <div>
        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Theme</Label>
        <div className="mt-1 grid grid-cols-3 gap-1">
          {themeOptions.map((opt) => {
            const Icon = opt.icon;
            const active =
              opt.value === "dark"
                ? isDarkFamily
                : currentTheme === opt.value;
            return (
              <Button
                key={opt.value}
                variant={active ? "default" : "outline"}
                size="sm"
                className="h-8 text-[11px]"
                onClick={() => {
                  if (opt.value === "dark" && isDarkFamily) return;
                  setTheme(opt.value);
                }}
              >
                <Icon className="h-3 w-3 mr-1" />
                {opt.label}
              </Button>
            );
          })}
        </div>
      </div>

      {isDarkFamily && (
        <div>
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Dark variant
          </Label>
          <div className="mt-1 grid grid-cols-3 gap-1">
            {darkVariantOptions.map((opt) => {
              const Icon = opt.icon;
              const active = currentTheme === opt.value;
              return (
                <Button
                  key={opt.value}
                  variant={active ? "default" : "outline"}
                  size="sm"
                  className="h-8 text-[11px] px-1.5"
                  onClick={() => setTheme(opt.value)}
                  title={opt.description}
                >
                  <Icon className="h-3 w-3 mr-1" />
                  {opt.label}
                </Button>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Font</Label>
        <div className="mt-1 max-h-48 overflow-y-auto rounded border border-border">
          {FONT_CHOICES.map((choice) => {
            const active = font === choice.value;
            return (
              <button
                key={choice.value}
                type="button"
                onClick={() => setFont(choice.value)}
                className={cn(
                  "w-full flex items-center justify-between gap-2 px-2 py-1.5 text-xs text-left border-b border-border last:border-b-0 transition-colors",
                  active ? "bg-accent/20 font-semibold" : "hover:bg-muted"
                )}
                style={{ fontFamily: `var(${choice.cssVar}), ui-sans-serif, system-ui, sans-serif` }}
              >
                <span>{choice.label}</span>
                {active && <Check className="h-3 w-3 text-primary" />}
              </button>
            );
          })}
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">
          Currently: {getFontChoice(font).label}
        </p>
      </div>
    </div>
  );
}
