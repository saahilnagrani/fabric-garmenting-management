import { notFound } from "next/navigation";
import { getFabricOrder } from "@/actions/fabric-orders";
import { formatCurrency, formatNumber } from "@/lib/formatters";
import { GENDER_LABELS } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/link-button";
import { ArrowLeft } from "lucide-react";

export default async function FabricOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await getFabricOrder(id);
  if (!order) notFound();

  const ordered = Number(order.fabricOrderedQuantityKg) || 0;
  const shipped = Number(order.fabricShippedQuantityKg) || 0;
  const pct = ordered > 0 ? Math.round((shipped / ordered) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <LinkButton href="/fabric-orders" variant="ghost" size="icon">
          <ArrowLeft className="h-4 w-4" />
        </LinkButton>
        <h1 className="text-2xl font-bold">
          Fabric Order - {order.fabricName} ({order.colour})
        </h1>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div><p className="text-xs text-muted-foreground">Fabric Vendor</p><p className="font-medium">{order.fabricVendor.name}</p></div>
          <div><p className="text-xs text-muted-foreground">Article Numbers</p><p className="font-medium">{order.articleNumbers}</p></div>
          <div><p className="text-xs text-muted-foreground">Fabric</p><p className="font-medium">{order.fabricName}</p></div>
          <div><p className="text-xs text-muted-foreground">Colour</p><p className="font-medium">{order.colour}</p></div>
          <div><p className="text-xs text-muted-foreground">Gender</p><p className="font-medium">{order.gender ? GENDER_LABELS[order.gender] : "-"}</p></div>
          <div><p className="text-xs text-muted-foreground">Received At</p><p className="font-medium">{order.receivedAt || "-"}</p></div>
          <div><p className="text-xs text-muted-foreground">Cost/Unit</p><p className="font-medium">{formatCurrency(Number(order.costPerUnit))}</p></div>
          <div>
            <p className="text-xs text-muted-foreground">Shipped / Ordered</p>
            <p className="font-medium">{formatNumber(shipped)} / {formatNumber(ordered)} ({pct}%)</p>
            <div className="mt-1 h-2 w-full rounded-full bg-gray-200">
              <div className="h-2 rounded-full bg-blue-500" style={{ width: `${Math.min(pct, 100)}%` }} />
            </div>
          </div>
          <div><p className="text-xs text-muted-foreground">Expected Fabric Cost</p><p className="font-medium">{formatCurrency(Number(order.costPerUnit) * ordered)}</p></div>
          <div><p className="text-xs text-muted-foreground">Actual Fabric Cost</p><p className="font-medium">{formatCurrency(Number(order.costPerUnit) * shipped)}</p></div>
        </CardContent>
      </Card>
    </div>
  );
}
