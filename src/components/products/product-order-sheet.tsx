"use client";

import { useState, useEffect } from "react";
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
import { createProduct } from "@/actions/products";
import { GENDER_LABELS, PRODUCT_STATUS_LABELS } from "@/lib/constants";
import {
  computeTotalGarmenting,
  computeFabricCostPerPiece,
  computeTotalCost,
  computeTotalLandedCost,
} from "@/lib/computations";
import { formatCurrency } from "@/lib/formatters";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

type Vendor = { id: string; name: string };
type ProductMasterType = Record<string, unknown>;

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

type FormData = {
  styleNumber: string;
  articleNumber: string;
  skuCode: string;
  colour: string;
  type: string;
  gender: string;
  productName: string;
  vendorId: string;
  status: string;
  fabricName: string;
  fabricGsm: string;
  fabricCostPerKg: string;
  garmentsPerKg: string;
  fabric2Name: string;
  fabric2CostPerKg: string;
  fabric2GarmentsPerKg: string;
  quantityOrderedKg: string;
  quantityShippedKg: string;
  stitchingCost: string;
  brandLogoCost: string;
  neckTwillCost: string;
  reflectorsCost: string;
  fusingCost: string;
  accessoriesCost: string;
  brandTagCost: string;
  sizeTagCost: string;
  packagingCost: string;
  inwardShipping: string;
  mrp: string;
  garmentingAt: string;
  isRepeat: boolean;
  date: string;
};

const emptyForm: FormData = {
  styleNumber: "",
  articleNumber: "",
  skuCode: "",
  colour: "",
  type: "",
  gender: "MENS",
  productName: "",
  vendorId: "",
  status: "PROCESSING",
  fabricName: "",
  fabricGsm: "",
  fabricCostPerKg: "",
  garmentsPerKg: "",
  fabric2Name: "",
  fabric2CostPerKg: "",
  fabric2GarmentsPerKg: "",
  quantityOrderedKg: "",
  quantityShippedKg: "",
  stitchingCost: "",
  brandLogoCost: "",
  neckTwillCost: "",
  reflectorsCost: "",
  fusingCost: "",
  accessoriesCost: "",
  brandTagCost: "",
  sizeTagCost: "",
  packagingCost: "",
  inwardShipping: "",
  mrp: "",
  garmentingAt: "",
  isRepeat: false,
  date: "",
};

export function ProductOrderSheet({
  open,
  onOpenChange,
  vendors,
  phaseId,
  productMasters,
  isRepeatTab,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendors: Vendor[];
  phaseId: string;
  productMasters: ProductMasterType[];
  isRepeatTab: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormData>({ ...emptyForm });
  const [submitting, setSubmitting] = useState(false);
  const [suggestions, setSuggestions] = useState<ProductMasterType[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({ ...emptyForm, isRepeat: isRepeatTab, vendorId: vendors[0]?.id || "" });
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [open, isRepeatTab, vendors]);

  function updateField(field: keyof FormData, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleStyleNumberChange(value: string) {
    updateField("styleNumber", value);

    if (value.length > 0) {
      const lower = value.toLowerCase();
      const matches = productMasters.filter((m) =>
        String(m.styleNumber || "").toLowerCase().includes(lower) ||
        String(m.skuCode || "").toLowerCase().includes(lower)
      );
      setSuggestions(matches.slice(0, 8));
      setShowSuggestions(matches.length > 0);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }

  function selectProductMaster(master: ProductMasterType) {
    const s = (v: unknown) => (v !== null && v !== undefined ? String(v) : "");
    setForm((prev) => ({
      ...prev,
      styleNumber: s(master.styleNumber),
      articleNumber: s(master.articleNumber) || prev.articleNumber,
      skuCode: s(master.skuCode) || prev.skuCode,
      fabricName: s(master.fabricName) || prev.fabricName,
      type: s(master.type) || prev.type,
      gender: s(master.gender) || prev.gender,
      productName: s(master.productName) || prev.productName,
      garmentsPerKg: s(master.garmentsPerKg) || prev.garmentsPerKg,
      fabricCostPerKg: s(master.fabricCostPerKg) || prev.fabricCostPerKg,
      fabric2CostPerKg: s(master.fabric2CostPerKg) || prev.fabric2CostPerKg,
      stitchingCost: s(master.stitchingCost) || prev.stitchingCost,
      brandLogoCost: s(master.brandLogoCost) || prev.brandLogoCost,
      neckTwillCost: s(master.neckTwillCost) || prev.neckTwillCost,
      reflectorsCost: s(master.reflectorsCost) || prev.reflectorsCost,
      fusingCost: s(master.fusingCost) || prev.fusingCost,
      accessoriesCost: s(master.accessoriesCost) || prev.accessoriesCost,
      brandTagCost: s(master.brandTagCost) || prev.brandTagCost,
      sizeTagCost: s(master.sizeTagCost) || prev.sizeTagCost,
      packagingCost: s(master.packagingCost) || prev.packagingCost,
      inwardShipping: s(master.inwardShipping) || prev.inwardShipping,
      mrp: s(master.proposedMrp) || s(master.onlineMrp) || prev.mrp,
    }));
    setShowSuggestions(false);
  }

  // Build a numeric object for computations
  function formAsData(): Record<string, unknown> {
    return {
      ...form,
      fabricCostPerKg: toNum(form.fabricCostPerKg),
      garmentsPerKg: toNum(form.garmentsPerKg),
      fabric2CostPerKg: toNum(form.fabric2CostPerKg),
      fabric2GarmentsPerKg: toNum(form.fabric2GarmentsPerKg),
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
      mrp: toNum(form.mrp),
    };
  }

  async function handleSubmit() {
    if (!form.styleNumber.trim()) {
      toast.error("Style # is required");
      return;
    }
    if (!form.vendorId) {
      toast.error("Vendor is required");
      return;
    }
    if (!form.fabricName.trim()) {
      toast.error("Fabric Name is required");
      return;
    }
    if (!form.colour.trim()) {
      toast.error("Colour is required");
      return;
    }

    setSubmitting(true);
    try {
      const numOrNull = (v: string) => toNum(v);
      await createProduct({
        phaseId,
        date: form.date || new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
        styleNumber: form.styleNumber,
        articleNumber: form.articleNumber || null,
        skuCode: form.skuCode || null,
        colour: form.colour,
        type: form.type,
        gender: form.gender,
        productName: form.productName || null,
        isRepeat: form.isRepeat,
        status: form.status,
        vendorId: form.vendorId,
        fabricName: form.fabricName,
        fabricGsm: numOrNull(form.fabricGsm),
        fabricCostPerKg: numOrNull(form.fabricCostPerKg),
        garmentsPerKg: numOrNull(form.garmentsPerKg),
        fabric2Name: form.fabric2Name || null,
        fabric2CostPerKg: numOrNull(form.fabric2CostPerKg),
        fabric2GarmentsPerKg: numOrNull(form.fabric2GarmentsPerKg),
        quantityOrderedKg: numOrNull(form.quantityOrderedKg),
        quantityShippedKg: numOrNull(form.quantityShippedKg),
        garmentNumber: null,
        actualGarmentStitched: null,
        sizeXS: 0, sizeS: 0, sizeM: 0, sizeL: 0, sizeXL: 0, sizeXXL: 0,
        stitchingCost: numOrNull(form.stitchingCost),
        brandLogoCost: numOrNull(form.brandLogoCost),
        neckTwillCost: numOrNull(form.neckTwillCost),
        reflectorsCost: numOrNull(form.reflectorsCost),
        fusingCost: numOrNull(form.fusingCost),
        accessoriesCost: numOrNull(form.accessoriesCost),
        brandTagCost: numOrNull(form.brandTagCost),
        sizeTagCost: numOrNull(form.sizeTagCost),
        packagingCost: numOrNull(form.packagingCost),
        inwardShipping: numOrNull(form.inwardShipping),
        mrp: numOrNull(form.mrp),
        proposedMrp: null,
        onlineMrp: null,
        garmentingAt: form.garmentingAt || null,
        isStrikedThrough: false,
      });
      toast.success("Product order created");
      onOpenChange(false);
      router.refresh();
    } catch {
      toast.error("Failed to create product order");
    } finally {
      setSubmitting(false);
    }
  }

  const vendorLabels: Record<string, string> = {};
  vendors.forEach((v) => { vendorLabels[v.id] = v.name; });

  const data = formAsData();
  const totalGarmenting = computeTotalGarmenting(data);
  const fabricCostPerPiece = computeFabricCostPerPiece(data);
  const totalCost = computeTotalCost(data);
  const totalLanded = computeTotalLandedCost(data);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>New Product Order</SheetTitle>
          <SheetDescription>
            Enter Style # to auto-populate from Products Master DB
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-4 px-4 overflow-y-auto">
          {/* Primary field - Style # with autocomplete */}
          <div className="space-y-1 relative">
            <Label className="text-xs font-semibold">Style # *</Label>
            <Input
              value={form.styleNumber}
              onChange={(e) => handleStyleNumberChange(e.target.value)}
              onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              placeholder="Start typing to search..."
              autoFocus
            />
            {showSuggestions && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {suggestions.map((m, i) => (
                  <button
                    key={i}
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors border-b last:border-b-0 border-gray-100"
                    onMouseDown={() => selectProductMaster(m)}
                  >
                    <span className="font-medium">{String(m.styleNumber)}</span>
                    {m.skuCode ? <span className="text-muted-foreground ml-1">[{String(m.skuCode)}]</span> : null}
                    {m.productName ? <span className="text-muted-foreground ml-2">- {String(m.productName)}</span> : null}
                    {m.type ? <span className="text-muted-foreground ml-1">({String(m.type)})</span> : null}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Identity */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Identity</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Article #</Label>
                <Input value={form.articleNumber} onChange={(e) => updateField("articleNumber", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">SKU Code</Label>
                <Input value={form.skuCode} onChange={(e) => updateField("skuCode", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Colour *</Label>
                <Input value={form.colour} onChange={(e) => updateField("colour", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Product Name</Label>
                <Input value={form.productName} onChange={(e) => updateField("productName", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Type</Label>
                <Input value={form.type} onChange={(e) => updateField("type", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Gender</Label>
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
              <div className="space-y-1">
                <Label className="text-xs">Status</Label>
                <Select value={form.status} onValueChange={(v) => updateField("status", v ?? "")}>
                  <SelectTrigger>
                    <span className="truncate">{PRODUCT_STATUS_LABELS[form.status] || "Select"}</span>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRODUCT_STATUS_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Vendor *</Label>
                <Select value={form.vendorId} onValueChange={(v) => updateField("vendorId", v ?? "")}>
                  <SelectTrigger>
                    <span className="truncate">{vendorLabels[form.vendorId] || "Select vendor"}</span>
                  </SelectTrigger>
                  <SelectContent>
                    {vendors.map((v) => (
                      <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Garmenting At</Label>
                <Input value={form.garmentingAt} onChange={(e) => updateField("garmentingAt", e.target.value)} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => updateField("isRepeat", !form.isRepeat)}
                className={`h-4 w-4 rounded border flex items-center justify-center transition-colors ${form.isRepeat ? "bg-blue-500 border-blue-500" : "border-gray-300 bg-white"}`}
              >
                {form.isRepeat && (
                  <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
              <Label className="text-xs">Repeat Design</Label>
            </div>
          </div>

          {/* Fabric */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Fabric</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Fabric Name *</Label>
                <Input value={form.fabricName} onChange={(e) => updateField("fabricName", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">GSM</Label>
                <Input type="number" value={form.fabricGsm} onChange={(e) => updateField("fabricGsm", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Fabric Cost/kg (Rs)</Label>
                <Input type="number" step="0.01" value={form.fabricCostPerKg} onChange={(e) => updateField("fabricCostPerKg", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Garments/kg</Label>
                <Input type="number" step="0.01" value={form.garmentsPerKg} onChange={(e) => updateField("garmentsPerKg", e.target.value)} />
              </div>
            </div>
          </div>

          {/* Quantities */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Quantities</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Ordered Qty (kg)</Label>
                <Input type="number" step="0.01" value={form.quantityOrderedKg} onChange={(e) => updateField("quantityOrderedKg", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Shipped Qty (kg)</Label>
                <Input type="number" step="0.01" value={form.quantityShippedKg} onChange={(e) => updateField("quantityShippedKg", e.target.value)} />
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
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Shipping Cost/piece (Rs)</Label>
                <Input type="number" step="0.01" value={form.inwardShipping} onChange={(e) => updateField("inwardShipping", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">MRP (Rs)</Label>
                <Input type="number" step="0.01" value={form.mrp} onChange={(e) => updateField("mrp", e.target.value)} />
              </div>
            </div>
          </div>

          {/* Computed Summary */}
          <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 space-y-2">
            <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Summary</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
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
            </div>
          </div>
        </div>

        <SheetFooter>
          <Button onClick={handleSubmit} disabled={submitting} className="w-full">
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Product Order"
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
