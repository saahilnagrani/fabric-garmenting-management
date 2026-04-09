import { getAuditLogs } from "@/actions/audit-log";
import { AuditLogGrid } from "@/components/admin/audit-log-grid";

export default async function AuditLogPage() {
  const { logs, total } = await getAuditLogs({ pageSize: 200 });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Audit Log</h1>
        <p className="text-sm text-muted-foreground">
          {total} actions recorded. Shows all user actions with timestamps.
        </p>
      </div>
      <AuditLogGrid logs={JSON.parse(JSON.stringify(logs))} />
    </div>
  );
}
