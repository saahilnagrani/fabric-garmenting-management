"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { setCurrentPhase } from "@/actions/phases";

type Phase = {
  id: string;
  name: string;
  number: number;
  isCurrent: boolean;
};

/**
 * Custom event dispatched after any call to setCurrentPhase() anywhere
 * in the app, so the PhaseSelector can update immediately without
 * waiting for a layout re-render (which Next.js App Router doesn't
 * guarantee for cached Server Component layouts).
 */
export const PHASE_CHANGED_EVENT = "hyperballik:phase-changed";

export function dispatchPhaseChanged(phaseId: string) {
  window.dispatchEvent(new CustomEvent(PHASE_CHANGED_EVENT, { detail: { phaseId } }));
}

export function PhaseSelector({
  phases,
  currentPhaseId,
}: {
  phases: Phase[];
  currentPhaseId: string | undefined;
}) {
  const router = useRouter();
  const [activeId, setActiveId] = useState(currentPhaseId);

  // Sync from server prop.
  useEffect(() => {
    setActiveId(currentPhaseId);
  }, [currentPhaseId]);

  // Listen for phase-changed events from anywhere in the app (e.g. the
  // /phases page "Set Current" button).
  useEffect(() => {
    function onPhaseChanged(e: Event) {
      const id = (e as CustomEvent).detail?.phaseId;
      if (id) setActiveId(id);
    }
    window.addEventListener(PHASE_CHANGED_EVENT, onPhaseChanged);
    return () => window.removeEventListener(PHASE_CHANGED_EVENT, onPhaseChanged);
  }, []);

  async function handleChange(phaseId: string | null) {
    if (!phaseId) return;
    setActiveId(phaseId); // optimistic update
    await setCurrentPhase(phaseId);
    dispatchPhaseChanged(phaseId);
    router.refresh();
  }

  const selectedPhase = phases.find((p) => p.id === activeId);

  return (
    <Select value={activeId || ""} onValueChange={handleChange}>
      <SelectTrigger className="w-auto min-w-[180px] max-w-[320px]">
        <span className="truncate">{selectedPhase ? `Phase ${selectedPhase.number} - ${selectedPhase.name}` : "Select phase"}</span>
      </SelectTrigger>
      <SelectContent>
        {phases.map((phase) => (
          <SelectItem key={phase.id} value={phase.id}>
            Phase {phase.number} - {phase.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
