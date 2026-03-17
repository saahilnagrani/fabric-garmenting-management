"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function getExpenses(phaseId: string, filters?: { vendorId?: string; specification?: string }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { phaseId };
  if (filters?.vendorId) where.vendorId = filters.vendorId;
  if (filters?.specification) where.specification = filters.specification;

  return db.expense.findMany({
    where,
    include: { vendor: true },
    orderBy: { date: "desc" },
  });
}

export async function getExpense(id: string) {
  return db.expense.findUnique({
    where: { id },
    include: { vendor: true, phase: true },
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createExpense(data: any) {
  const expense = await db.expense.create({ data });
  revalidatePath("/expenses");
  return expense;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function updateExpense(id: string, data: any) {
  const expense = await db.expense.update({ where: { id }, data });
  revalidatePath("/expenses");
  revalidatePath(`/expenses/${id}`);
  return expense;
}

export async function deleteExpense(id: string) {
  await db.expense.delete({ where: { id } });
  revalidatePath("/expenses");
}

export async function getExpenseSummary(phaseId: string) {
  const expenses = await db.expense.findMany({ where: { phaseId } });
  const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const byType = expenses.reduce((acc, e) => {
    acc[e.specification] = (acc[e.specification] || 0) + Number(e.amount);
    return acc;
  }, {} as Record<string, number>);

  return { total, byType, count: expenses.length };
}
