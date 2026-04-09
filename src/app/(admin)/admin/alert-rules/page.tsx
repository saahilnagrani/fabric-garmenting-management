import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bell } from "lucide-react";
import { requireAuth } from "@/lib/require-permission";
import { redirect } from "next/navigation";

type AlertRule = {
  id: string;
  title: string;
  severity: "critical" | "warning" | "info";
  trigger: string;
  threshold: string;
  action: string;
};

const ALERT_RULES: AlertRule[] = [
  {
    id: "phase-deadline",
    title: "Phase deadline approaching",
    severity: "critical",
    trigger: "Phase endDate is within 7 days and unshipped articles exist",
    threshold: "critical at 3 days or less, warning at 4 to 7 days",
    action: "Links to /products",
  },
  {
    id: "stale-ordered",
    title: "Stale fabric orders",
    severity: "warning",
    trigger: "Fabric order status is ORDERED and updatedAt is older than threshold",
    threshold: "More than 7 days",
    action: "Links to /fabric-orders",
  },
  {
    id: "missing-cutting-report",
    title: "Awaiting cutting reports",
    severity: "warning",
    trigger: "Product status is FABRIC_RECEIVED with no cuttingReportGarmentsPerKg or _2 value",
    threshold: "More than 3 days since updatedAt",
    action: "Links to /products?status=FABRIC_RECEIVED",
  },
  {
    id: "sampling-overdue",
    title: "Sampling overdue",
    severity: "warning",
    trigger: "Product status is SAMPLING",
    threshold: "More than 5 days since updatedAt",
    action: "Links to /products?status=SAMPLING",
  },
  {
    id: "production-stalled",
    title: "Production stalled",
    severity: "warning",
    trigger: "Product status is IN_PRODUCTION",
    threshold: "More than 14 days since updatedAt",
    action: "Links to /products?status=IN_PRODUCTION",
  },
  {
    id: "unlinked-fabric",
    title: "Unlinked fabric orders",
    severity: "info",
    trigger: "Fabric order has no ProductFabricOrder join rows",
    threshold: "Any age",
    action: "Links to /fabric-orders",
  },
  {
    id: "unlinked-products",
    title: "Articles awaiting fabric orders",
    severity: "info",
    trigger: "Product status is PLANNED and no ProductFabricOrder join rows exist",
    threshold: "Any age",
    action: "Links to /products?status=PLANNED",
  },
];

const SEVERITY_BADGE: Record<AlertRule["severity"], string> = {
  critical: "bg-red-50 border-red-200 text-red-700",
  warning: "bg-amber-50 border-amber-200 text-amber-700",
  info: "bg-blue-50 border-blue-200 text-blue-700",
};

export default async function AlertRulesPage() {
  const session = await requireAuth();
  if (session.user?.role !== "ADMIN") {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold">Alert Rules</h1>
        <p className="text-muted-foreground">
          Reference for dashboard alerts shown on the main dashboard.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-blue-600" />
            Dashboard Alerts
            <span className="text-sm font-normal text-muted-foreground">
              ({ALERT_RULES.length} rules)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p className="text-xs text-muted-foreground">
            Dashboard alerts are computed per phase in <code className="text-xs bg-muted px-1 rounded">getDashboardAlerts()</code>. Staleness is measured against <code className="text-xs bg-muted px-1 rounded">updatedAt</code>, which resets on any field change. Alerts are sorted critical, then warning, then info.
          </p>
          <table className="w-full text-xs border rounded overflow-hidden">
            <thead className="bg-muted">
              <tr>
                <th className="text-left p-2 font-medium">Alert</th>
                <th className="text-left p-2 font-medium">Severity</th>
                <th className="text-left p-2 font-medium">Trigger</th>
                <th className="text-left p-2 font-medium">Threshold</th>
                <th className="text-left p-2 font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {ALERT_RULES.map((rule) => (
                <tr key={rule.id}>
                  <td className="p-2 font-medium">{rule.title}</td>
                  <td className="p-2">
                    <span className={`inline-block text-[10px] font-mono uppercase px-1.5 py-0.5 rounded border ${SEVERITY_BADGE[rule.severity]}`}>
                      {rule.severity}
                    </span>
                  </td>
                  <td className="p-2 text-muted-foreground">{rule.trigger}</td>
                  <td className="p-2 text-muted-foreground">{rule.threshold}</td>
                  <td className="p-2 text-muted-foreground">{rule.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div>
            <h3 className="font-semibold mb-1">Notes</h3>
            <ul className="list-disc list-inside text-muted-foreground space-y-0.5 ml-2 text-xs">
              <li>Striked-through products and fabric orders are excluded from all alert checks.</li>
              <li>Info-level alerts (unlinked fabric orders and unlinked planned articles) have no time threshold and surface as soon as the condition is true.</li>
              <li>Phase deadline alert only fires when unshipped articles exist, to avoid noise on fully shipped phases.</li>
              <li>To add a new alert, edit <code className="text-xs bg-muted px-1 rounded">src/actions/dashboard.ts</code> and update this page.</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
