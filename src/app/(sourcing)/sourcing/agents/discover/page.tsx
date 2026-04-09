"use client"

import { Fragment, useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import {
  ChevronDown,
  ChevronRight,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  History,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { Material, MaterialCategory } from "@/types/sourcing"

interface DiscoveredSupplier {
  company_name: string
  company_name_cn?: string | null
  location_city: string
  location_province: string
  primary_materials: string[]
  source_platform: string
  source_url?: string | null
  certifications?: string[]
  moq_range?: string | null
  score?: number
  relevance_score?: number
  score_reasoning?: string
  manufacturer_confidence?: string | number
  is_likely_manufacturer?: boolean
  ai_summary?: string
  red_flags?: string[]
  green_flags?: string[]
}

interface DiscoveryJob {
  id: string
  material_ids: string[]
  material_names?: string[]
  status: "pending" | "running" | "completed" | "failed"
  results: DiscoveredSupplier[] | null
  error: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function formatDuration(start: string, end: string) {
  const ms = new Date(end).getTime() - new Date(start).getTime()
  const secs = Math.round(ms / 1000)
  if (secs < 60) return `${secs}s`
  const mins = Math.floor(secs / 60)
  const remainSecs = secs % 60
  return `${mins}m ${remainSecs}s`
}

function StatusIcon({ status }: { status: DiscoveryJob["status"] }) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="size-4 text-green-600" />
    case "failed":
      return <XCircle className="size-4 text-red-500" />
    case "running":
    case "pending":
      return <Loader2 className="size-4 animate-spin text-blue-500" />
  }
}

function StatusBadge({ status }: { status: DiscoveryJob["status"] }) {
  const variants: Record<string, string> = {
    completed: "bg-green-100 text-green-800",
    failed: "bg-red-100 text-red-800",
    running: "bg-blue-100 text-blue-800",
    pending: "bg-yellow-100 text-yellow-800",
  }
  return (
    <Badge variant="outline" className={`border-transparent text-xs ${variants[status] ?? ""}`}>
      {status}
    </Badge>
  )
}

// Reusable supplier results table
function SupplierResultsTable({
  results,
  onSave,
  onDismiss,
}: {
  results: DiscoveredSupplier[]
  onSave?: (supplier: DiscoveredSupplier) => Promise<void>
  onDismiss?: (index: number) => void
}) {
  const [expandedRow, setExpandedRow] = useState<number | null>(null)
  const [savedIndices, setSavedIndices] = useState<Set<number>>(new Set())
  const [savingIndices, setSavingIndices] = useState<Set<number>>(new Set())

  function scoreColor(score: number) {
    if (score >= 7) return "bg-green-100 text-green-800"
    if (score >= 4) return "bg-yellow-100 text-yellow-800"
    return "bg-red-100 text-red-800"
  }

  async function handleSave(supplier: DiscoveredSupplier, index: number) {
    if (!onSave) return
    setSavingIndices((prev) => new Set(prev).add(index))
    try {
      await onSave(supplier)
      setSavedIndices((prev) => new Set(prev).add(index))
    } finally {
      setSavingIndices((prev) => {
        const next = new Set(prev)
        next.delete(index)
        return next
      })
    }
  }

  return (
    <div className="w-full overflow-x-auto">
      <Table className="table-fixed w-full">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[22%]">Company Name</TableHead>
            <TableHead className="w-[14%]">Location</TableHead>
            <TableHead className="w-[20%]">Materials</TableHead>
            <TableHead className="w-[8%]">Score</TableHead>
            <TableHead className="w-[10%]">Confidence</TableHead>
            <TableHead className="w-[12%]">Source</TableHead>
            {(onSave || onDismiss) && <TableHead className="w-[14%]">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {results.map((supplier, idx) => {
            const isSaved = savedIndices.has(idx)
            const isSaving = savingIndices.has(idx)
            const isExpanded = expandedRow === idx

            return (
              <Fragment key={idx}>
                <TableRow
                  className="cursor-pointer"
                  onClick={() => setExpandedRow(isExpanded ? null : idx)}
                >
                  <TableCell className="font-medium whitespace-normal">
                    <div className="line-clamp-3 break-words leading-snug">
                      {supplier.company_name}
                      {isSaved && (
                        <Badge variant="secondary" className="ml-1 bg-green-100 text-green-800 text-[10px]">
                          Saved
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    <div className="line-clamp-3 break-words leading-snug text-sm">
                      {supplier.location_city}
                      {supplier.location_province ? `, ${supplier.location_province}` : ""}
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    <div className="flex flex-wrap gap-1">
                      {(supplier.primary_materials ?? []).slice(0, 3).map((mat) => (
                        <Badge key={mat} variant="outline" className="text-[10px] px-1.5 py-0 whitespace-normal break-words">
                          {mat}
                        </Badge>
                      ))}
                      {(supplier.primary_materials ?? []).length > 3 && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          +{(supplier.primary_materials ?? []).length - 3}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    {(() => {
                      const s = supplier.relevance_score ?? supplier.score ?? 0
                      const hasBreakdown = supplier.score_reasoning || supplier.certifications?.length || supplier.is_likely_manufacturer !== undefined
                      return (
                        <div className="relative group/score inline-block">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold cursor-help ${scoreColor(s)}`}
                          >
                            {s}
                          </span>
                          {hasBreakdown && (
                            <div className="absolute left-0 bottom-full mb-2 z-50 hidden group-hover/score:block w-64 rounded-lg border bg-popover p-3 text-popover-foreground shadow-lg">
                              <p className="text-xs font-semibold mb-1.5">Score Breakdown</p>
                              <div className="space-y-1.5 text-xs">
                                {supplier.score_reasoning && (
                                  <div>
                                    <span className="text-muted-foreground">Reasoning: </span>
                                    <span className="whitespace-normal break-words">{supplier.score_reasoning}</span>
                                  </div>
                                )}
                                {supplier.is_likely_manufacturer !== undefined && (
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Manufacturer</span>
                                    <span className={supplier.is_likely_manufacturer ? "text-green-600 font-medium" : "text-red-500 font-medium"}>
                                      {supplier.is_likely_manufacturer ? "Yes" : "No"}
                                    </span>
                                  </div>
                                )}
                                {supplier.manufacturer_confidence && (
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Confidence</span>
                                    <span className="font-medium capitalize">
                                      {typeof supplier.manufacturer_confidence === "number"
                                        ? `${Math.round(supplier.manufacturer_confidence * 100)}%`
                                        : supplier.manufacturer_confidence}
                                    </span>
                                  </div>
                                )}
                                {(supplier.certifications ?? []).length > 0 && (
                                  <div>
                                    <span className="text-muted-foreground">Certifications: </span>
                                    <span>{supplier.certifications!.join(", ")}</span>
                                  </div>
                                )}
                                {(supplier.green_flags ?? []).length > 0 && (
                                  <div>
                                    <span className="text-green-600">+{supplier.green_flags!.length} green flag{supplier.green_flags!.length > 1 ? "s" : ""}</span>
                                  </div>
                                )}
                                {(supplier.red_flags ?? []).length > 0 && (
                                  <div>
                                    <span className="text-red-500">-{supplier.red_flags!.length} red flag{supplier.red_flags!.length > 1 ? "s" : ""}</span>
                                  </div>
                                )}
                              </div>
                              {/* Arrow */}
                              <div className="absolute left-3 top-full w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-border" />
                            </div>
                          )}
                        </div>
                      )
                    })()}
                  </TableCell>
                  <TableCell className="capitalize text-sm">
                    {typeof supplier.manufacturer_confidence === "number"
                      ? `${Math.round(supplier.manufacturer_confidence * 100)}%`
                      : supplier.manufacturer_confidence ?? "\u2014"}
                  </TableCell>
                  <TableCell className="capitalize text-sm">
                    {supplier.source_platform?.replace(/_/g, " ") ?? "\u2014"}
                  </TableCell>
                  {(onSave || onDismiss) && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1.5">
                        {onSave && (
                          <Button
                            size="sm"
                            variant={isSaved ? "secondary" : "default"}
                            disabled={isSaved || isSaving}
                            onClick={() => handleSave(supplier, idx)}
                          >
                            {isSaving ? "Saving..." : isSaved ? "Saved" : "Save"}
                          </Button>
                        )}
                        {onDismiss && !isSaved && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() => onDismiss(idx)}
                          >
                            <X className="size-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>

                {isExpanded && (
                  <TableRow>
                    <TableCell colSpan={(onSave || onDismiss) ? 7 : 6} className="bg-muted/30 p-4 whitespace-normal">
                      <div className="space-y-3 max-w-full overflow-hidden">
                        {supplier.ai_summary && (
                          <div>
                            <h4 className="text-sm font-semibold">AI Summary</h4>
                            <p className="mt-1 text-sm text-muted-foreground break-words whitespace-normal">
                              {supplier.ai_summary}
                            </p>
                          </div>
                        )}
                        {supplier.red_flags && supplier.red_flags.length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold">Red Flags</h4>
                            <ul className="mt-1 list-inside list-disc text-sm text-red-600">
                              {supplier.red_flags.map((flag, fi) => (
                                <li key={fi}>{flag}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {supplier.green_flags && supplier.green_flags.length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold">Green Flags</h4>
                            <ul className="mt-1 list-inside list-disc text-sm text-green-600">
                              {supplier.green_flags.map((flag, fi) => (
                                <li key={fi}>{flag}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {supplier.source_url && (
                          <div>
                            <h4 className="text-sm font-semibold">Source URL</h4>
                            <a
                              href={supplier.source_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-1 text-sm text-blue-600 underline break-all"
                            >
                              {supplier.source_url}
                            </a>
                          </div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

export default function DiscoverPage() {
  const [materials, setMaterials] = useState<Material[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [materialsLoaded, setMaterialsLoaded] = useState(false)

  // Job-based discovery state
  const [activeJobId, setActiveJobId] = useState<string | null>(null)
  const [jobStatus, setJobStatus] = useState<DiscoveryJob["status"] | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Current run results (latest active/just-completed)
  const [currentResults, setCurrentResults] = useState<DiscoveredSupplier[]>([])
  const [currentJobMeta, setCurrentJobMeta] = useState<DiscoveryJob | null>(null)
  const [dismissedCurrentIndices, setDismissedCurrentIndices] = useState<Set<number>>(new Set())

  // History
  const [pastJobs, setPastJobs] = useState<DiscoveryJob[]>([])
  const [expandedJobIds, setExpandedJobIds] = useState<Set<string>>(new Set())

  // Load materials on mount
  const fetchMaterials = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/sourcing/materials")
      if (!res.ok) throw new Error("Failed to fetch materials")
      const data: Material[] = await res.json()
      setMaterials(data)
      setMaterialsLoaded(true)
    } catch {
      toast.error("Failed to load materials")
    } finally {
      setLoading(false)
    }
  }, [])

  if (!materialsLoaded && !loading) {
    fetchMaterials()
  }

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch("/api/sourcing/agents/discover")
      if (!res.ok) return
      const jobs: DiscoveryJob[] = await res.json()

      const active = jobs.find((j) => j.status === "pending" || j.status === "running")
      if (active) {
        setActiveJobId(active.id)
        setJobStatus(active.status)
        setCurrentJobMeta(active)
      }

      // Most recent completed job becomes current results if no active
      if (!active) {
        const completed = jobs.find((j) => j.status === "completed")
        if (completed?.results) {
          setCurrentResults(completed.results)
          setCurrentJobMeta(completed)
        }
        // All jobs except the current one go into history
        const history = jobs.filter((j) => j.id !== completed?.id)
        setPastJobs(history)
      } else {
        // All completed/failed jobs go into history
        const history = jobs.filter((j) => j.id !== active.id)
        setPastJobs(history)
      }
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    fetchJobs()
  }, [fetchJobs])

  // Poll for job status when we have an active job
  useEffect(() => {
    if (!activeJobId) return

    function pollJob() {
      pollRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/sourcing/agents/discover?id=${activeJobId}`)
          if (!res.ok) return
          const job: DiscoveryJob = await res.json()
          setJobStatus(job.status)

          if (job.status === "completed") {
            clearInterval(pollRef.current!)
            pollRef.current = null
            setCurrentResults(job.results ?? [])
            setCurrentJobMeta(job)
            setActiveJobId(null)
            toast.success(`Discovery complete! Found ${job.results?.length ?? 0} suppliers.`)
            // Refresh the full job list so history updates
            fetchJobs()
          } else if (job.status === "failed") {
            clearInterval(pollRef.current!)
            pollRef.current = null
            setActiveJobId(null)
            toast.error(job.error ?? "Discovery failed")
            fetchJobs()
          }
        } catch {
          // ignore transient errors, keep polling
        }
      }, 3000)
    }

    pollJob()
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [activeJobId, fetchJobs])

  const grouped = materials.reduce<Record<MaterialCategory, Material[]>>(
    (acc, m) => {
      if (!acc[m.category]) acc[m.category] = []
      acc[m.category].push(m)
      return acc
    },
    {} as Record<MaterialCategory, Material[]>
  )

  function toggleMaterial(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function startDiscovery() {
    // Move current results to history
    if (currentJobMeta) {
      setPastJobs((prev) => [currentJobMeta!, ...prev.filter((j) => j.id !== currentJobMeta!.id)])
    }
    setCurrentResults([])
    setCurrentJobMeta(null)
    setDismissedCurrentIndices(new Set())

    try {
      const res = await fetch("/api/sourcing/agents/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ materialIds: Array.from(selectedIds) }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Discovery failed")
      }

      const job: DiscoveryJob = await res.json()
      setActiveJobId(job.id)
      setJobStatus(job.status)
      setCurrentJobMeta(job)
      toast.success("Discovery started! You can navigate away safely.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Discovery failed")
    }
  }

  async function saveSupplier(supplier: DiscoveredSupplier) {
    const res = await fetch("/api/sourcing/suppliers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        company_name: supplier.company_name,
        company_name_cn: supplier.company_name_cn ?? null,
        source_platform: supplier.source_platform ?? "direct",
        source_url: supplier.source_url ?? null,
        location_city: supplier.location_city ?? "Unknown",
        location_province: supplier.location_province ?? "Unknown",
        primary_materials: supplier.primary_materials ?? [],
        certifications: supplier.certifications ?? [],
        moq_range: supplier.moq_range ?? null,
        pipeline_status: "identified",
        priority_score: supplier.relevance_score ?? supplier.score ?? 5,
        ai_summary: supplier.ai_summary ?? null,
      }),
    })
    if (!res.ok) throw new Error("Failed to save supplier")
    toast.success(`${supplier.company_name} saved to database`)
  }

  const categoryLabel = (cat: string) =>
    cat.charAt(0).toUpperCase() + cat.slice(1).replace(/_/g, " ")

  const isDiscovering = jobStatus === "pending" || jobStatus === "running"

  function toggleJobExpanded(jobId: string) {
    setExpandedJobIds((prev) => {
      const next = new Set(prev)
      if (next.has(jobId)) next.delete(jobId)
      else next.add(jobId)
      return next
    })
  }

  const completedPastJobs = pastJobs.filter((j) => j.status === "completed" || j.status === "failed")

  return (
    <div className="min-w-0 max-w-full space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Discover Suppliers</h1>
        <p className="mt-1 text-muted-foreground">
          Select the materials you need to source and let the AI agent find matching suppliers from
          global platforms.
        </p>
      </div>

      {/* Step 1: Material Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Step 1: Select Materials</CardTitle>
          <CardDescription>Choose which materials to search for suppliers</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading materials...</p>
          ) : materials.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No materials found. Add materials in the Materials page first.
            </p>
          ) : (
            <div className="space-y-4">
              {Object.entries(grouped).map(([category, items]) => (
                <div key={category}>
                  <h3 className="mb-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    {categoryLabel(category)}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {items.map((m) => (
                      <label
                        key={m.id}
                        className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                          selectedIds.has(m.id)
                            ? "border-primary bg-primary/5 text-primary"
                            : "border-border hover:bg-muted"
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="accent-primary"
                          checked={selectedIds.has(m.id)}
                          onChange={() => toggleMaterial(m.id)}
                        />
                        <span>{m.name}</span>
                        {m.priority === "high" && (
                          <Badge variant="destructive" className="text-xs">
                            High
                          </Badge>
                        )}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6">
            <Button onClick={startDiscovery} disabled={selectedIds.size === 0 || isDiscovering}>
              {isDiscovering ? (
                <>
                  <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Discovering...
                </>
              ) : (
                "Start Discovery"
              )}
            </Button>
            {isDiscovering && (
              <p className="mt-2 text-sm text-muted-foreground">
                Discovery is running in the background. You can navigate to other pages and come back
                - results will be here when it finishes.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Progress spinner */}
      {isDiscovering && currentResults.length === 0 && (
        <Card>
          <CardContent className="py-8">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <p className="text-sm text-muted-foreground">
                AI agent is searching the web for suppliers. This usually takes 60-90 seconds...
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Current Results */}
      {currentResults.length > 0 && currentJobMeta && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  Latest Discovery Results
                  <Badge className="ml-1" variant="secondary">
                    {currentResults.filter((_, i) => !dismissedCurrentIndices.has(i)).length} found
                    {dismissedCurrentIndices.size > 0 && ` (${dismissedCurrentIndices.size} dismissed)`}
                  </Badge>
                </CardTitle>
                <CardDescription className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="flex items-center gap-1">
                    <Clock className="size-3.5" />
                    {formatDate(currentJobMeta.created_at)}
                  </span>
                  {currentJobMeta.started_at && currentJobMeta.completed_at && (
                    <span className="text-xs">
                      Duration: {formatDuration(currentJobMeta.started_at, currentJobMeta.completed_at)}
                    </span>
                  )}
                  {currentJobMeta.material_names && currentJobMeta.material_names.length > 0 && (
                    <span className="flex flex-wrap items-center gap-1">
                      Materials:{" "}
                      {currentJobMeta.material_names.map((name) => (
                        <Badge key={name} variant="outline" className="text-xs">
                          {name}
                        </Badge>
                      ))}
                    </span>
                  )}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <SupplierResultsTable
              results={currentResults.filter((_, i) => !dismissedCurrentIndices.has(i))}
              onSave={saveSupplier}
              onDismiss={(filteredIdx) => {
                // Map filtered index back to original index
                const visibleIndices = currentResults
                  .map((_, i) => i)
                  .filter((i) => !dismissedCurrentIndices.has(i))
                const originalIdx = visibleIndices[filteredIdx]
                if (originalIdx !== undefined) {
                  setDismissedCurrentIndices((prev) => new Set(prev).add(originalIdx))
                }
              }}
            />
          </CardContent>
        </Card>
      )}

      {/* Previous Runs History */}
      {completedPastJobs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="size-5" />
              Previous Discovery Runs
              <Badge variant="secondary" className="ml-1">
                {completedPastJobs.length}
              </Badge>
            </CardTitle>
            <CardDescription>
              Results from your earlier discovery runs
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {completedPastJobs.map((job) => {
              const isExpanded = expandedJobIds.has(job.id)
              const resultCount = job.results?.length ?? 0

              return (
                <div
                  key={job.id}
                  className="rounded-lg border"
                >
                  {/* Collapsible Header */}
                  <button
                    className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors"
                    onClick={() => toggleJobExpanded(job.id)}
                  >
                    {isExpanded ? (
                      <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                    )}

                    <StatusIcon status={job.status} />

                    <div className="flex flex-1 flex-wrap items-center gap-x-3 gap-y-1 min-w-0">
                      {/* Material names */}
                      <span className="text-sm font-medium">
                        {job.material_names && job.material_names.length > 0
                          ? job.material_names.join(", ")
                          : `${(job.material_ids ?? []).length} material(s)`}
                      </span>

                      <StatusBadge status={job.status} />

                      {job.status === "completed" && (
                        <span className="text-xs text-muted-foreground">
                          {resultCount} supplier{resultCount !== 1 ? "s" : ""} found
                        </span>
                      )}

                      {job.status === "failed" && job.error && (
                        <span className="text-xs text-red-500 truncate max-w-[200px]">
                          {job.error}
                        </span>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                      {job.started_at && job.completed_at && (
                        <span>{formatDuration(job.started_at, job.completed_at)}</span>
                      )}
                      <span>{formatDate(job.created_at)}</span>
                    </div>
                  </button>

                  {/* Expanded Content */}
                  {isExpanded && job.results && job.results.length > 0 && (
                    <div className="border-t px-4 py-3">
                      <SupplierResultsTable results={job.results} onSave={saveSupplier} />
                    </div>
                  )}

                  {isExpanded && job.status === "failed" && (
                    <div className="border-t px-4 py-3">
                      <p className="text-sm text-red-500">{job.error ?? "Unknown error"}</p>
                    </div>
                  )}

                  {isExpanded && job.status === "completed" && (!job.results || job.results.length === 0) && (
                    <div className="border-t px-4 py-3">
                      <p className="text-sm text-muted-foreground">No suppliers were found in this run.</p>
                    </div>
                  )}
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
