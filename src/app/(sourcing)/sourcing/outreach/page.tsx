"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import Link from "next/link"
import { FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import type { Supplier } from "@/types/sourcing"

interface GeneratedEmail {
  subject: string
  body_html: string
  body_text: string
  subject_cn?: string
  body_html_cn?: string
  body_text_cn?: string
}

const EMAIL_TYPES = [
  { value: "initial", label: "Initial Contact" },
  { value: "follow_up_1", label: "Follow-up" },
  { value: "sample_request", label: "Sample Request" },
  { value: "negotiation", label: "Negotiation" },
]

const TONES = [
  { value: "formal", label: "Formal" },
  { value: "friendly_professional", label: "Friendly Professional" },
  { value: "direct", label: "Direct" },
]

export default function OutreachPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [suppliersLoading, setSuppliersLoading] = useState(true)
  const [supplierId, setSupplierId] = useState("")
  const [emailType, setEmailType] = useState("")
  const [tone, setTone] = useState("")
  const [bilingual, setBilingual] = useState(false)

  const [generating, setGenerating] = useState(false)
  const [streamingText, setStreamingText] = useState("")
  const [email, setEmail] = useState<GeneratedEmail | null>(null)

  const [feedback, setFeedback] = useState("")
  const [saving, setSaving] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const fetchSuppliers = useCallback(async () => {
    try {
      const res = await fetch("/api/sourcing/suppliers")
      if (!res.ok) throw new Error("Failed to fetch")
      const data: Supplier[] = await res.json()
      setSuppliers(data)
    } catch {
      toast.error("Failed to load suppliers")
    } finally {
      setSuppliersLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSuppliers()
  }, [fetchSuppliers])

  async function generateEmail() {
    setGenerating(true)
    setEmail(null)
    setStreamingText("")

    abortRef.current = new AbortController()

    try {
      const res = await fetch("/api/sourcing/agents/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supplierId, emailType, tone, bilingual }),
        signal: abortRef.current.signal,
      })

      if (!res.ok) {
        let errMsg = "Failed to generate email"
        try {
          const err = await res.json()
          errMsg = err.error || errMsg
        } catch {
          // response might not be JSON
        }
        throw new Error(errMsg)
      }

      const reader = res.body?.getReader()
      if (!reader) throw new Error("No response stream")

      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          const jsonStr = line.slice(6).trim()
          if (!jsonStr) continue

          try {
            const data = JSON.parse(jsonStr)

            if (data.error) {
              throw new Error(data.error)
            }

            if (data.done && data.email) {
              setEmail(data.email)
              setStreamingText("")
            } else if (data.text) {
              setStreamingText((prev) => prev + data.text)
            }
          } catch (e) {
            if (e instanceof Error && e.message !== jsonStr) throw e
            // ignore parse errors for partial chunks
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        toast.error(err instanceof Error ? err.message : "Generation failed")
      }
    } finally {
      setGenerating(false)
      abortRef.current = null
    }
  }

  async function regenerateEmail() {
    await generateEmail()
    setFeedback("")
  }

  async function saveAsDraft() {
    if (!email) return
    setSaving(true)
    try {
      const res = await fetch("/api/sourcing/outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplier_id: supplierId,
          email_type: emailType,
          subject: email.subject,
          body_html: email.body_html,
          body_text: email.body_text,
          language: bilingual ? "zh" : "en",
          tone,
          status: "draft",
        }),
      })
      if (!res.ok) throw new Error("Failed to save draft")
      toast.success("Email saved as draft", {
        action: {
          label: "View Drafts",
          onClick: () => window.location.assign("/outreach/drafts"),
        },
      })
    } catch {
      toast.error("Failed to save draft")
    } finally {
      setSaving(false)
    }
  }

  function copyToClipboard() {
    if (!email) return
    const text = `Subject: ${email.subject}\n\n${email.body_text}${
      bilingual && email.body_text_cn
        ? `\n\n---\n\n${email.subject_cn ?? ""}\n\n${email.body_text_cn}`
        : ""
    }`
    navigator.clipboard.writeText(text)
    toast.success("Copied to clipboard")
  }

  function wordCount(text: string) {
    return text
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 0).length
  }

  const canGenerate = supplierId && emailType && tone

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Outreach Email Generator
          </h1>
          <p className="mt-1 text-muted-foreground">
            Generate personalized outreach emails for your suppliers using AI
          </p>
        </div>
        <Link href="/sourcing/outreach/drafts">
          <Button variant="outline">
            <FileText className="mr-1.5 size-4" />
            View Drafts
          </Button>
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        {/* LEFT PANEL: Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
            <CardDescription>
              Set up email generation parameters
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Supplier selector */}
            <div className="space-y-2">
              <Label>Supplier</Label>
              {suppliersLoading ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : (
                <Select value={supplierId} onValueChange={(v) => setSupplierId(v ?? "")}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a supplier">
                      {supplierId
                        ? suppliers.find((s) => s.id === supplierId)?.company_name ?? "Select a supplier"
                        : "Select a supplier"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent align="start">
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.company_name}
                      </SelectItem>
                    ))}
                    {suppliers.length === 0 && (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">
                        No suppliers found
                      </div>
                    )}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Email type */}
            <div className="space-y-2">
              <Label>Email Type</Label>
              <Select value={emailType} onValueChange={(v) => setEmailType(v ?? "initial")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select email type">
                    {emailType
                      ? EMAIL_TYPES.find((t) => t.value === emailType)?.label ?? "Select email type"
                      : "Select email type"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent align="start">
                  {EMAIL_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Tone */}
            <div className="space-y-2">
              <Label>Tone</Label>
              <Select value={tone} onValueChange={(v) => setTone(v ?? "friendly_professional")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select tone">
                    {tone
                      ? TONES.find((t) => t.value === tone)?.label ?? "Select tone"
                      : "Select tone"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent align="start">
                  {TONES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Bilingual toggle */}
            <div className="flex items-center justify-between">
              <Label htmlFor="bilingual-toggle">Bilingual (EN + CN)</Label>
              <Switch
                id="bilingual-toggle"
                checked={bilingual}
                onCheckedChange={setBilingual}
              />
            </div>

            <Button
              className="w-full"
              onClick={generateEmail}
              disabled={!canGenerate || generating}
            >
              {generating ? (
                <>
                  <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Generating...
                </>
              ) : (
                "Generate Email"
              )}
            </Button>
          </CardContent>
        </Card>

        {/* RIGHT PANEL: Email Preview */}
        <Card>
          <CardHeader>
            <CardTitle>Email Preview</CardTitle>
            <CardDescription>
              {email
                ? "Review and refine the generated email"
                : generating
                  ? "Generating email..."
                  : "Configure and generate an email to see preview"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Streaming preview */}
            {generating && !email && (
              <div className="min-h-[300px]">
                {streamingText ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Writing email...
                    </div>
                    <pre className="whitespace-pre-wrap text-sm font-mono text-muted-foreground bg-muted/30 rounded-lg p-4 max-h-[400px] overflow-y-auto">
                      {streamingText}
                    </pre>
                  </div>
                ) : (
                  <div className="flex min-h-[300px] flex-col items-center justify-center gap-3">
                    <div className="h-6 w-6 animate-spin rounded-full border-3 border-primary border-t-transparent" />
                    <p className="text-sm text-muted-foreground">
                      Preparing email with your company profile...
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Empty state */}
            {!email && !generating && (
              <div className="flex min-h-[300px] items-center justify-center text-muted-foreground">
                <p className="text-center text-sm">
                  No email generated yet.
                  <br />
                  Select a supplier and click Generate Email.
                </p>
              </div>
            )}

            {/* Generated email */}
            {email && (
              <div className="space-y-4">
                {/* Subject */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase">
                    Subject
                  </p>
                  <p className="mt-1 text-base font-bold">{email.subject}</p>
                </div>

                <Separator />

                {/* English body */}
                <div
                  className="prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: email.body_html }}
                />

                {/* Chinese section */}
                {bilingual && email.body_html_cn && (
                  <>
                    <Separator />
                    <div>
                      <p className="mb-2 text-xs font-medium text-muted-foreground uppercase">
                        Chinese Version
                      </p>
                      {email.subject_cn && (
                        <p className="mb-2 text-base font-bold">
                          {email.subject_cn}
                        </p>
                      )}
                      <div
                        className="prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{
                          __html: email.body_html_cn,
                        }}
                      />
                    </div>
                  </>
                )}

                <Separator />

                {/* Metadata row */}
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-xs text-muted-foreground">
                    {wordCount(email.body_text)} words
                  </span>
                  <Badge variant="outline">Personalized</Badge>
                </div>

                {/* Regenerate */}
                <div className="space-y-2">
                  <Textarea
                    placeholder="Optional feedback (e.g. make it shorter, more formal...)"
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    rows={2}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      onClick={regenerateEmail}
                      disabled={generating}
                    >
                      Regenerate
                    </Button>
                    <Button onClick={saveAsDraft} disabled={saving}>
                      {saving ? "Saving..." : "Save as Draft"}
                    </Button>
                    <Button variant="secondary" onClick={copyToClipboard}>
                      Copy to Clipboard
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
