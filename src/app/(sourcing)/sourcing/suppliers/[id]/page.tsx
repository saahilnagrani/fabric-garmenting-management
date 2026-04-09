"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeftIcon,
  ExternalLinkIcon,
  MailIcon,
  RefreshCwIcon,
  Trash2Icon,
} from "lucide-react";

type Supplier = {
  id: string;
  company_name: string;
  company_name_cn: string | null;
  source_platform:
    | "alibaba"
    | "made_in_china"
    | "global_sources"
    | "direct"
    | "referral";
  source_url: string | null;
  location_city: string;
  location_province: string;
  primary_materials: string[];
  certifications: string[];
  moq_range: string | null;
  estimated_annual_revenue: string | null;
  employee_count: string | null;
  year_established: number | null;
  exports_to_india: boolean | null;
  contact_person: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  contact_wechat: string | null;
  pipeline_status: string;
  priority_score: number | null;
  notes: string | null;
  ai_summary: string | null;
  created_at: string;
  updated_at: string;
};

type Outreach = {
  id: string;
  supplier_id: string;
  email_type: string;
  subject: string;
  body_html: string;
  body_text: string;
  language: string;
  tone: string;
  status: string;
  sent_at: string | null;
  created_at: string;
};

const PIPELINE_STATUSES = [
  "identified",
  "researching",
  "contacted",
  "responded",
  "sampling",
  "approved",
  "rejected",
  "on_hold",
] as const;

const STATUS_COLORS: Record<string, string> = {
  identified: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  researching: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  contacted:
    "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  responded:
    "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  sampling:
    "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  approved:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  on_hold:
    "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className={`border-transparent ${STATUS_COLORS[status] ?? ""}`}
    >
      {status.replace(/_/g, " ")}
    </Badge>
  );
}

export default function SupplierDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [outreach, setOutreach] = useState<Outreach[]>([]);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const fetchSupplier = useCallback(async () => {
    try {
      const res = await fetch(`/api/sourcing/suppliers/${id}`);
      if (res.ok) {
        const data = await res.json();
        setSupplier(data);
        setNotes(data.notes ?? "");
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchOutreach = useCallback(async () => {
    try {
      const res = await fetch(`/api/sourcing/outreach?supplier_id=${id}`);
      if (res.ok) {
        const data = await res.json();
        setOutreach(Array.isArray(data) ? data : data.outreach ?? []);
      }
    } catch {
      // silently fail
    }
  }, [id]);

  useEffect(() => {
    fetchSupplier();
    fetchOutreach();
  }, [fetchSupplier, fetchOutreach]);

  async function handleSaveNotes() {
    setSavingNotes(true);
    try {
      await fetch(`/api/sourcing/suppliers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      fetchSupplier();
    } catch {
      // silently fail
    } finally {
      setSavingNotes(false);
    }
  }

  async function handleStatusChange(newStatus: string) {
    setUpdatingStatus(true);
    try {
      await fetch(`/api/sourcing/suppliers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pipeline_status: newStatus }),
      });
      fetchSupplier();
    } catch {
      // silently fail
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/sourcing/suppliers/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        router.push("/sourcing/suppliers");
      }
    } catch {
      // silently fail
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  async function handleRescore() {
    try {
      await fetch(`/api/sourcing/suppliers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rescore: true }),
      });
      fetchSupplier();
    } catch {
      // silently fail
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-muted-foreground">
        Loading supplier...
      </div>
    );
  }

  if (!supplier) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-12">
        <p className="text-muted-foreground">Supplier not found.</p>
        <Button variant="outline" onClick={() => router.push("/sourcing/suppliers")}>
          <ArrowLeftIcon data-icon="inline-start" />
          Back to Suppliers
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <Link
          href="/sourcing/suppliers"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
        >
          <ArrowLeftIcon className="size-4" />
          Back to Suppliers
        </Link>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold tracking-tight">
            {supplier.company_name}
          </h1>
          <StatusBadge status={supplier.pipeline_status} />
          {supplier.priority_score != null && (
            <Badge variant="outline">
              Priority: {supplier.priority_score}
            </Badge>
          )}
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* LEFT COLUMN */}
        <div className="flex flex-col gap-6">
          {/* Company Info */}
          <Card>
            <CardHeader>
              <CardTitle>Company Info</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-3 text-sm">
                <div className="grid grid-cols-[140px_1fr] items-start">
                  <dt className="text-muted-foreground">Company Name</dt>
                  <dd>{supplier.company_name}</dd>
                </div>
                {supplier.company_name_cn && (
                  <div className="grid grid-cols-[140px_1fr] items-start">
                    <dt className="text-muted-foreground">Chinese Name</dt>
                    <dd>{supplier.company_name_cn}</dd>
                  </div>
                )}
                <div className="grid grid-cols-[140px_1fr] items-start">
                  <dt className="text-muted-foreground">Location</dt>
                  <dd>
                    {supplier.location_city}
                    {supplier.location_province
                      ? `, ${supplier.location_province}`
                      : ""}
                  </dd>
                </div>
                {supplier.year_established && (
                  <div className="grid grid-cols-[140px_1fr] items-start">
                    <dt className="text-muted-foreground">Year Established</dt>
                    <dd>{supplier.year_established}</dd>
                  </div>
                )}
                {supplier.employee_count && (
                  <div className="grid grid-cols-[140px_1fr] items-start">
                    <dt className="text-muted-foreground">Employees</dt>
                    <dd>{supplier.employee_count}</dd>
                  </div>
                )}
                <div className="grid grid-cols-[140px_1fr] items-start">
                  <dt className="text-muted-foreground">Source Platform</dt>
                  <dd className="capitalize">
                    {supplier.source_platform.replace(/_/g, " ")}
                  </dd>
                </div>
                {supplier.source_url && (
                  <div className="grid grid-cols-[140px_1fr] items-start">
                    <dt className="text-muted-foreground">Source URL</dt>
                    <dd>
                      <a
                        href={supplier.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        Visit
                        <ExternalLinkIcon className="size-3" />
                      </a>
                    </dd>
                  </div>
                )}
                {supplier.moq_range && (
                  <div className="grid grid-cols-[140px_1fr] items-start">
                    <dt className="text-muted-foreground">MOQ Range</dt>
                    <dd>{supplier.moq_range}</dd>
                  </div>
                )}
              </dl>
            </CardContent>
          </Card>

          {/* Materials */}
          <Card>
            <CardHeader>
              <CardTitle>Materials</CardTitle>
            </CardHeader>
            <CardContent>
              {supplier.primary_materials.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {supplier.primary_materials.map((m) => (
                    <Badge key={m} variant="secondary">
                      {m}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No materials listed.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Certifications */}
          <Card>
            <CardHeader>
              <CardTitle>Certifications</CardTitle>
            </CardHeader>
            <CardContent>
              {supplier.certifications.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {supplier.certifications.map((c) => (
                    <Badge key={c} variant="outline">
                      {c}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No certifications listed.
                </p>
              )}
            </CardContent>
          </Card>

          {/* AI Summary */}
          {supplier.ai_summary && (
            <Card>
              <CardHeader>
                <CardTitle>AI Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {supplier.ai_summary}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Notes */}
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes about this supplier..."
                className="min-h-[100px]"
              />
              <Button
                variant="outline"
                className="self-end"
                onClick={handleSaveNotes}
                disabled={savingNotes}
              >
                {savingNotes ? "Saving..." : "Save Notes"}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN */}
        <div className="flex flex-col gap-6">
          {/* Contact */}
          <Card>
            <CardHeader>
              <CardTitle>Contact</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-2.5 text-sm">
                {supplier.contact_person && (
                  <div>
                    <dt className="text-muted-foreground text-xs">Person</dt>
                    <dd>{supplier.contact_person}</dd>
                  </div>
                )}
                {supplier.contact_email && (
                  <div>
                    <dt className="text-muted-foreground text-xs">Email</dt>
                    <dd>
                      <a
                        href={`mailto:${supplier.contact_email}`}
                        className="text-primary hover:underline"
                      >
                        {supplier.contact_email}
                      </a>
                    </dd>
                  </div>
                )}
                {supplier.contact_phone && (
                  <div>
                    <dt className="text-muted-foreground text-xs">Phone</dt>
                    <dd>{supplier.contact_phone}</dd>
                  </div>
                )}
                {supplier.contact_wechat && (
                  <div>
                    <dt className="text-muted-foreground text-xs">WeChat</dt>
                    <dd>{supplier.contact_wechat}</dd>
                  </div>
                )}
                {!supplier.contact_person &&
                  !supplier.contact_email &&
                  !supplier.contact_phone &&
                  !supplier.contact_wechat && (
                    <p className="text-muted-foreground">
                      No contact information.
                    </p>
                  )}
              </dl>
            </CardContent>
          </Card>

          {/* Pipeline */}
          <Card>
            <CardHeader>
              <CardTitle>Pipeline Status</CardTitle>
            </CardHeader>
            <CardContent>
              <Label htmlFor="pipeline-status" className="mb-2">
                Change Status
              </Label>
              <select
                id="pipeline-status"
                value={supplier.pipeline_status}
                onChange={(e) => handleStatusChange(e.target.value)}
                disabled={updatingStatus}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 capitalize"
              >
                {PIPELINE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </CardContent>
          </Card>

          {/* Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() =>
                  router.push(`/outreach?supplier=${supplier.id}`)
                }
              >
                <MailIcon data-icon="inline-start" />
                Generate Email
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={handleRescore}
              >
                <RefreshCwIcon data-icon="inline-start" />
                Re-score
              </Button>
              <Separator />
              {showDeleteConfirm ? (
                <div className="flex flex-col gap-2">
                  <p className="text-sm text-destructive">
                    Are you sure you want to delete this supplier? This action
                    cannot be undone.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleDelete}
                      disabled={deleting}
                    >
                      {deleting ? "Deleting..." : "Confirm Delete"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowDeleteConfirm(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="destructive"
                  className="w-full justify-start"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <Trash2Icon data-icon="inline-start" />
                  Delete Supplier
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Outreach History */}
          <Card>
            <CardHeader>
              <CardTitle>Outreach History</CardTitle>
            </CardHeader>
            <CardContent>
              {outreach.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No outreach records yet.
                </p>
              ) : (
                <div className="flex flex-col gap-3">
                  {outreach.map((o) => (
                    <div
                      key={o.id}
                      className="flex flex-col gap-1 rounded-lg border p-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium capitalize">
                          {o.email_type.replace(/_/g, " ")}
                        </span>
                        <Badge
                          variant={
                            o.status === "sent" ? "default" : "secondary"
                          }
                          className="text-xs"
                        >
                          {o.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {o.subject}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {o.sent_at
                          ? new Date(o.sent_at).toLocaleDateString()
                          : new Date(o.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
