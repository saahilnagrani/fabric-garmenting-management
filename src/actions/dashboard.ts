"use server";

import { db } from "@/lib/db";

export async function getDashboardStats(phaseId: string) {
  const [products, fabricOrders, expenses] = await Promise.all([
    db.product.findMany({ where: { phaseId }, include: { vendor: true } }),
    db.fabricOrder.findMany({ where: { phaseId } }),
    db.expense.findMany({ where: { phaseId } }),
  ]);

  const totalGarmentsPlanned = products.reduce(
    (sum, p) => sum + (p.garmentNumber || 0),
    0
  );
  const totalGarmentsStitched = products.reduce(
    (sum, p) => sum + (p.actualGarmentStitched || 0),
    0
  );

  const statusCounts = products.reduce((acc, p) => {
    acc[p.status] = (acc[p.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const totalFabricOrdered = fabricOrders.reduce(
    (sum, f) => sum + Number(f.quantityOrdered || 0),
    0
  );
  const totalFabricShipped = fabricOrders.reduce(
    (sum, f) => sum + Number(f.quantityShipped || 0),
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
      // We don't have vendor name in this query, but we can use vendorId
      acc[e.vendorId] = (acc[e.vendorId] || 0) + Number(e.amount);
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
