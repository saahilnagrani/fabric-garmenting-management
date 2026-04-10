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
  },
  {
    id: "stale-ordered",
    title: "Stale fabric orders",
    severity: "warning",
    trigger: "Fabric order status is ORDERED and has not changed in N days",
    thresholdLabel: "Days since last update",
    action: "/fabric-orders",
    defaultThresholdDays: 7,
    defaultCriticalThresholdDays: null,
    supportsThreshold: true,
    supportsCriticalThreshold: false,
  },
  {
    id: "missing-cutting-report",
    title: "Awaiting cutting reports",
    severity: "warning",
    trigger: "Article is in FABRIC_RECEIVED with no cutting report after N days",
    thresholdLabel: "Days since fabric received",
    action: "/products?status=FABRIC_RECEIVED",
    defaultThresholdDays: 3,
    defaultCriticalThresholdDays: null,
    supportsThreshold: true,
    supportsCriticalThreshold: false,
  },
  {
    id: "sampling-overdue",
    title: "Sampling overdue",
    severity: "warning",
    trigger: "Article is in SAMPLING for more than N days",
    thresholdLabel: "Days in Sampling",
    action: "/products?status=SAMPLING",
    defaultThresholdDays: 5,
    defaultCriticalThresholdDays: null,
    supportsThreshold: true,
    supportsCriticalThreshold: false,
  },
  {
    id: "production-stalled",
    title: "Production stalled",
    severity: "warning",
    trigger: "Article is in IN_PRODUCTION for more than N days",
    thresholdLabel: "Days in Production",
    action: "/products?status=IN_PRODUCTION",
    defaultThresholdDays: 14,
    defaultCriticalThresholdDays: null,
    supportsThreshold: true,
    supportsCriticalThreshold: false,
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
  },
];

export function getAlertRuleDefinition(id: string): AlertRuleDefinition | undefined {
  return ALERT_RULE_CATALOG.find((r) => r.id === id);
}
