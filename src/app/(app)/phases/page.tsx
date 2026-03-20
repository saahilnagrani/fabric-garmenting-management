import { getPhases } from "@/actions/phases";
import { PhaseList } from "@/components/phases/phase-list";

export default async function PhasesPage() {
  const phases = await getPhases();

  return (
    <div className="space-y-4 max-w-2xl">
      <h1 className="text-2xl font-bold">Phases</h1>
      <p className="text-sm text-muted-foreground">
        {phases.length} phases
      </p>
      <PhaseList phases={JSON.parse(JSON.stringify(phases))} />
    </div>
  );
}
