"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { Supplier, Outreach, PipelineStatus } from "@/types/sourcing"

const PIPELINE_STAGES: { status: PipelineStatus; label: string; color: string }[] = [
  { status: "identified", label: "Identified", color: "bg-slate-400" },
  { status: "researching", label: "Researching", color: "bg-blue-400" },
  { status: "contacted", label: "Contacted", color: "bg-indigo-400" },
  { status: "responded", label: "Responded", color: "bg-purple-400" },
  { status: "sampling", label: "Sampling", color: "bg-amber-400" },
  { status: "approved", label: "Approved", color: "bg-green-500" },
  { status: "rejected", label: "Rejected", color: "bg-red-400" },
  { status: "on_hold", label: "On Hold", color: "bg-gray-400" },
]

const statusBadgeVariant = (status: PipelineStatus) => {
  switch (status) {
    case "approved":
      return "bg-green-100 text-green-800"
    case "rejected":
      return "bg-red-100 text-red-800"
    case "on_hold":
      return "bg-gray-100 text-gray-800"
    case "contacted":
    case "responded":
      return "bg-indigo-100 text-indigo-800"
    case "sampling":
      return "bg-amber-100 text-amber-800"
    default:
      return "bg-blue-100 text-blue-800"
  }
}

export default function DashboardPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [outreach, setOutreach] = useState<Outreach[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const [suppRes, outRes] = await Promise.all([
        fetch("/api/sourcing/suppliers"),
        fetch("/api/sourcing/outreach"),
      ])
      if (suppRes.ok) {
        const data = await suppRes.json()
        setSuppliers(Array.isArray(data) ? data : [])
      }
      if (outRes.ok) {
        const data = await outRes.json()
        setOutreach(Array.isArray(data) ? data : [])
      }
    } catch {
      toast.error("Failed to load dashboard data")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Derived stats
  const totalSuppliers = suppliers.length
  const activePipeline = suppliers.filter(
    (s) => s.pipeline_status !== "rejected" && s.pipeline_status !== "on_hold",
  ).length
  const sentEmails = outreach.filter((o) => o.status === "sent").length
  const repliedEmails = outreach.filter((o) => o.status === "replied").length
  const responseRate = sentEmails > 0 ? Math.round((repliedEmails / sentEmails) * 100) : 0

  // Pipeline distribution
  const pipelineCounts = PIPELINE_STAGES.map((stage) => ({
    ...stage,
    count: suppliers.filter((s) => s.pipeline_status === stage.status).length,
  }))
  const totalForBar = suppliers.length || 1 // prevent division by zero

  // Recent activity (latest 10)
  const recentSuppliers = [...suppliers]
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )
    .slice(0, 10)

  // Material coverage
  const materialCoverage: Record<string, number> = {}
  for (const s of suppliers) {
    if (s.primary_materials) {
      for (const mat of s.primary_materials) {
        materialCoverage[mat] = (materialCoverage[mat] ?? 0) + 1
      }
    }
  }
  const sortedMaterials = Object.entries(materialCoverage).sort(
    ([, a], [, b]) => b - a,
  )

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-muted-foreground">
          Sourcing pipeline overview
        </p>
      </div>

      {/* Row 1: Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>Total Suppliers</CardDescription>
            <CardTitle className="text-3xl">{totalSuppliers}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Active Pipeline</CardDescription>
            <CardTitle className="text-3xl">{activePipeline}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Emails Sent</CardDescription>
            <CardTitle className="text-3xl">{sentEmails}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Response Rate</CardDescription>
            <CardTitle className="text-3xl">{responseRate}%</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Row 2: Pipeline Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Pipeline Distribution</CardTitle>
          <CardDescription>
            Suppliers by pipeline stage
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Horizontal stacked bar */}
          <div className="flex h-8 w-full overflow-hidden rounded-lg">
            {pipelineCounts.map(
              (stage) =>
                stage.count > 0 && (
                  <a
                    key={stage.status}
                    href={`/sourcing/suppliers?status=${stage.status}`}
                    className={`${stage.color} flex items-center justify-center text-xs font-medium text-white transition-opacity hover:opacity-80`}
                    style={{
                      width: `${(stage.count / totalForBar) * 100}%`,
                      minWidth: stage.count > 0 ? "28px" : undefined,
                    }}
                    title={`${stage.label}: ${stage.count}`}
                  >
                    {stage.count}
                  </a>
                ),
            )}
          </div>
          {/* Legend */}
          <div className="mt-3 flex flex-wrap gap-3">
            {pipelineCounts.map((stage) => (
              <div key={stage.status} className="flex items-center gap-1.5">
                <span
                  className={`inline-block h-3 w-3 rounded-sm ${stage.color}`}
                />
                <span className="text-xs text-muted-foreground">
                  {stage.label} ({stage.count})
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Row 3: Two columns */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest suppliers added</CardDescription>
          </CardHeader>
          <CardContent>
            {recentSuppliers.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No suppliers yet
              </p>
            ) : (
              <div className="space-y-3">
                {recentSuppliers.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between rounded-lg border px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {s.company_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(s.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge
                      className={`ml-2 shrink-0 text-xs ${statusBadgeVariant(s.pipeline_status)}`}
                    >
                      {s.pipeline_status.replace(/_/g, " ")}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Material Coverage */}
        <Card>
          <CardHeader>
            <CardTitle>Material Coverage</CardTitle>
            <CardDescription>Suppliers per material</CardDescription>
          </CardHeader>
          <CardContent>
            {sortedMaterials.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No material data available
              </p>
            ) : (
              <div className="space-y-2">
                {sortedMaterials.map(([material, count]) => (
                  <div
                    key={material}
                    className="flex items-center justify-between rounded-lg border px-3 py-2"
                  >
                    <span className="text-sm font-medium">{material}</span>
                    <Badge variant="secondary">{count}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
