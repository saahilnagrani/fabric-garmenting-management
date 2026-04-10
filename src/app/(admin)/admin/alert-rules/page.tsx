import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bell } from "lucide-react";
import { requireAuth } from "@/lib/require-permission";
import { redirect } from "next/navigation";
import { getAlertRulesMerged } from "@/actions/alert-rules";
import { AlertRulesEditor } from "./alert-rules-editor";

export default async function AlertRulesPage() {
  const session = await requireAuth();
  if (session.user?.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const rules = await getAlertRulesMerged();

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold">Alert Rules</h1>
        <p className="text-muted-foreground">
          Tune the thresholds for the alerts that appear on the main dashboard. Disable a rule to silence it entirely.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-blue-600" />
            Dashboard Alerts
            <span className="text-sm font-normal text-muted-foreground">
              ({rules.length} rules)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p className="text-xs text-muted-foreground">
            Alerts are computed per phase in <code className="text-xs bg-muted px-1 rounded">getDashboardAlerts()</code>. Staleness is measured against <code className="text-xs bg-muted px-1 rounded">updatedAt</code>, which resets on any field change. Alerts are sorted critical, then warning, then info.
          </p>

          <AlertRulesEditor initialRules={rules} />

          <div>
            <h3 className="font-semibold mb-1">Notes</h3>
            <ul className="list-disc list-inside text-muted-foreground space-y-0.5 ml-2 text-xs">
              <li>Striked-through products and fabric orders are excluded from all alert checks.</li>
              <li>Info-level alerts have no time threshold and surface as soon as the condition is true.</li>
              <li>Phase deadline alert only fires when unshipped articles exist, to avoid noise on fully shipped phases.</li>
              <li>To add a new alert rule, edit <code className="text-xs bg-muted px-1 rounded">src/actions/dashboard.ts</code> and add a matching entry to <code className="text-xs bg-muted px-1 rounded">src/lib/alert-rules-catalog.ts</code>.</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
