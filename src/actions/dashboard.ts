"use server";

import { db } from "@/lib/db";
import { requirePermission } from "@/lib/require-permission";
import { getAlertRulesMerged } from "./alert-rules";
import type { ProductStatus, FabricOrderStatus } from "@/generated/prisma/client";
import { PRODUCT_STATUS_LABELS, FABRIC_ORDER_STATUS_LABELS } from "@/lib/constants";

export type DashboardAlert = {
  id: string;
  severity: "critical" | "warning" | "info";
  title: string;
  message: string;
  count: number;
  actionUrl: string;
  actionLabel: string;
};

function daysSince(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Computes actionable alerts for the current phase.
 * Uses `updatedAt` as a proxy for "time since last progression" — not perfect
 * (any field change resets the clock), but adequate for stale-detection.
 *
 * Thresholds and enable/disable flags are loaded from the AlertRule DB table
 * (merged against catalog defaults). Admins edit them via /admin/alert-rules.
 */
export async function getDashboardAlerts(phaseId: string): Promise<DashboardAlert[]> {
  await requirePermission("inventory:dashboard:view");

  const [products, fabricOrders, phase, ruleRows] = await Promise.all([
    db.product.findMany({
      where: { phaseId, isStrikedThrough: false },
      include: { fabricOrderLinks: true },
    }),
    db.fabricOrder.findMany({
      where: { phaseId, isStrikedThrough: false },
      include: { productLinks: true },
    }),
    db.phase.findUnique({ where: { id: phaseId } }),
    getAlertRulesMerged(),
  ]);

  const rulesById = new Map(ruleRows.map((r) => [r.id, r]));
  const ruleEnabled = (id: string) => rulesById.get(id)?.enabled ?? true;
  const ruleThreshold = (id: string, fallback: number) =>
    rulesById.get(id)?.thresholdDays ?? fallback;
  const ruleCritical = (id: string, fallback: number) =>
    rulesById.get(id)?.criticalThresholdDays ?? fallback;

  const alerts: DashboardAlert[] = [];

  // 1. Phase deadline approaching with unshipped articles
  if (ruleEnabled("phase-deadline") && phase?.endDate) {
    const warnDays = ruleThreshold("phase-deadline", 7);
    const critDays = ruleCritical("phase-deadline", 3);
    const daysUntil = Math.floor(
      (phase.endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    const TERMINAL_PRODUCT: ProductStatus[] = ["SHIPPED", "DELIVERED"];
    const unshipped = products.filter((p) => !TERMINAL_PRODUCT.includes(p.status));
    if (daysUntil >= 0 && daysUntil <= warnDays && unshipped.length > 0) {
      alerts.push({
        id: "phase-deadline",
        severity: daysUntil <= critDays ? "critical" : "warning",
        title: `Phase ends in ${daysUntil} day${daysUntil === 1 ? "" : "s"}`,
        message: `${unshipped.length} article order${unshipped.length === 1 ? "" : "s"} not yet shipped to customer`,
        count: unshipped.length,
        actionUrl: "/products",
        actionLabel: "View articles",
      });
    }
  }

  // 2. Generic stale-state alert: any non-terminal article or fabric order
  //    whose statusChangedAt is older than N days. Replaces the older
  //    stage-specific rules (stale-ordered, missing-cutting-report,
  //    sampling-overdue, production-stalled).
  if (ruleEnabled("stale-state")) {
    const n = ruleThreshold("stale-state", 7);

    const TERMINAL_PRODUCT: ProductStatus[] = ["SHIPPED", "DELIVERED"];
    const TERMINAL_FABRIC_ORDER: FabricOrderStatus[] = ["FULLY_SETTLED"];

    const staleArticles = products.filter(
      (p) => !TERMINAL_PRODUCT.includes(p.status) && daysSince(p.statusChangedAt) > n
    );
    const staleFabricOrders = fabricOrders.filter(
      (f) => !TERMINAL_FABRIC_ORDER.includes(f.orderStatus) && daysSince(f.statusChangedAt) > n
    );

    if (staleArticles.length > 0) {
      // Group by status for a more useful message
      const byStatus = new Map<ProductStatus, number>();
      for (const p of staleArticles) byStatus.set(p.status, (byStatus.get(p.status) ?? 0) + 1);
      const breakdown = [...byStatus.entries()]
        .map(([s, c]) => `${c} ${PRODUCT_STATUS_LABELS[s] ?? s}`)
        .join(", ");
      alerts.push({
        id: "stale-state-articles",
        severity: "warning",
        title: "Stale article orders",
        message: `${staleArticles.length} article${staleArticles.length === 1 ? "" : "s"} unchanged for more than ${n} days (${breakdown})`,
        count: staleArticles.length,
        actionUrl: "/products",
        actionLabel: "Review",
      });
    }

    if (staleFabricOrders.length > 0) {
      const byStatus = new Map<FabricOrderStatus, number>();
      for (const f of staleFabricOrders) byStatus.set(f.orderStatus, (byStatus.get(f.orderStatus) ?? 0) + 1);
      const breakdown = [...byStatus.entries()]
        .map(([s, c]) => `${c} ${FABRIC_ORDER_STATUS_LABELS[s] ?? s}`)
        .join(", ");
      alerts.push({
        id: "stale-state-fabric-orders",
        severity: "warning",
        title: "Stale fabric orders",
        message: `${staleFabricOrders.length} fabric order${staleFabricOrders.length === 1 ? "" : "s"} unchanged for more than ${n} days (${breakdown})`,
        count: staleFabricOrders.length,
        actionUrl: "/fabric-orders",
        actionLabel: "Review",
      });
    }
  }

  // 6. Unlinked fabric orders (no matched products)
  if (ruleEnabled("unlinked-fabric")) {
    const unlinkedFabricOrders = fabricOrders.filter((f) => f.productLinks.length === 0);
    if (unlinkedFabricOrders.length > 0) {
      alerts.push({
        id: "unlinked-fabric",
        severity: "info",
        title: "Unlinked fabric orders",
        message: `${unlinkedFabricOrders.length} fabric order${unlinkedFabricOrders.length === 1 ? "" : "s"} not linked to any article order — check article numbers, colour, and fabric name match`,
        count: unlinkedFabricOrders.length,
        actionUrl: "/fabric-orders",
        actionLabel: "Reconcile",
      });
    }
  }

  // 7. Unlinked planned articles (no matched fabric orders)
  if (ruleEnabled("unlinked-products")) {
    const unlinkedProducts = products.filter(
      (p) => p.status === "PLANNED" && p.fabricOrderLinks.length === 0
    );
    if (unlinkedProducts.length > 0) {
      alerts.push({
        id: "unlinked-products",
        severity: "info",
        title: "Articles awaiting fabric orders",
        message: `${unlinkedProducts.length} planned article${unlinkedProducts.length === 1 ? "" : "s"} have no fabric orders linked yet`,
        count: unlinkedProducts.length,
        actionUrl: "/products?status=PLANNED",
        actionLabel: "Review",
      });
    }
  }

  // Sort: critical first, then warning, then info
  const order = { critical: 0, warning: 1, info: 2 };
  alerts.sort((a, b) => order[a.severity] - order[b.severity]);

  return alerts;
}


export async function getDashboardStats(phaseId: string) {
  await requirePermission("inventory:dashboard:view");
  const [products, fabricOrders, expenses] = await Promise.all([
    db.product.findMany({ where: { phaseId }, include: { fabricVendor: true } }),
    db.fabricOrder.findMany({ where: { phaseId }, include: { fabricVendor: true } }),
    db.expense.findMany({ where: { phaseId }, include: { vendor: true } }),
  ]);

  const totalGarmentsPlanned = products.reduce(
    (sum, p) => sum + (p.garmentNumber || 0),
    0
  );
  const totalGarmentsStitched = products.reduce(
    (sum, p) =>
      sum +
      (p.actualStitchedXS || 0) +
      (p.actualStitchedS || 0) +
      (p.actualStitchedM || 0) +
      (p.actualStitchedL || 0) +
      (p.actualStitchedXL || 0) +
      (p.actualStitchedXXL || 0),
    0
  );

  const statusCounts = products.reduce((acc, p) => {
    acc[p.status] = (acc[p.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const totalFabricOrdered = fabricOrders.reduce(
    (sum, f) => sum + Number(f.fabricOrderedQuantityKg || 0),
    0
  );
  const totalFabricShipped = fabricOrders.reduce(
    (sum, f) => sum + Number(f.fabricShippedQuantityKg || 0),
    0
  );

  const totalExpenses = expenses.reduce(
    (sum, e) => sum + Number(e.amount),
    0
  );
  const expensesByType = expenses.reduce((acc, e) => {
    acc[e.specification] = (acc[e.specification] || 0) + Number(e.amount);
    return acc;
  }, {} as Record<string, number>);

  const vendorSpend = expenses.reduce((acc, e) => {
    if (e.vendorId) {
      const vendorName = (e as Record<string, unknown>).vendor
        ? ((e as Record<string, unknown>).vendor as { name: string }).name
        : e.vendorId;
      acc[vendorName] = (acc[vendorName] || 0) + Number(e.amount);
    }
    return acc;
  }, {} as Record<string, number>);

  return {
    totalProducts: products.length,
    totalGarmentsPlanned,
    totalGarmentsStitched,
    statusCounts,
    totalFabricOrders: fabricOrders.length,
    totalFabricOrdered,
    totalFabricShipped,
    totalExpenses,
    expensesByType,
    expenseCount: expenses.length,
    vendorSpend,
  };
}
