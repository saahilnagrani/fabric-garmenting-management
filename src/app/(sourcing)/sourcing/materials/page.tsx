"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { PlusIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Material, MaterialCategory, MaterialPriority } from "@/types/sourcing";

const CATEGORIES: { value: MaterialCategory | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "fabric", label: "Fabric" },
  { value: "trim", label: "Trim" },
  { value: "zipper", label: "Zipper" },
  { value: "elastic", label: "Elastic" },
  { value: "label", label: "Label" },
  { value: "packaging", label: "Packaging" },
  { value: "thread", label: "Thread" },
  { value: "other", label: "Other" },
];

const PRIORITIES: { value: MaterialPriority; label: string }[] = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

type MaterialFormData = {
  name: string;
  category: MaterialCategory;
  gsm: string;
  width: string;
  composition: string;
  colors: string;
  target_price_range: string;
  priority: MaterialPriority;
  notes: string;
};

const emptyForm: MaterialFormData = {
  name: "",
  category: "fabric",
  gsm: "",
  width: "",
  composition: "",
  colors: "",
  target_price_range: "",
  priority: "medium",
  notes: "",
};

function priorityVariant(priority: MaterialPriority) {
  switch (priority) {
    case "high":
      return "destructive" as const;
    case "medium":
      return "secondary" as const;
    case "low":
      return "outline" as const;
  }
}

function priorityClassName(priority: MaterialPriority) {
  switch (priority) {
    case "high":
      return "";
    case "medium":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
    case "low":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
  }
}

export default function MaterialsPage() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [deletingMaterial, setDeletingMaterial] = useState<Material | null>(null);
  const [form, setForm] = useState<MaterialFormData>(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const fetchMaterials = useCallback(async () => {
    try {
      const url =
        activeCategory === "all"
          ? "/api/sourcing/materials"
          : `/api/sourcing/materials?category=${activeCategory}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch");
      const data: Material[] = await res.json();
      setMaterials(data);
    } catch {
      toast.error("Failed to load materials");
    } finally {
      setLoading(false);
    }
  }, [activeCategory]);

  useEffect(() => {
    setLoading(true);
    fetchMaterials();
  }, [fetchMaterials]);

  const openCreateDialog = () => {
    setEditingMaterial(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEditDialog = (material: Material) => {
    setEditingMaterial(material);
    setForm({
      name: material.name,
      category: material.category,
      gsm: material.specifications?.gsm?.toString() ?? "",
      width: material.specifications?.width ?? "",
      composition: material.specifications?.composition ?? "",
      colors: Array.isArray(material.specifications?.colors)
        ? material.specifications.colors.join(", ")
        : (material.specifications?.colors ?? ""),
      target_price_range: material.target_price_range ?? "",
      priority: material.priority,
      notes: material.notes ?? "",
    });
    setDialogOpen(true);
  };

  const openDeleteDialog = (material: Material) => {
    setDeletingMaterial(material);
    setDeleteDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Material name is required");
      return;
    }

    setSubmitting(true);
    try {
      const colors = form.colors
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);

      const payload = {
        name: form.name.trim(),
        category: form.category,
        specifications: {
          ...(form.gsm ? { gsm: Number(form.gsm) } : {}),
          ...(form.width ? { width: form.width.trim() } : {}),
          ...(form.composition ? { composition: form.composition.trim() } : {}),
          ...(colors.length > 0 ? { colors } : {}),
        },
        target_price_range: form.target_price_range.trim() || null,
        priority: form.priority,
        notes: form.notes.trim() || null,
      };

      if (editingMaterial) {
        const res = await fetch(`/api/sourcing/materials/${editingMaterial.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Failed to update");
        toast.success("Material updated successfully");
      } else {
        const res = await fetch("/api/sourcing/materials", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Failed to create");
        toast.success("Material created successfully");
      }

      setDialogOpen(false);
      fetchMaterials();
    } catch {
      toast.error(
        editingMaterial
          ? "Failed to update material"
          : "Failed to create material"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingMaterial) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/sourcing/materials/${deletingMaterial.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
      toast.success("Material deleted successfully");
      setDeleteDialogOpen(false);
      setDeletingMaterial(null);
      fetchMaterials();
    } catch {
      toast.error("Failed to delete material");
    } finally {
      setSubmitting(false);
    }
  };

  const updateField = (field: keyof MaterialFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Materials</h1>
          <p className="text-muted-foreground">
            Manage your material sourcing requirements.
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <PlusIcon className="size-4" />
          Add Material
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Material Library</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs
            value={activeCategory}
            onValueChange={setActiveCategory}
          >
            <TabsList className="mb-4 flex-wrap">
              {CATEGORIES.map((cat) => (
                <TabsTrigger key={cat.value} value={cat.value}>
                  {cat.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {CATEGORIES.map((cat) => (
              <TabsContent key={cat.value} value={cat.value}>
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <p className="text-muted-foreground">
                      Loading materials...
                    </p>
                  </div>
                ) : materials.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <p className="text-muted-foreground">
                      No materials found
                      {cat.value !== "all" ? ` in ${cat.label}` : ""}.
                    </p>
                    <Button
                      variant="outline"
                      className="mt-4"
                      onClick={openCreateDialog}
                    >
                      <PlusIcon className="size-4" />
                      Add your first material
                    </Button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Target Price</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {materials.map((material) => (
                        <TableRow key={material.id}>
                          <TableCell className="font-medium">
                            {material.name}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {material.category}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={priorityVariant(material.priority)}
                              className={priorityClassName(material.priority)}
                            >
                              {material.priority}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {material.target_price_range ?? "--"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => openEditDialog(material)}
                              >
                                <PencilIcon className="size-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => openDeleteDialog(material)}
                              >
                                <Trash2Icon className="size-3.5 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingMaterial ? "Edit Material" : "Add Material"}
            </DialogTitle>
            <DialogDescription>
              {editingMaterial
                ? "Update the material details below."
                : "Fill in the details for the new material."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="mat-name">Name</Label>
              <Input
                id="mat-name"
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
                placeholder="e.g. Recycled Polyester Jersey"
                required
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={form.category}
                  onValueChange={(val) =>
                    updateField("category", val as string)
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {CATEGORIES.find((c) => c.value === form.category)?.label ?? "Select category"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent align="start">
                    {CATEGORIES.filter((c) => c.value !== "all").map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Priority</Label>
                <Select
                  value={form.priority}
                  onValueChange={(val) =>
                    updateField("priority", val as string)
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {PRIORITIES.find((p) => p.value === form.priority)?.label ?? "Select priority"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent align="start">
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <fieldset className="space-y-3 rounded-lg border border-border p-3">
              <legend className="px-1 text-sm font-medium">
                Specifications
              </legend>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="mat-gsm">GSM</Label>
                  <Input
                    id="mat-gsm"
                    value={form.gsm}
                    onChange={(e) => updateField("gsm", e.target.value)}
                    placeholder="e.g. 180"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="mat-width">Width</Label>
                  <Input
                    id="mat-width"
                    value={form.width}
                    onChange={(e) => updateField("width", e.target.value)}
                    placeholder='e.g. 60"'
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="mat-composition">Composition</Label>
                <Input
                  id="mat-composition"
                  value={form.composition}
                  onChange={(e) => updateField("composition", e.target.value)}
                  placeholder="e.g. 92% Polyester, 8% Spandex"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="mat-colors">Colors</Label>
                <Input
                  id="mat-colors"
                  value={form.colors}
                  onChange={(e) => updateField("colors", e.target.value)}
                  placeholder="Black, Navy, Charcoal (comma-separated)"
                />
                <p className="text-xs text-muted-foreground">
                  Separate multiple colors with commas.
                </p>
              </div>
            </fieldset>

            <div className="space-y-2">
              <Label htmlFor="mat-price">Target Price Range</Label>
              <Input
                id="mat-price"
                value={form.target_price_range}
                onChange={(e) =>
                  updateField("target_price_range", e.target.value)
                }
                placeholder="e.g. $2.50 - $3.50 /meter"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="mat-notes">Notes</Label>
              <Textarea
                id="mat-notes"
                value={form.notes}
                onChange={(e) => updateField("notes", e.target.value)}
                placeholder="Any additional notes..."
                rows={3}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting
                  ? "Saving..."
                  : editingMaterial
                    ? "Update Material"
                    : "Create Material"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Material</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-medium text-foreground">
                {deletingMaterial?.name}
              </span>
              ? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={submitting}
            >
              {submitting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
