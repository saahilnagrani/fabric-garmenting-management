import { db } from "@/lib/db";

export type AuditAction = "CREATE" | "UPDATE" | "DELETE" | "ARCHIVE" | "MERGE";

export function logAction(
  userId: string,
  userName: string,
  action: AuditAction,
  entityType: string,
  entityId: string,
  changes?: Record<string, { old: unknown; new: unknown }>
) {
  // Fire-and-forget, non-blocking
  db.auditLog.create({
    data: {
      userId,
      userName,
      action,
      entityType,
      entityId,
      changes: changes ? JSON.stringify(changes) : null,
    },
  }).catch(console.error);
}

export function computeDiff(
  oldData: Record<string, unknown>,
  newData: Record<string, unknown>
): Record<string, { old: unknown; new: unknown }> | undefined {
  const diff: Record<string, { old: unknown; new: unknown }> = {};
  for (const key of Object.keys(newData)) {
    if (JSON.stringify(oldData[key]) !== JSON.stringify(newData[key])) {
      diff[key] = { old: oldData[key], new: newData[key] };
    }
  }
  return Object.keys(diff).length > 0 ? diff : undefined;
}
