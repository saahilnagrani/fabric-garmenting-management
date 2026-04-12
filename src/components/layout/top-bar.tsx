"use client";

import { useState } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { UserMenu } from "@/components/layout/user-menu";
import { AppearancePopover } from "@/components/theme/appearance-popover";
import { AlertBell } from "@/components/layout/alert-bell";
import { PhaseSelector } from "./phase-selector";
import type { DashboardAlert } from "@/actions/dashboard";

type Phase = {
  id: string;
  name: string;
  number: number;
  isCurrent: boolean;
};

export function TopBar({
  phases: initialPhases,
  userName,
  alerts = [],
}: {
  phases: Phase[];
  userName?: string | null;
  alerts?: DashboardAlert[];
}) {
  const [phases] = useState(initialPhases);
  const currentPhase = phases.find((p) => p.isCurrent);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <PhaseSelector
        phases={phases}
        currentPhaseId={currentPhase?.id}
      />
      <div className="ml-auto flex items-center gap-1">
        <AlertBell alerts={alerts} />
        <AppearancePopover />
        <UserMenu userName={userName} />
      </div>
    </header>
  );
}
