"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from "@/components/ui/sheet";
import { Combobox } from "@/components/ui/combobox";
import { createProductMaster, updateProductMaster } from "@/actions/product-masters";
import { GENDER_LABELS } from "@/lib/constants";
import {
  computeTotalGarmenting,
  computeFabricCostPerPiece,
  computeTotalCost,
  computeTotalLandedCost,
  computeDealerPrice,
  computeProfitMargin,
} from "@/lib/computations";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export type ProductMasterRow = {
  id: string;
  skuCode: string;
  styleNumber: string;
  articleNumber: string;
  fabricName: string;
  fabric2Name: string;
  type: string;
  gender: string;
  productName: string;
  coloursAvailable: string[];
  colours2Available: string[];
  garmentsPerKg: number | null;
  garmentsPerKg2: number | null;
  stitchingCost: number | null;
  brandLogoCost: number | null;
  neckTwillCost: number | null;
  reflectorsCost: number | null;
  fusingCost: number | null;
  accessoriesCost: number | null;
  brandTagCost: number | null;
  sizeTagCost: number | null;
  packagingCost: number | null;
  fabricCostPerKg: number | null;
  fabric2CostPerKg: number | null;
  inwardShipping: number | null;
  proposedMrp: number | null;
  onlineMrp: number | null;
  [key: string]: unknown;
};

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

type FormData = {
  skuCode: string;
  styleNumber: string;
  articleNumber: string;
  fabricName: string;
  fabric2Name: string;
  type: string;
  gender: string;
  productName: string;
  coloursAvailable: string;
  colours2Available: string;
  garmentsPerKg: string;
  garmentsPerKg2: string;
  stitchingCost: string;
  brandLogoCost: string;
  neckTwillCost: string;
  reflectorsCost: string;
  fusingCost: string;
  accessoriesCost: string;
  brandTagCost: string;
  sizeTagCost: string;
  packagingCost: string;
  fabricCostPerKg: string;
  fabric2CostPerKg: string;
  inwardShipping: string;
  proposedMrp: string;
  onlineMrp: string;
};

const emptyForm: FormData = {
  skuCode: "",
  styleNumber: "",
  articleNumber: "",
  fabricName: "",
  fabric2Name: "",
  type: "",
  gender: "MENS",
  productName: "",
  coloursAvailable: "",
  colours2Available: "",
  garmentsPerKg: "",
  garmentsPerKg2: "",
  stitchingCost: "",
  brandLogoCost: "",
  neckTwillCost: "",
  reflectorsCost: "",
  fusingCost: "",
  accessoriesCost: "",
  brandTagCost: "",
  sizeTagCost: "",
  packagingCost: "",
  fabricCostPerKg: "",
  fabric2CostPerKg: "",
  inwardShipping: "",
  proposedMrp: "",
  onlineMrp: "",
};

function rowToForm(row: ProductMasterRow): FormData {
  const s = (v: unknown) => (v !== null && v !== undefined ? String(v) : "");
  return {
    skuCode: s(row.skuCode),
    styleNumber: s(row.styleNumber),
    articleNumber: s(row.articleNumber),
    fabricName: s(row.fabricName),
    fabric2Name: s(row.fabric2Name),
    type: s(row.type),
    gender: s(row.gender) || "MENS",
    productName: s(row.productName),
    coloursAvailable: (row.coloursAvailable || []).join(", "),
    colours2Available: (row.colours2Available || []).join(", "),
    garmentsPerKg: s(row.garmentsPerKg),
    garmentsPerKg2: s(row.garmentsPerKg2),
    stitchingCost: s(row.stitchingCost),
    brandLogoCost: s(row.brandLogoCost),
    neckTwillCost: s(row.neckTwillCost),
    reflectorsCost: s(row.reflectorsCost),
    fusingCost: s(row.fusingCost),
    accessoriesCost: s(row.accessoriesCost),
    brandTagCost: s(row.brandTagCost),
    sizeTagCost: s(row.sizeTagCost),
    packagingCost: s(row.packagingCost),
    fabricCostPerKg: s(row.fabricCostPerKg),
    fabric2CostPerKg: s(row.fabric2CostPerKg),
    inwardShipping: s(row.inwardShipping),
    proposedMrp: s(row.proposedMrp),
    onlineMrp: s(row.onlineMrp),
  };
}

function parseCommaSeparated(val: string): string[] {
  return val
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

type FabricData = { name: string; mrp: number | null };

export function ProductMasterSheet({
  open,
  onOpenChange,
  editingRow,
  productTypes = [],
  fabricData = [],
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingRow: ProductMasterRow | null;
  productTypes?: string[];
  fabricData?: FabricData[];
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormData>({ ...emptyForm });
  const [submitting, setSubmitting] = useState(false);
  const isEdit = editingRow !== null;

  // Derive fabric names list and MRP lookup map from fabricData
  const fabricNames = useMemo(() => fabricData.map((f) => f.name), [fabricData]);
  const fabricMrpMap = useMemo(() => {
    const map = new Map<string, number | null>();
    for (const f of fabricData) {
      map.set(f.name, f.mrp);
    }
    return map;
  }, [fabricData]);

  useEffect(() => {
    if (open) {
      setForm(editingRow ? rowToForm(editingRow) : { ...emptyForm });
    }
  }, [open, editingRow]);

  const updateField = useCallback((field: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  // Auto-populate fabric cost when fabric name is selected
  function handleFabricNameChange(value: string) {
    updateField("fabricName", value);
    const mrp = fabricMrpMap.get(value);
    updateField("fabricCostPerKg", mrp != null ? String(mrp) : "");
  }

  function handleFabric2NameChange(value: string) {
    updateField("fabric2Name", value);
    const mrp = fabricMrpMap.get(value);
    updateField("fabric2CostPerKg", mrp != null ? String(mrp) : "");
  }

  function formAsData(): Record<string, unknown> {
    return {
      ...form,
      fabricCostPerKg: toNum(form.fabricCostPerKg),
      fabric2CostPerKg: toNum(form.fabric2CostPerKg),
      garmentsPerKg: toNum(form.garmentsPerKg),
      garmentsPerKg2: toNum(form.garmentsPerKg2),
      fabric2GarmentsPerKg: toNum(form.garmentsPerKg2),
      stitchingCost: toNum(form.stitchingCost),
      brandLogoCost: toNum(form.brandLogoCost),
      neckTwillCost: toNum(form.neckTwillCost),
      reflectorsCost: toNum(form.reflectorsCost),
      fusingCost: toNum(form.fusingCost),
      accessoriesCost: toNum(form.accessoriesCost),
      brandTagCost: toNum(form.brandTagCost),
      sizeTagCost: toNum(form.sizeTagCost),
      packagingCost: toNum(form.packagingCost),
      inwardShipping: toNum(form.inwardShipping),
      proposedMrp: toNum(form.proposedMrp),
      onlineMrp: toNum(form.onlineMrp),
    };
  }

  async function handleSubmit() {
    if (!form.skuCode.trim()) {
      toast.error("SKU Code is required");
      return;
    }
    if (!form.styleNumber.trim()) {
      toast.error("Style # is required");
      return;
    }
    if (!form.fabricName.trim()) {
      toast.error("Fabric Name is required");
      return;
    }
    if (!form.type.trim()) {
      toast.error("Type is required");
      return;
    }
    if (!form.gender) {
      toast.error("Gender is required");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        skuCode: form.skuCode,
        styleNumber: form.styleNumber,
        articleNumber: form.articleNumber || null,
        fabricName: form.fabricName,
        fabric2Name: form.fabric2Name || null,
        type: form.type,
        gender: form.gender || "MENS",
        productName: form.productName || null,
        coloursAvailable: parseCommaSeparated(form.coloursAvailable),
        colours2Available: parseCommaSeparated(form.colours2Available),
        garmentsPerKg: toNum(form.garmentsPerKg),
        garmentsPerKg2: toNum(form.garmentsPerKg2),
        stitchingCost: toNum(form.stitchingCost),
        brandLogoCost: toNum(form.brandLogoCost),
        neckTwillCost: toNum(form.neckTwillCost),
        reflectorsCost: toNum(form.reflectorsCost),
        fusingCost: toNum(form.fusingCost),
        accessoriesCost: toNum(form.accessoriesCost),
        brandTagCost: toNum(form.brandTagCost),
        sizeTagCost: toNum(form.sizeTagCost),
        packagingCost: toNum(form.packagingCost),
        fabricCostPerKg: toNum(form.fabricCostPerKg),
        fabric2CostPerKg: toNum(form.fabric2CostPerKg),
        inwardShipping: toNum(form.inwardShipping),
        proposedMrp: toNum(form.proposedMrp),
        onlineMrp: toNum(form.onlineMrp),
      };

      if (isEdit) {
        await updateProductMaster(editingRow.id, payload);
        toast.success("Product master updated");
      } else {
        await createProductMaster(payload);
        toast.success("Product master created");
      }
      onOpenChange(false);
      router.refresh();
    } catch {
      toast.error(isEdit ? "Failed to update product master" : "Failed to create product master");
    } finally {
      setSubmitting(false);
    }
  }

  const data = formAsData();
  const totalGarmenting = computeTotalGarmenting(data);
  const fabricCostPerPiece = computeFabricCostPerPiece(data);
  const totalCost = computeTotalCost(data);
  const totalLanded = computeTotalLandedCost(data);
  const dealerPrice = computeDealerPrice(toNum(form.proposedMrp));
  const profitMargin = computeProfitMargin({ ...data, mrp: toNum(form.proposedMrp) });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Edit SKU/Style" : "New SKU/Style"}</SheetTitle>
          <SheetDescription>
            {isEdit ? "Update SKU/Style template details" : "Add a new SKU/Style to the master database"}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-4 px-4 overflow-y-auto">
          {/* Identity */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Identity</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">SKU Code *</Label>
                <Input value={form.skuCode} onChange={(e) => updateField("skuCode", e.target.value)} autoFocus />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Style # *</Label>
                <Input value={form.styleNumber} onChange={(e) => updateField("styleNumber", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Article #</Label>
                <Input value={form.articleNumber} onChange={(e) => updateField("articleNumber", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Product Name</Label>
                <Input value={form.productName} onChange={(e) => updateField("productName", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Fabric Name *</Label>
                <Combobox
                  value={form.fabricName}
                  onValueChange={handleFabricNameChange}
                  options={fabricNames}
                  placeholder="Select fabric..."
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">2nd Fabric Name</Label>
                <Combobox
                  value={form.fabric2Name}
                  onValueChange={handleFabric2NameChange}
                  options={fabricNames}
                  placeholder="Select fabric..."
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Type *</Label>
                <Combobox
                  value={form.type}
                  onValueChange={(v) => updateField("type", v)}
                  options={productTypes}
                  placeholder="Select type..."
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Gender *</Label>
                <Select value={form.gender} onValueChange={(v) => updateField("gender", v ?? "")}>
                  <SelectTrigger>
                    <span className="truncate">{GENDER_LABELS[form.gender] || "Select"}</span>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(GENDER_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Colours */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Colours</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Primary Colours (comma-separated)</Label>
                <Input value={form.coloursAvailable} onChange={(e) => updateField("coloursAvailable", e.target.value)} placeholder="e.g. Black, Navy, White" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Secondary Colours (comma-separated)</Label>
                <Input value={form.colours2Available} onChange={(e) => updateField("colours2Available", e.target.value)} placeholder="e.g. Red, Blue" />
              </div>
            </div>
          </div>

          {/* Fabric */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Fabric</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Garments/kg (Fabric 1)</Label>
                <Input type="number" step="0.01" value={form.garmentsPerKg} onChange={(e) => updateField("garmentsPerKg", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Fabric 1 Cost/kg (Rs)</Label>
                <Input type="number" step="0.01" value={form.fabricCostPerKg} onChange={(e) => updateField("fabricCostPerKg", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Garments/kg (Fabric 2)</Label>
                <Input type="number" step="0.01" value={form.garmentsPerKg2} onChange={(e) => updateField("garmentsPerKg2", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Fabric 2 Cost/kg (Rs)</Label>
                <Input type="number" step="0.01" value={form.fabric2CostPerKg} onChange={(e) => updateField("fabric2CostPerKg", e.target.value)} />
              </div>
            </div>
          </div>

          {/* Garmenting Costs */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Garmenting Costs</h4>
            <div className="grid grid-cols-3 gap-3">
              {[
                { key: "stitchingCost", label: "Stitching" },
                { key: "brandLogoCost", label: "Brand Logo" },
                { key: "neckTwillCost", label: "Neck Twill" },
                { key: "reflectorsCost", label: "Reflectors" },
                { key: "fusingCost", label: "Fusing" },
                { key: "accessoriesCost", label: "Accessories" },
                { key: "brandTagCost", label: "Brand Tag" },
                { key: "sizeTagCost", label: "Size Tag" },
                { key: "packagingCost", label: "Packaging" },
              ].map(({ key, label }) => (
                <div key={key} className="space-y-1">
                  <Label className="text-xs">{label}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={(form as unknown as Record<string, string>)[key]}
                    onChange={(e) => updateField(key as keyof FormData, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Pricing */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Pricing</h4>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Shipping/piece (Rs)</Label>
                <Input type="number" step="0.01" value={form.inwardShipping} onChange={(e) => updateField("inwardShipping", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Proposed MRP (Rs)</Label>
                <Input type="number" step="0.01" value={form.proposedMrp} onChange={(e) => updateField("proposedMrp", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Online MRP (Rs)</Label>
                <Input type="number" step="0.01" value={form.onlineMrp} onChange={(e) => updateField("onlineMrp", e.target.value)} />
              </div>
            </div>
          </div>

          {/* Computed Summary */}
          <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 space-y-2">
            <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Summary</h4>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground text-xs">Total Garmenting</span>
                <div className="font-semibold">{formatCurrency(totalGarmenting)}</div>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Fabric Cost/Piece</span>
                <div className="font-semibold">{formatCurrency(fabricCostPerPiece)}</div>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Total Cost/Piece</span>
                <div className="font-semibold">{formatCurrency(totalCost)}</div>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Total Landed Cost</span>
                <div className="font-semibold">{formatCurrency(totalLanded)}</div>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Dealer Price (50%)</span>
                <div className="font-semibold">{formatCurrency(dealerPrice)}</div>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Profit Margin</span>
                <div className="font-semibold">{formatPercent(profitMargin)}</div>
              </div>
            </div>
          </div>
        </div>

        <SheetFooter>
          <Button onClick={handleSubmit} disabled={submitting} className="w-full">
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isEdit ? "Updating..." : "Creating..."}
              </>
            ) : (
              isEdit ? "Update SKU/Style" : "Create SKU/Style"
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
