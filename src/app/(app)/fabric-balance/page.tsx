import { getFabricBalances } from "@/actions/fabric-balance";
import { getFabricMasters } from "@/actions/fabric-masters";
import { getVendors } from "@/actions/vendors";
import { getPhases } from "@/actions/phases";
import { FabricBalanceGrid } from "@/components/fabric-balance/fabric-balance-grid";

export default async function FabricBalancePage() {
  const [balances, fabricMasters, vendors, phases] = await Promise.all([
    getFabricBalances(),
    getFabricMasters(),
    getVendors(),
    getPhases(),
  ]);

  const vendorById = new Map(vendors.map((v) => [v.id, v.name]));

  const fabricMasterOptions = fabricMasters
    .filter((m) => !m.isStrikedThrough)
    .map((m) => ({
      id: m.id,
      fabricName: m.fabricName,
      vendorId: m.vendorId,
      vendorName: vendorById.get(m.vendorId) || "",
      coloursAvailable: (m.coloursAvailable || []).map(String),
    }));

  const phaseOptions = phases
    .filter((p) => !p.isStrikedThrough)
    .map((p) => ({ id: p.id, label: `Phase ${p.number} — ${p.name}` }));

  const totalKg = balances.reduce((sum, b) => sum + Number(b.remainingKg), 0);
  const totalCost = balances.reduce(
    (sum, b) => sum + Number(b.remainingKg) * Number(b.costPerKg),
    0
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Fabric Balance</h1>
        <p className="text-sm text-muted-foreground">
          {balances.length} surplus fabric record{balances.length === 1 ? "" : "s"}
          {balances.length > 0 && (
            <>
              {" "}· {totalKg.toLocaleString("en-IN", { maximumFractionDigits: 2 })} kg total ·{" "}
              ₹ {totalCost.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} attributed
            </>
          )}
        </p>
      </div>
      <FabricBalanceGrid
        balances={JSON.parse(JSON.stringify(balances))}
        fabricMasters={fabricMasterOptions}
        phases={phaseOptions}
      />
    </div>
  );
}
