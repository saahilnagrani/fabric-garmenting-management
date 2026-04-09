"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import Link from "next/link"
import {
  ArrowLeft,
  Trash2,
  Copy,
  Eye,
  EyeOff,
  Mail,
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
import { Separator } from "@/components/ui/separator"
import type { Outreach } from "@/types/sourcing"

interface DraftWithSupplier extends Outreach {
  supplier_name: string | null
}

const EMAIL_TYPE_LABELS: Record<string, string> = {
  initial: "Initial Contact",
  follow_up_1: "Follow-up",
  follow_up_2: "Follow-up 2",
  sample_request: "Sample Request",
  negotiation: "Negotiation",
}

const TONE_LABELS: Record<string, string> = {
  formal: "Formal",
  friendly_professional: "Friendly Professional",
  direct: "Direct",
}

export default function DraftsPage() {
  const [drafts, setDrafts] = useState<DraftWithSupplier[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchDrafts = useCallback(async () => {
    try {
      const res = await fetch("/api/sourcing/outreach/drafts")
      if (!res.ok) throw new Error("Failed to fetch")
      const data: DraftWithSupplier[] = await res.json()
      setDrafts(data)
    } catch {
      toast.error("Failed to load drafts")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDrafts()
  }, [fetchDrafts])

  async function deleteDraft(id: string) {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/sourcing/outreach/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to delete")
      setDrafts((prev) => prev.filter((d) => d.id !== id))
      toast.success("Draft deleted")
    } catch {
      toast.error("Failed to delete draft")
    } finally {
      setDeletingId(null)
    }
  }

  function copyToClipboard(draft: DraftWithSupplier) {
    const text = `Subject: ${draft.subject}\n\n${draft.body_text}`
    navigator.clipboard.writeText(text)
    toast.success("Copied to clipboard")
  }

  function toggleExpanded(id: string) {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/sourcing/outreach">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Email Drafts
          </h1>
          <p className="mt-1 text-muted-foreground">
            Review, copy, or delete saved email drafts
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-[300px] items-center justify-center">
          <p className="text-muted-foreground">Loading drafts...</p>
        </div>
      ) : drafts.length === 0 ? (
        <Card>
          <CardContent className="flex min-h-[300px] flex-col items-center justify-center gap-3">
            <Mail className="size-10 text-muted-foreground/50" />
            <p className="text-center text-muted-foreground">
              No drafts saved yet.
              <br />
              Generate an email and click &quot;Save as Draft&quot; to see it here.
            </p>
            <Link href="/sourcing/outreach">
              <Button variant="outline">Go to Email Generator</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {drafts.map((draft) => {
            const isExpanded = expandedId === draft.id
            return (
              <Card key={draft.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-base leading-snug">
                        {draft.subject}
                      </CardTitle>
                      <CardDescription className="mt-1 flex flex-wrap items-center gap-2">
                        <span>{draft.supplier_name ?? "Unknown Supplier"}</span>
                        <span className="text-muted-foreground/50">&middot;</span>
                        <span>{formatDate(draft.created_at)}</span>
                      </CardDescription>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Badge variant="outline">
                        {EMAIL_TYPE_LABELS[draft.email_type] ?? draft.email_type}
                      </Badge>
                      <Badge variant="secondary">
                        {TONE_LABELS[draft.tone] ?? draft.tone}
                      </Badge>
                      {draft.language === "zh" && (
                        <Badge variant="secondary">Bilingual</Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  {/* Preview / expanded body */}
                  {isExpanded ? (
                    <div
                      className="prose prose-sm max-w-none rounded-md border bg-muted/30 p-4"
                      dangerouslySetInnerHTML={{ __html: draft.body_html }}
                    />
                  ) : (
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {draft.body_text.slice(0, 200)}
                      {draft.body_text.length > 200 ? "..." : ""}
                    </p>
                  )}

                  <Separator />

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleExpanded(draft.id)}
                    >
                      {isExpanded ? (
                        <>
                          <EyeOff className="mr-1.5 size-3.5" />
                          Collapse
                        </>
                      ) : (
                        <>
                          <Eye className="mr-1.5 size-3.5" />
                          Preview
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(draft)}
                    >
                      <Copy className="mr-1.5 size-3.5" />
                      Copy
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => deleteDraft(draft.id)}
                      disabled={deletingId === draft.id}
                    >
                      <Trash2 className="mr-1.5 size-3.5" />
                      {deletingId === draft.id ? "Deleting..." : "Delete"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
