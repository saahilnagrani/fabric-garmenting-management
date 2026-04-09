"use client"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Separator } from "@/components/ui/separator"
import { Info, Search, BarChart3, ArrowRight } from "lucide-react"

const DISCOVERY_CRITERIA = [
  {
    factor: "Material Match",
    description:
      "Exact alignment between the supplier's primary materials and your material requirements (type, GSM, composition).",
    impact: "High",
  },
  {
    factor: "Manufacturer Confidence",
    description:
      "Whether the supplier is a genuine manufacturer vs. a trading company. Based on factory photos, employee count, production capacity, and product focus.",
    impact: "High",
  },
  {
    factor: "Certifications",
    description:
      "Presence of required certifications such as OEKO-TEX, GOTS, ISO 9001, or other industry-specific standards.",
    impact: "High",
  },
  {
    factor: "Export History",
    description:
      "Prior experience exporting to India or South Asia. Suppliers with existing India trade routes score higher.",
    impact: "Medium",
  },
  {
    factor: "Platform Verification",
    description:
      "Whether the supplier has verified/audited profiles on sourcing platforms (Alibaba Gold, Made-in-China Audited).",
    impact: "Medium",
  },
  {
    factor: "MOQ Compatibility",
    description:
      "Alignment between the supplier's minimum order quantity and your estimated annual volume needs.",
    impact: "Medium",
  },
  {
    factor: "Red Flags",
    description:
      "Negative signals such as very new accounts, no verifications, inconsistent product ranges, or prices too low to be legitimate.",
    impact: "Negative",
  },
  {
    factor: "Green Flags",
    description:
      "Positive indicators like factory address distinct from sales office, specific production capacity, R&D capability, and trade show participation.",
    impact: "Positive",
  },
]

const PRIORITY_CRITERIA = [
  { criterion: "Material Match", weight: "25%", maxScore: 10, description: "Exact material type, specifications, and composition alignment with your requirements." },
  { criterion: "Certifications", weight: "20%", maxScore: 10, description: "Required certifications held (OEKO-TEX, GOTS, ISO 9001, etc.)." },
  { criterion: "MOQ Fit", weight: "15%", maxScore: 10, description: "Minimum order quantity compatibility with your volume estimates." },
  { criterion: "Reliability Signals", weight: "15%", maxScore: 10, description: "Years in business, platform verification status, transaction history, and audit records." },
  { criterion: "Export Experience", weight: "10%", maxScore: 10, description: "Prior export history to India or South Asia region." },
  { criterion: "Communication Readiness", weight: "10%", maxScore: 10, description: "English language capability, available contact channels, and response quality." },
  { criterion: "Pricing Position", weight: "5%", maxScore: 10, description: "Cost competitiveness relative to your target price range." },
]

const TRADING_COMPANY_FLAGS = [
  "Very broad product range spanning unrelated categories",
  "No factory photos or production line images",
  "Small employee count (under 20) combined with high claimed capacity",
  'Company name includes "trading", "import/export", or "international commerce"',
  "Located in a major port city with no factory address",
  "Stock photos or generic product images",
  "Multiple brand names with no OEM/ODM mention",
  "Very new company (under 2 years) claiming extensive experience",
]

const MANUFACTURER_SIGNALS = [
  "Factory address distinct from sales office",
  "Production capacity stated in specific units (e.g., 500,000 meters/month)",
  "Equipment and machinery listed or shown in photos",
  "Quality control process described",
  "R&D capability or custom development services",
  "Single or closely related product categories",
  "Industry-specific certifications",
  "Trade show participation history",
]

function ImpactBadge({ impact }: { impact: string }) {
  const styles: Record<string, string> = {
    High: "bg-red-100 text-red-800",
    Medium: "bg-yellow-100 text-yellow-800",
    Low: "bg-gray-100 text-gray-700",
    Positive: "bg-green-100 text-green-800",
    Negative: "bg-red-100 text-red-800",
  }
  return (
    <Badge variant="outline" className={`border-transparent text-xs ${styles[impact] ?? ""}`}>
      {impact}
    </Badge>
  )
}

export default function ScoringMethodologyPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Scoring Methodology</h1>
        <p className="mt-1 text-muted-foreground">
          How supplier scores are calculated across the platform. All scores are AI-generated using
          Claude with web search and structured evaluation criteria.
        </p>
      </div>

      {/* Score Types Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="size-5" />
            Score Types Overview
          </CardTitle>
          <CardDescription>
            There are two distinct scoring stages in the supplier evaluation pipeline
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Search className="size-4 text-blue-600" />
                <h3 className="font-semibold text-sm">Discovery Relevance Score</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Assigned during supplier discovery. A quick assessment (1-10) of how well a
                discovered supplier matches your material needs.
              </p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline" className="text-xs">1-10</Badge>
                <span>Generated during web search</span>
              </div>
            </div>

            <div className="rounded-lg border p-4 space-y-2">
              <div className="flex items-center gap-2">
                <BarChart3 className="size-4 text-purple-600" />
                <h3 className="font-semibold text-sm">Priority Score (Weighted)</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                A detailed evaluation using 7 weighted criteria. Run on-demand from the supplier
                detail page for deeper analysis.
              </p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline" className="text-xs">1-10</Badge>
                <span>7 weighted criteria</span>
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <span className="rounded bg-blue-50 px-2 py-1 font-medium text-blue-700">Discovery</span>
            <ArrowRight className="size-3" />
            <span className="rounded bg-muted px-2 py-1">Save to DB</span>
            <ArrowRight className="size-3" />
            <span className="rounded bg-purple-50 px-2 py-1 font-medium text-purple-700">Priority Scoring</span>
            <ArrowRight className="size-3" />
            <span className="rounded bg-muted px-2 py-1">Outreach</span>
          </div>
        </CardContent>
      </Card>

      {/* Discovery Relevance Score */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="size-5 text-blue-600" />
            Discovery Relevance Score
          </CardTitle>
          <CardDescription>
            Assigned when the AI agent discovers suppliers via web search. Provides a first-pass
            assessment to help you quickly identify promising leads.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h4 className="text-sm font-semibold mb-3">Evaluation Factors</h4>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[25%]">Factor</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-[10%]">Impact</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {DISCOVERY_CRITERIA.map((c) => (
                  <TableRow key={c.factor}>
                    <TableCell className="font-medium whitespace-normal">{c.factor}</TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-normal">
                      {c.description}
                    </TableCell>
                    <TableCell>
                      <ImpactBadge impact={c.impact} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <Separator />

          <div>
            <h4 className="text-sm font-semibold mb-2">Score Interpretation</h4>
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="flex items-center gap-2 rounded-lg border p-3">
                <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800">
                  7-10
                </span>
                <span className="text-sm">Strong match, prioritize</span>
              </div>
              <div className="flex items-center gap-2 rounded-lg border p-3">
                <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-semibold text-yellow-800">
                  4-6
                </span>
                <span className="text-sm">Moderate fit, investigate</span>
              </div>
              <div className="flex items-center gap-2 rounded-lg border p-3">
                <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-800">
                  1-3
                </span>
                <span className="text-sm">Weak match, likely skip</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Priority Score (Weighted) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="size-5 text-purple-600" />
            Priority Score (Weighted Evaluation)
          </CardTitle>
          <CardDescription>
            A deeper, structured assessment of saved suppliers. Uses 7 weighted criteria to produce a
            composite score for prioritizing outreach.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h4 className="text-sm font-semibold mb-3">Weighted Criteria</h4>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[20%]">Criterion</TableHead>
                  <TableHead className="w-[10%]">Weight</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {PRIORITY_CRITERIA.map((c) => (
                  <TableRow key={c.criterion}>
                    <TableCell className="font-medium whitespace-normal">{c.criterion}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs font-mono">
                        {c.weight}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-normal">
                      {c.description}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <Separator />

          <div>
            <h4 className="text-sm font-semibold mb-2">Formula</h4>
            <div className="rounded-lg bg-muted/50 border p-4 font-mono text-xs leading-relaxed overflow-x-auto">
              <p className="whitespace-normal break-words">
                Overall Score = (Material Match x 0.25) + (Certifications x 0.20) + (MOQ Fit x 0.15)
                + (Reliability x 0.15) + (Export Experience x 0.10) + (Communication x 0.10) +
                (Pricing x 0.05)
              </p>
            </div>
          </div>

          <Separator />

          <div>
            <h4 className="text-sm font-semibold mb-2">Recommendation Thresholds</h4>
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="flex items-center gap-2 rounded-lg border p-3">
                <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800">
                  7.0+
                </span>
                <div>
                  <p className="text-sm font-medium">Proceed</p>
                  <p className="text-xs text-muted-foreground">Strong candidate for outreach</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-lg border p-3">
                <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-semibold text-yellow-800">
                  4.0-6.9
                </span>
                <div>
                  <p className="text-sm font-medium">Investigate Further</p>
                  <p className="text-xs text-muted-foreground">Needs more data before decision</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-lg border p-3">
                <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-800">
                  &lt; 4.0
                </span>
                <div>
                  <p className="text-sm font-medium">Skip</p>
                  <p className="text-xs text-muted-foreground">Poor fit, not recommended</p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <h4 className="text-sm font-semibold text-red-800 mb-1">Critical Red Flag Override</h4>
            <p className="text-sm text-red-700">
              If any critical red flags are detected (fraud indicators, sanctions, counterfeits,
              or trading companies masquerading as manufacturers), the recommendation is
              automatically set to &quot;Skip&quot; regardless of the overall numerical score.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Manufacturer vs Trading Company Signals */}
      <Card>
        <CardHeader>
          <CardTitle>Manufacturer vs. Trading Company Detection</CardTitle>
          <CardDescription>
            Both scoring stages evaluate whether a supplier is a genuine manufacturer. These signals
            are used to assess manufacturer confidence.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <h4 className="text-sm font-semibold text-red-700 mb-3">Trading Company Red Flags</h4>
              <ul className="space-y-2">
                {TRADING_COMPANY_FLAGS.map((flag, i) => (
                  <li key={i} className="flex gap-2 text-sm">
                    <span className="mt-0.5 shrink-0 text-red-500">&#x2022;</span>
                    <span className="text-muted-foreground">{flag}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-green-700 mb-3">
                Manufacturer Positive Signals
              </h4>
              <ul className="space-y-2">
                {MANUFACTURER_SIGNALS.map((signal, i) => (
                  <li key={i} className="flex gap-2 text-sm">
                    <span className="mt-0.5 shrink-0 text-green-600">&#x2022;</span>
                    <span className="text-muted-foreground">{signal}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
