import { getPhases } from "@/actions/phases";
import { PhaseGrid } from "@/components/phases/phase-grid";

export default async function PhasesPage() {
  const phases = await getPhases();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Phases</h1>
      <p className="text-sm text-muted-foreground">
        {phases.length} phases
      </p>
      <PhaseGrid phases={phases} />
    </div>
  );
}
