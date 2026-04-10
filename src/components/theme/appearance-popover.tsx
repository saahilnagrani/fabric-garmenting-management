"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Palette, Sun, Moon } from "lucide-react";
import { AppearanceControls } from "./appearance-controls";

/**
 * Compact popover trigger for the top bar: renders a palette/sun/moon icon
 * depending on the resolved theme, opens a dropdown with the full appearance
 * controls (theme toggle + font picker). Sits next to the user menu.
 */
export function AppearancePopover() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Render a stable placeholder icon until mounted so SSR and client render
  // the same thing. Palette is theme-neutral.
  const Icon = !mounted ? Palette : resolvedTheme === "dark" ? Moon : Sun;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            aria-label="Appearance settings"
          />
        }
      >
        <Icon className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 p-2">
        <AppearanceControls variant="inline" />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
