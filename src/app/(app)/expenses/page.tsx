import { getCurrentPhase } from "@/actions/phases";
import { getExpenses } from "@/actions/expenses";
import { getVendors } from "@/actions/vendors";
import { ExpenseGrid } from "@/components/expenses/expense-grid";

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ vendor?: string; type?: string }>;
}) {
  const params = await searchParams;
  const phase = await getCurrentPhase();
  if (!phase) return <p className="text-muted-foreground">No active phase selected.</p>;

  const [expenses, vendors] = await Promise.all([
    getExpenses(phase.id, {
      vendorId: params.vendor || undefined,
      specification: params.type || undefined,
    }),
    getVendors(),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Expenses</h1>
        <p className="text-sm text-muted-foreground">
          {expenses.length} invoices in {phase.name}
        </p>
      </div>
      <ExpenseGrid expenses={JSON.parse(JSON.stringify(expenses))} vendors={vendors} phaseId={phase.id} />
    </div>
  );
}
