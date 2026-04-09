"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  PlusIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  SearchIcon,
  GripVerticalIcon,
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

const SOURCE_PLATFORMS = [
  { value: "alibaba", label: "Alibaba" },
  { value: "made_in_china", label: "Made in China" },
  { value: "global_sources", label: "Global Sources" },
  { value: "direct", label: "Direct" },
  { value: "referral", label: "Referral" },
];

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

type SortField =
  | "company_name"
  | "location"
  | "pipeline_status"
  | "priority_score"
  | "source_platform";
type SortDirection = "asc" | "desc";

export default function SuppliersPage() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [materialFilter, setMaterialFilter] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Drag-and-drop state for pipeline view
  const [draggedSupplierId, setDraggedSupplierId] = useState<string | null>(null);
  const [dropTargetStatus, setDropTargetStatus] = useState<string | null>(null);
  const [updatingSupplierIds, setUpdatingSupplierIds] = useState<Set<string>>(new Set());

  const fetchSuppliers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter) params.set("pipeline_status", statusFilter);
      if (materialFilter) params.set("material", materialFilter);
      const res = await fetch(`/api/sourcing/suppliers?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setSuppliers(Array.isArray(data) ? data : data.suppliers ?? []);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, materialFilter]);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  const allMaterials = Array.from(
    new Set(suppliers.flatMap((s) => s.primary_materials))
  ).sort();

  const sortedSuppliers = [...suppliers].sort((a, b) => {
    if (!sortField) return 0;
    const dir = sortDirection === "asc" ? 1 : -1;
    switch (sortField) {
      case "company_name":
        return dir * a.company_name.localeCompare(b.company_name);
      case "location":
        return (
          dir *
          `${a.location_city}, ${a.location_province}`.localeCompare(
            `${b.location_city}, ${b.location_province}`
          )
        );
      case "pipeline_status":
        return dir * a.pipeline_status.localeCompare(b.pipeline_status);
      case "priority_score":
        return dir * ((a.priority_score ?? 0) - (b.priority_score ?? 0));
      case "source_platform":
        return dir * a.source_platform.localeCompare(b.source_platform);
      default:
        return 0;
    }
  });

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field)
      return <ArrowUpDownIcon className="ml-1 inline size-3 opacity-40" />;
    return sortDirection === "asc" ? (
      <ArrowUpIcon className="ml-1 inline size-3" />
    ) : (
      <ArrowDownIcon className="ml-1 inline size-3" />
    );
  }

  async function handleDropSupplier(supplierId: string, newStatus: string) {
    const supplier = suppliers.find((s) => s.id === supplierId);
    if (!supplier || supplier.pipeline_status === newStatus) return;

    // Optimistic update
    setSuppliers((prev) =>
      prev.map((s) =>
        s.id === supplierId ? { ...s, pipeline_status: newStatus } : s
      )
    );
    setUpdatingSupplierIds((prev) => new Set(prev).add(supplierId));

    try {
      const res = await fetch(`/api/sourcing/suppliers/${supplierId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pipeline_status: newStatus }),
      });
      if (!res.ok) {
        // Revert on failure
        setSuppliers((prev) =>
          prev.map((s) =>
            s.id === supplierId
              ? { ...s, pipeline_status: supplier.pipeline_status }
              : s
          )
        );
      }
    } catch {
      // Revert on error
      setSuppliers((prev) =>
        prev.map((s) =>
          s.id === supplierId
            ? { ...s, pipeline_status: supplier.pipeline_status }
            : s
        )
      );
    } finally {
      setUpdatingSupplierIds((prev) => {
        const next = new Set(prev);
        next.delete(supplierId);
        return next;
      });
    }
  }

  const groupedByStatus = PIPELINE_STATUSES.reduce(
    (acc, status) => {
      acc[status] = sortedSuppliers.filter(
        (s) => s.pipeline_status === status
      );
      return acc;
    },
    {} as Record<string, Supplier[]>
  );

  async function handleAddSupplier(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    const form = e.currentTarget;
    const fd = new FormData(form);

    const body = {
      company_name: fd.get("company_name") as string,
      company_name_cn: (fd.get("company_name_cn") as string) || null,
      source_platform: (fd.get("source_platform") as string) || "direct",
      source_url: (fd.get("source_url") as string) || null,
      location_city: (fd.get("location_city") as string) || "",
      location_province: (fd.get("location_province") as string) || "",
      primary_materials: (fd.get("primary_materials") as string)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      certifications: (fd.get("certifications") as string)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      moq_range: (fd.get("moq_range") as string) || null,
      contact_person: (fd.get("contact_person") as string) || null,
      contact_email: (fd.get("contact_email") as string) || null,
      contact_phone: (fd.get("contact_phone") as string) || null,
      contact_wechat: (fd.get("contact_wechat") as string) || null,
      notes: (fd.get("notes") as string) || null,
    };

    try {
      const res = await fetch("/api/sourcing/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setDialogOpen(false);
        form.reset();
        fetchSuppliers();
      }
    } catch {
      // silently fail
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">
          Supplier Database
        </h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger
            render={
              <Button>
                <PlusIcon data-icon="inline-start" />
                Add Supplier
              </Button>
            }
          />
          <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Supplier</DialogTitle>
              <DialogDescription>
                Add a new supplier to your database.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddSupplier} className="grid gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="company_name">Company Name *</Label>
                <Input
                  id="company_name"
                  name="company_name"
                  required
                  placeholder="Company name"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="company_name_cn">Chinese Name</Label>
                <Input
                  id="company_name_cn"
                  name="company_name_cn"
                  placeholder="Chinese company name"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="source_platform">Source Platform</Label>
                <select
                  id="source_platform"
                  name="source_platform"
                  defaultValue="direct"
                  className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                >
                  {SOURCE_PLATFORMS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="source_url">Source URL</Label>
                <Input
                  id="source_url"
                  name="source_url"
                  type="url"
                  placeholder="https://..."
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="location_city">City</Label>
                  <Input
                    id="location_city"
                    name="location_city"
                    placeholder="City"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="location_province">Province</Label>
                  <Input
                    id="location_province"
                    name="location_province"
                    placeholder="Province"
                  />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="primary_materials">
                  Primary Materials (comma-separated)
                </Label>
                <Input
                  id="primary_materials"
                  name="primary_materials"
                  placeholder="Steel, Aluminum, Copper"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="certifications">
                  Certifications (comma-separated)
                </Label>
                <Input
                  id="certifications"
                  name="certifications"
                  placeholder="ISO 9001, CE"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="moq_range">MOQ Range</Label>
                <Input
                  id="moq_range"
                  name="moq_range"
                  placeholder="100-500 units"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="contact_person">Contact Person</Label>
                  <Input
                    id="contact_person"
                    name="contact_person"
                    placeholder="Name"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="contact_email">Email</Label>
                  <Input
                    id="contact_email"
                    name="contact_email"
                    type="email"
                    placeholder="email@example.com"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="contact_phone">Phone</Label>
                  <Input
                    id="contact_phone"
                    name="contact_phone"
                    placeholder="+86..."
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="contact_wechat">WeChat</Label>
                  <Input
                    id="contact_wechat"
                    name="contact_wechat"
                    placeholder="WeChat ID"
                  />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  name="notes"
                  placeholder="Additional notes..."
                />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Adding..." : "Add Supplier"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search suppliers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select
          value={statusFilter ?? undefined}
          onValueChange={(val) =>
            setStatusFilter(val === "_all" ? null : (val as string))
          }
        >
          <SelectTrigger className="w-[180px] capitalize">
            <SelectValue placeholder="Pipeline Status">
              {statusFilter
                ? statusFilter.replace(/_/g, " ")
                : "Pipeline Status"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent align="start">
            <SelectItem value="_all">All Statuses</SelectItem>
            {PIPELINE_STATUSES.map((s) => (
              <SelectItem key={s} value={s} className="capitalize">
                {s.replace(/_/g, " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={materialFilter ?? undefined}
          onValueChange={(val) =>
            setMaterialFilter(val === "_all" ? null : (val as string))
          }
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Material Category" />
          </SelectTrigger>
          <SelectContent align="start">
            <SelectItem value="_all">All Materials</SelectItem>
            {allMaterials.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="table">
        <TabsList>
          <TabsTrigger value="table">Table View</TabsTrigger>
          <TabsTrigger value="pipeline">Pipeline View</TabsTrigger>
        </TabsList>

        {/* TABLE VIEW */}
        <TabsContent value="table">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              Loading suppliers...
            </div>
          ) : sortedSuppliers.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              No suppliers found.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead
                    className="cursor-pointer select-none"
                    onClick={() => handleSort("company_name")}
                  >
                    Company Name
                    <SortIcon field="company_name" />
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none"
                    onClick={() => handleSort("location")}
                  >
                    Location
                    <SortIcon field="location" />
                  </TableHead>
                  <TableHead>Materials</TableHead>
                  <TableHead
                    className="cursor-pointer select-none"
                    onClick={() => handleSort("pipeline_status")}
                  >
                    Pipeline Status
                    <SortIcon field="pipeline_status" />
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none"
                    onClick={() => handleSort("priority_score")}
                  >
                    Priority Score
                    <SortIcon field="priority_score" />
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none"
                    onClick={() => handleSort("source_platform")}
                  >
                    Source
                    <SortIcon field="source_platform" />
                  </TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedSuppliers.map((supplier) => (
                  <TableRow
                    key={supplier.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/suppliers/${supplier.id}`)}
                  >
                    <TableCell className="font-medium">
                      {supplier.company_name}
                    </TableCell>
                    <TableCell>
                      {supplier.location_city}
                      {supplier.location_province
                        ? `, ${supplier.location_province}`
                        : ""}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {supplier.primary_materials.slice(0, 3).map((m) => (
                          <Badge key={m} variant="secondary" className="text-xs">
                            {m}
                          </Badge>
                        ))}
                        {supplier.primary_materials.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{supplier.primary_materials.length - 3}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={supplier.pipeline_status} />
                    </TableCell>
                    <TableCell>
                      {supplier.priority_score != null
                        ? supplier.priority_score
                        : "-"}
                    </TableCell>
                    <TableCell className="capitalize">
                      {supplier.source_platform.replace(/_/g, " ")}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/suppliers/${supplier.id}`);
                        }}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        {/* PIPELINE (KANBAN) VIEW */}
        <TabsContent value="pipeline">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              Loading suppliers...
            </div>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-4">
              {PIPELINE_STATUSES.map((status) => (
                <div
                  key={status}
                  className={`flex min-w-[260px] max-w-[300px] shrink-0 flex-col gap-2 rounded-xl p-2 transition-colors duration-150 ${
                    dropTargetStatus === status
                      ? "bg-primary/10 ring-2 ring-primary/30"
                      : ""
                  }`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    setDropTargetStatus(status);
                  }}
                  onDragLeave={(e) => {
                    // Only clear if leaving the column entirely
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                      setDropTargetStatus(null);
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDropTargetStatus(null);
                    const supplierId = e.dataTransfer.getData("text/plain");
                    if (supplierId) {
                      handleDropSupplier(supplierId, status);
                    }
                    setDraggedSupplierId(null);
                  }}
                >
                  <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-2">
                    <span className="text-sm font-medium capitalize">
                      {status.replace(/_/g, " ")}
                    </span>
                    <Badge variant="secondary" className="text-xs">
                      {groupedByStatus[status]?.length ?? 0}
                    </Badge>
                  </div>
                  <div className="flex min-h-[60px] flex-col gap-2">
                    {(groupedByStatus[status] ?? []).map((supplier) => (
                      <Card
                        key={supplier.id}
                        size="sm"
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData("text/plain", supplier.id);
                          e.dataTransfer.effectAllowed = "move";
                          setDraggedSupplierId(supplier.id);
                        }}
                        onDragEnd={() => {
                          setDraggedSupplierId(null);
                          setDropTargetStatus(null);
                        }}
                        className={`cursor-grab transition-all active:cursor-grabbing ${
                          draggedSupplierId === supplier.id
                            ? "opacity-40 scale-95 rotate-1"
                            : "hover:shadow-md"
                        } ${
                          updatingSupplierIds.has(supplier.id)
                            ? "animate-pulse border-primary/50"
                            : ""
                        }`}
                        onClick={() =>
                          router.push(`/suppliers/${supplier.id}`)
                        }
                      >
                        <CardHeader>
                          <div className="flex items-start gap-1.5">
                            <GripVerticalIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/50" />
                            <CardTitle className="text-sm">
                              {supplier.company_name}
                            </CardTitle>
                          </div>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-2">
                          <p className="text-xs text-muted-foreground">
                            {supplier.location_city}
                            {supplier.location_province
                              ? `, ${supplier.location_province}`
                              : ""}
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {supplier.primary_materials
                              .slice(0, 2)
                              .map((m) => (
                                <Badge
                                  key={m}
                                  variant="secondary"
                                  className="text-xs"
                                >
                                  {m}
                                </Badge>
                              ))}
                          </div>
                          {supplier.priority_score != null && (
                            <div className="text-xs text-muted-foreground">
                              Priority:{" "}
                              <span className="font-medium text-foreground">
                                {supplier.priority_score}
                              </span>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                    {(groupedByStatus[status] ?? []).length === 0 && (
                      <div className={`rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground ${
                        dropTargetStatus === status
                          ? "border-primary/40 bg-primary/5"
                          : ""
                      }`}>
                        {dropTargetStatus === status
                          ? "Drop here"
                          : "No suppliers"}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
