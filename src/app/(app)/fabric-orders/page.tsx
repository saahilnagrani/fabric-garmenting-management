import { getCurrentPhase } from "@/actions/phases";
import { getFabricOrders } from "@/actions/fabric-orders";
import { getVendors } from "@/actions/vendors";
import { getFabricMasters } from "@/actions/fabric-masters";
import { FabricOrderGrid } from "@/components/fabric-orders/fabric-order-grid";

export default async function FabricOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ vendor?: string; tab?: string }>;
}) {
  const params = await searchParams;
  const phase = await getCurrentPhase();
  if (!phase) return <p className="text-muted-foreground">No active phase selected.</p>;

  const isRepeat = params.tab === "repeat" ? true : params.tab === "new" ? false : undefined;

  const [orders, vendors, fabricMasters] = await Promise.all([
    getFabricOrders(phase.id, {
      vendorId: params.vendor || undefined,
      isRepeat,
    }),
    getVendors(),
    getFabricMasters(),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Fabric Orders</h1>
        <p className="text-sm text-muted-foreground">
          {orders.length} orders in {phase.name}
        </p>
      </div>
      <FabricOrderGrid
        orders={JSON.parse(JSON.stringify(orders))}
        vendors={vendors}
        currentTab={params.tab || "all"}
        phaseId={phase.id}
        fabricMasters={JSON.parse(JSON.stringify(fabricMasters))}
      />
    </div>
  );
}
