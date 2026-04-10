import { notFound } from "next/navigation";
import { FEATURES } from "@/lib/feature-flags";
import { getCurrentPhase, getPhases } from "@/actions/phases";
import { getAccessoryBalances } from "@/actions/accessory-balance";
import { AccessoryBalanceGrid } from "@/components/accessories/accessory-balance-grid";

export default async function AccessoryBalancePage({
  searchParams,
}: {
  searchParams: Promise<{ phaseId?: string }>;
}) {
  if (!FEATURES.accessories) notFound();

  const params = await searchParams;
  const allPhases = await getPhases();

  let phaseId = params.phaseId;
  if (!phaseId) {
    const current = await getCurrentPhase();
    phaseId = current?.id || allPhases[0]?.id;
  }
  if (!phaseId) {
    return <p className="text-muted-foreground">No phases configured.</p>;
  }

  const rows = await getAccessoryBalances(phaseId);
  const selectedPhase = allPhases.find((p) => p.id === phaseId);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Accessory Balance</h1>
        <p className="text-sm text-muted-foreground">
          Opening / purchased / dispatched / closing balance per accessory
          {selectedPhase ? ` for Phase ${selectedPhase.number} — ${selectedPhase.name}` : ""}.
          Closing balance of one phase carries into the next phase&apos;s opening.
        </p>
      </div>
      <AccessoryBalanceGrid
        rows={rows}
        phases={allPhases.map((p) => ({ id: p.id, name: p.name, number: p.number }))}
        selectedPhaseId={phaseId}
      />
    </div>
  );
}
