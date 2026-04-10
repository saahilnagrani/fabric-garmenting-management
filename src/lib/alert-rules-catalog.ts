// Catalog of dashboard alert rules.
//
// Rule IDs, titles, severity, descriptions, and *default* thresholds live here
// in code — they describe the rule and its behaviour. The tunable knobs
// (enabled, thresholdDays, criticalThresholdDays) are stored per-rule in the
// AlertRule DB table so admins can edit them via the admin UI.
//
// To add a new alert rule:
//  1. Add a block to getDashboardAlerts() in src/actions/dashboard.ts
//  2. Add a matching AlertRuleDefinition here
//  3. Insert a seed row into the AlertRule table (or it will fall back to
//     defaults automatically on first read via getAlertRulesMerged)

export type AlertRuleDefinition = {
  id: string;
  title: string;
  severity: "critical" | "warning" | "info";
  /** Human description of what triggers the rule. */
  trigger: string;
  /** Human description of what the threshold means. */
  thresholdLabel: string;
  /** Route the dashboard button links to when the alert fires. */
  action: string;
  /** Default threshold in days. null if the rule has no time threshold. */
  defaultThresholdDays: number | null;
  /** Default critical threshold (only phase-deadline uses this). */
  defaultCriticalThresholdDays: number | null;
  /** True if this rule has a time threshold that admins can edit. */
  supportsThreshold: boolean;
  /** True if this rule has a separate "critical" threshold (phase-deadline). */
  supportsCriticalThreshold: boolean;
  /** Default enabled state for new installs / catalog merge. */
  defaultEnabled: boolean;
};

export const ALERT_RULE_CATALOG: AlertRuleDefinition[] = [
  {
    id: "phase-deadline",
    title: "Phase deadline approaching",
    severity: "critical",
    trigger: "Phase endDate is within the warning window and unshipped articles exist",
    thresholdLabel: "Days before phase end (warning window)",
    action: "/products",
    defaultThresholdDays: 7,
    defaultCriticalThresholdDays: 3,
    supportsThreshold: true,
    supportsCriticalThreshold: true,
    defaultEnabled: true,
  },
  {
    id: "stale-state",
    title: "Stale order state",
    severity: "warning",
    trigger:
      "Any non-terminal article order or fabric order whose status hasn't changed in N days. Replaces the older per-stage stale rules.",
    thresholdLabel: "Days since last status change",
    action: "/products",
    defaultThresholdDays: 7,
    defaultCriticalThresholdDays: null,
    supportsThreshold: true,
    supportsCriticalThreshold: false,
    defaultEnabled: true,
  },
  {
    id: "unlinked-fabric",
    title: "Unlinked fabric orders",
    severity: "info",
    trigger: "Fabric order has no linked articles",
    thresholdLabel: "(no time threshold)",
    action: "/fabric-orders",
    defaultThresholdDays: null,
    defaultCriticalThresholdDays: null,
    supportsThreshold: false,
    supportsCriticalThreshold: false,
    defaultEnabled: true,
  },
  {
    id: "unlinked-products",
    title: "Articles awaiting fabric orders",
    severity: "info",
    trigger: "Planned article has no linked fabric orders",
    thresholdLabel: "(no time threshold)",
    action: "/products?status=PLANNED",
    defaultThresholdDays: null,
    defaultCriticalThresholdDays: null,
    supportsThreshold: false,
    supportsCriticalThreshold: false,
    defaultEnabled: true,
  },
  // ── Legacy rules (disabled by default; superseded by stale-state) ──
  // Kept in the catalog so existing AlertRule rows continue to deserialize
  // and so admins can re-enable them if they really want stage-specific noise.
  {
    id: "stale-ordered",
    title: "Stale fabric orders (legacy)",
    severity: "warning",
    trigger: "DEPRECATED — superseded by stale-state.",
    thresholdLabel: "Days since last update",
    action: "/fabric-orders",
    defaultThresholdDays: 7,
    defaultCriticalThresholdDays: null,
    supportsThreshold: true,
    supportsCriticalThreshold: false,
    defaultEnabled: false,
  },
  {
    id: "missing-cutting-report",
    title: "Awaiting cutting reports (legacy)",
    severity: "warning",
    trigger: "DEPRECATED — superseded by stale-state.",
    thresholdLabel: "Days since fabric received",
    action: "/products?status=FABRIC_RECEIVED",
    defaultThresholdDays: 3,
    defaultCriticalThresholdDays: null,
    supportsThreshold: true,
    supportsCriticalThreshold: false,
    defaultEnabled: false,
  },
  {
    id: "production-stalled",
    title: "Production stalled (legacy)",
    severity: "warning",
    trigger: "DEPRECATED — superseded by stale-state.",
    thresholdLabel: "Days in Stitching",
    action: "/products?status=STITCHING_IN_PROGRESS",
    defaultThresholdDays: 14,
    defaultCriticalThresholdDays: null,
    supportsThreshold: true,
    supportsCriticalThreshold: false,
    defaultEnabled: false,
  },
];

export function getAlertRuleDefinition(id: string): AlertRuleDefinition | undefined {
  return ALERT_RULE_CATALOG.find((r) => r.id === id);
}
