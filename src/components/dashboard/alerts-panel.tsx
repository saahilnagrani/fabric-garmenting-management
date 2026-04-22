import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, AlertCircle, Info, ArrowRight, CheckCircle2 } from "lucide-react";
import type { DashboardAlert } from "@/actions/dashboard";

const SEVERITY_STYLES: Record<DashboardAlert["severity"], { border: string; bg: string; iconColor: string }> = {
  critical: { border: "border-red-300 dark:border-red-800", bg: "bg-red-50 dark:bg-red-950/40", iconColor: "text-red-600 dark:text-red-400" },
  warning: { border: "border-amber-300 dark:border-amber-800", bg: "bg-amber-50 dark:bg-amber-950/40", iconColor: "text-amber-600 dark:text-amber-400" },
  info: { border: "border-blue-200 dark:border-blue-800", bg: "bg-blue-50 dark:bg-blue-950/40", iconColor: "text-blue-600 dark:text-blue-400" },
};

function SeverityIcon({ severity }: { severity: DashboardAlert["severity"] }) {
  const cls = `h-4 w-4 ${SEVERITY_STYLES[severity].iconColor}`;
  if (severity === "critical") return <AlertCircle className={cls} />;
  if (severity === "warning") return <AlertTriangle className={cls} />;
  return <Info className={cls} />;
}

export function AlertsPanel({ alerts }: { alerts: DashboardAlert[] }) {
  if (alerts.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">All clear — no issues to review.</p>
        </CardContent>
      </Card>
    );
  }

  const critical = alerts.filter((a) => a.severity === "critical").length;
  const warning = alerts.filter((a) => a.severity === "warning").length;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          Alerts
          <span className="text-xs font-normal text-muted-foreground">
            ({alerts.length} total{critical > 0 ? `, ${critical} critical` : ""}{warning > 0 ? `, ${warning} warning` : ""})
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {alerts.map((alert) => {
            const styles = SEVERITY_STYLES[alert.severity];
            return (
              <Link
                key={alert.id}
                href={alert.actionUrl}
                className={`group flex items-start gap-2 rounded-lg border ${styles.border} ${styles.bg} px-3 py-2 transition-colors hover:opacity-90`}
              >
                <SeverityIcon severity={alert.severity} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-semibold">{alert.title}</span>
                    <span className="text-[10px] font-medium text-muted-foreground px-1.5 py-0.5 rounded bg-white/60 dark:bg-white/10">
                      {alert.count}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                    {alert.message}
                  </p>
                </div>
                <div className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground group-hover:text-foreground shrink-0 mt-0.5">
                  {alert.actionLabel}
                  <ArrowRight className="h-3 w-3" />
                </div>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
