"use client";

import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { setCurrentPhase } from "@/actions/phases";

type Phase = {
  id: string;
  name: string;
  number: number;
  isCurrent: boolean;
};

export function PhaseSelector({
  phases,
  currentPhaseId,
}: {
  phases: Phase[];
  currentPhaseId: string | undefined;
}) {
  const router = useRouter();

  async function handleChange(phaseId: string | null) {
    if (!phaseId) return;
    await setCurrentPhase(phaseId);
    router.refresh();
  }

  return (
    <Select value={currentPhaseId || ""} onValueChange={handleChange}>
      <SelectTrigger className="w-[220px]">
        <SelectValue placeholder="Select phase" />
      </SelectTrigger>
      <SelectContent>
        {phases.map((phase) => (
          <SelectItem key={phase.id} value={phase.id}>
            {phase.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
