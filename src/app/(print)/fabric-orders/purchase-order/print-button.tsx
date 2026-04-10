"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintButton() {
  return (
    <Button onClick={() => window.print()} size="sm">
      <Printer className="mr-1.5 h-3.5 w-3.5" />
      Print / Save as PDF
    </Button>
  );
}
