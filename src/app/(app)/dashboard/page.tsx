import { getCurrentPhase } from "@/actions/phases";
import { getDashboardStats } from "@/actions/dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PRODUCT_STATUS_LABELS, EXPENSE_TYPE_LABELS } from "@/lib/constants";
import { formatCurrency, formatNumber } from "@/lib/formatters";
import { Package, Scissors, Receipt, TrendingUp } from "lucide-react";

export default async function DashboardPage() {
  const phase = await getCurrentPhase();

  if (!phase) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <h2 className="text-xl font-semibold">No active phase</h2>
        <p className="text-muted-foreground">
          Go to Phases and create or activate a phase to get started.
        </p>
      </div>
    );
  }

  const stats = await getDashboardStats(phase.id);
  const stitchedPercent =
    stats.totalGarmentsPlanned > 0
      ? Math.round(
          (stats.totalGarmentsStitched / stats.totalGarmentsPlanned) * 100
        )
      : 0;

  const fabricPercent =
    stats.totalFabricOrdered > 0
      ? Math.round(
          (stats.totalFabricShipped / stats.totalFabricOrdered) * 100
        )
      : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Phase {phase.number} - {phase.name}</h1>
        <p className="text-muted-foreground">Dashboard overview</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Garments Progress
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatNumber(stats.totalGarmentsStitched)}
            </div>
            <p className="text-xs text-muted-foreground">
              of {formatNumber(stats.totalGarmentsPlanned)} planned ({stitchedPercent}%)
            </p>
            <div className="mt-2 h-2 w-full rounded-full bg-gray-200">
              <div
                className="h-2 rounded-full bg-green-500"
                style={{ width: `${Math.min(stitchedPercent, 100)}%` }}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Products
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalProducts}</div>
            <p className="text-xs text-muted-foreground">
              SKUs in this phase
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Fabric Orders
            </CardTitle>
            <Scissors className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalFabricOrders}</div>
            <p className="text-xs text-muted-foreground">
              {formatNumber(stats.totalFabricShipped)} of{" "}
              {formatNumber(stats.totalFabricOrdered)} shipped ({fabricPercent}%)
            </p>
            <div className="mt-2 h-2 w-full rounded-full bg-gray-200">
              <div
                className="h-2 rounded-full bg-blue-500"
                style={{ width: `${Math.min(fabricPercent, 100)}%` }}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Expenses
            </CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(stats.totalExpenses)}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.expenseCount} invoices
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Production Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(stats.statusCounts).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between">
                  <span className="text-sm">
                    {PRODUCT_STATUS_LABELS[status] || status}
                  </span>
                  <span className="font-medium">{count}</span>
                </div>
              ))}
              {Object.keys(stats.statusCounts).length === 0 && (
                <p className="text-sm text-muted-foreground">No products yet</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Expenses by Type
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(stats.expensesByType).map(([type, amount]) => (
                <div key={type} className="flex items-center justify-between">
                  <span className="text-sm">
                    {EXPENSE_TYPE_LABELS[type] || type}
                  </span>
                  <span className="font-medium">{formatCurrency(amount)}</span>
                </div>
              ))}
              {Object.keys(stats.expensesByType).length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No expenses yet
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
