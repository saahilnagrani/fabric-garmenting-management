"use server";

import { db } from "@/lib/db";
import { requirePermission } from "@/lib/require-permission";

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
 */
export async function getDashboardAlerts(phaseId: string): Promise<DashboardAlert[]> {
  await requirePermission("inventory:dashboard:view");

  const [products, fabricOrders, phase] = await Promise.all([
    db.product.findMany({
      where: { phaseId, isStrikedThrough: false },
      include: { fabricOrderLinks: true },
    }),
    db.fabricOrder.findMany({
      where: { phaseId, isStrikedThrough: false },
      include: { productLinks: true },
    }),
    db.phase.findUnique({ where: { id: phaseId } }),
  ]);

  const alerts: DashboardAlert[] = [];

  // 1. Phase deadline approaching with unshipped articles
  if (phase?.endDate) {
    const daysUntil = Math.floor(
      (phase.endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    const unshipped = products.filter((p) => p.status !== "SHIPPED");
    if (daysUntil >= 0 && daysUntil <= 7 && unshipped.length > 0) {
      alerts.push({
        id: "phase-deadline",
        severity: daysUntil <= 3 ? "critical" : "warning",
        title: `Phase ends in ${daysUntil} day${daysUntil === 1 ? "" : "s"}`,
        message: `${unshipped.length} article order${unshipped.length === 1 ? "" : "s"} not yet shipped to customer`,
        count: unshipped.length,
        actionUrl: "/products",
        actionLabel: "View articles",
      });
    }
  }

  // 2. Stale fabric orders: ORDERED > 7 days
  const staleOrdered = fabricOrders.filter(
    (f) => f.orderStatus === "ORDERED" && daysSince(f.updatedAt) > 7
  );
  if (staleOrdered.length > 0) {
    alerts.push({
      id: "stale-ordered",
      severity: "warning",
      title: "Stale fabric orders",
      message: `${staleOrdered.length} fabric order${staleOrdered.length === 1 ? "" : "s"} in Ordered state for more than 7 days`,
      count: staleOrdered.length,
      actionUrl: "/fabric-orders",
      actionLabel: "Review",
    });
  }

  // 3. Missing cutting reports: products in FABRIC_RECEIVED > 3 days without cutting report
  const missingCuttingReport = products.filter(
    (p) =>
      p.status === "FABRIC_RECEIVED" &&
      p.cuttingReportGarmentsPerKg === null &&
      p.cuttingReportGarmentsPerKg2 === null &&
      daysSince(p.updatedAt) > 3
  );
  if (missingCuttingReport.length > 0) {
    alerts.push({
      id: "missing-cutting-report",
      severity: "warning",
      title: "Awaiting cutting reports",
      message: `${missingCuttingReport.length} article${missingCuttingReport.length === 1 ? "" : "s"} with fabric received but no cutting report entered (>3 days)`,
      count: missingCuttingReport.length,
      actionUrl: "/products?status=FABRIC_RECEIVED",
      actionLabel: "Enter reports",
    });
  }

  // 4. Sampling overdue > 5 days
  const samplingOverdue = products.filter(
    (p) => p.status === "SAMPLING" && daysSince(p.updatedAt) > 5
  );
  if (samplingOverdue.length > 0) {
    alerts.push({
      id: "sampling-overdue",
      severity: "warning",
      title: "Sampling overdue",
      message: `${samplingOverdue.length} article${samplingOverdue.length === 1 ? "" : "s"} in Sampling for more than 5 days`,
      count: samplingOverdue.length,
      actionUrl: "/products?status=SAMPLING",
      actionLabel: "Review",
    });
  }

  // 5. Production stalled > 14 days
  const productionStalled = products.filter(
    (p) => p.status === "IN_PRODUCTION" && daysSince(p.updatedAt) > 14
  );
  if (productionStalled.length > 0) {
    alerts.push({
      id: "production-stalled",
      severity: "warning",
      title: "Production stalled",
      message: `${productionStalled.length} article${productionStalled.length === 1 ? "" : "s"} in Production for more than 14 days`,
      count: productionStalled.length,
      actionUrl: "/products?status=IN_PRODUCTION",
      actionLabel: "Review",
    });
  }

  // 6. Unlinked fabric orders (no matched products) — may indicate data entry issues
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

  // 7. Unlinked article orders (no matched fabric orders) — waiting for fabric to be ordered
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
