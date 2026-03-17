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
import { createFabricOrder } from "@/actions/fabric-orders";
import { GENDER_LABELS } from "@/lib/constants";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

type Vendor = { id: string; name: string };
type FabricMasterType = Record<string, unknown>;

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

type FormData = {
  fabricName: string;
  vendorId: string;
  styleNumbers: string;
  colour: string;
  availableColour: string;
  gender: string;
  billNumber: string;
  receivedAt: string;
  orderDate: string;
  costPerUnit: string;
  quantityOrdered: string;
  quantityShipped: string;
  fabricCostTotal: string;
  isRepeat: boolean;
};

const emptyForm: FormData = {
  fabricName: "",
  vendorId: "",
  styleNumbers: "",
  colour: "",
  availableColour: "",
  gender: "",
  billNumber: "",
  receivedAt: "",
  orderDate: "",
  costPerUnit: "",
  quantityOrdered: "",
  quantityShipped: "",
  fabricCostTotal: "",
  isRepeat: false,
};

export function FabricOrderSheet({
  open,
  onOpenChange,
  vendors,
  phaseId,
  fabricMasters,
  isRepeatTab,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendors: Vendor[];
  phaseId: string;
  fabricMasters: FabricMasterType[];
  isRepeatTab: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormData>({ ...emptyForm, isRepeat: isRepeatTab });
  const [submitting, setSubmitting] = useState(false);
  const [suggestions, setSuggestions] = useState<FabricMasterType[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Reset form when sheet opens
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

  function handleFabricNameChange(value: string) {
    updateField("fabricName", value);

    // Show suggestions
    if (value.length > 0) {
      const matches = fabricMasters.filter((m) =>
        String(m.fabricName || "").toLowerCase().includes(value.toLowerCase())
      );
      setSuggestions(matches.slice(0, 8));
      setShowSuggestions(matches.length > 0);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }

  function selectFabricMaster(master: FabricMasterType) {
    setForm((prev) => ({
      ...prev,
      fabricName: String(master.fabricName || ""),
      vendorId: master.vendorId ? String(master.vendorId) : prev.vendorId,
      costPerUnit: master.mrp !== undefined && master.mrp !== null ? String(master.mrp) : prev.costPerUnit,
    }));
    setShowSuggestions(false);
  }

  async function handleSubmit() {
    // Validate required fields
    if (!form.fabricName.trim()) {
      toast.error("Fabric Name is required");
      return;
    }
    if (!form.vendorId) {
      toast.error("Vendor is required");
      return;
    }

    setSubmitting(true);
    try {
      await createFabricOrder({
        phaseId,
        vendorId: form.vendorId,
        styleNumbers: form.styleNumbers,
        fabricName: form.fabricName,
        colour: form.colour,
        gender: form.gender || null,
        billNumber: form.billNumber || null,
        receivedAt: form.receivedAt || null,
        orderDate: form.orderDate || null,
        availableColour: form.availableColour || null,
        costPerUnit: toNum(form.costPerUnit),
        quantityOrdered: toNum(form.quantityOrdered),
        quantityShipped: toNum(form.quantityShipped),
        fabricCostTotal: toNum(form.fabricCostTotal),
        isRepeat: form.isRepeat,
        isStrikedThrough: false,
      });
      toast.success("Fabric order created");
      onOpenChange(false);
      router.refresh();
    } catch {
      toast.error("Failed to create fabric order");
    } finally {
      setSubmitting(false);
    }
  }

  const vendorLabels: Record<string, string> = {};
  vendors.forEach((v) => { vendorLabels[v.id] = v.name; });

  const computedFabricCost = (toNum(form.costPerUnit) || 0) * (toNum(form.quantityOrdered) || 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>New Fabric Order</SheetTitle>
          <SheetDescription>
            Enter fabric name to auto-populate from Fabrics Master DB
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-4 px-4 overflow-y-auto">
          {/* Primary field - Fabric Name with autocomplete */}
          <div className="space-y-1 relative">
            <Label className="text-xs font-semibold">Fabric Name *</Label>
            <Input
              value={form.fabricName}
              onChange={(e) => handleFabricNameChange(e.target.value)}
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
                    onMouseDown={() => selectFabricMaster(m)}
                  >
                    <span className="font-medium">{String(m.fabricName)}</span>
                    {m.vendorId ? (
                      <span className="text-muted-foreground ml-2">- {vendorLabels[String(m.vendorId)] || ""}</span>
                    ) : null}
                  </button>
                ))}
              </div>
            )}
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
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Fabric used for styles</Label>
            <Input value={form.styleNumbers} onChange={(e) => updateField("styleNumbers", e.target.value)} placeholder="e.g. ST001, ST002" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Colours</Label>
              <Input value={form.colour} onChange={(e) => updateField("colour", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Avail. Colour</Label>
              <Input value={form.availableColour} onChange={(e) => updateField("availableColour", e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Order Date</Label>
              <Input type="date" value={form.orderDate} onChange={(e) => updateField("orderDate", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Received At</Label>
              <Input type="date" value={form.receivedAt} onChange={(e) => updateField("receivedAt", e.target.value)} />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Invoice #</Label>
            <Input value={form.billNumber} onChange={(e) => updateField("billNumber", e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Cost/Unit (Rs)</Label>
              <Input type="number" step="0.01" value={form.costPerUnit} onChange={(e) => updateField("costPerUnit", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Ordered Qty (kg)</Label>
              <Input type="number" step="0.01" value={form.quantityOrdered} onChange={(e) => updateField("quantityOrdered", e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Shipped Qty (kg)</Label>
              <Input type="number" step="0.01" value={form.quantityShipped} onChange={(e) => updateField("quantityShipped", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Expected Cost (Rs)</Label>
              <Input type="number" step="0.01" value={form.fabricCostTotal} onChange={(e) => updateField("fabricCostTotal", e.target.value)} />
            </div>
          </div>

          {/* Computed field */}
          <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2">
            <div className="text-xs text-muted-foreground">Fabric Cost (Rs) = Cost/Unit x Ordered Qty</div>
            <div className="text-sm font-semibold mt-0.5">
              {computedFabricCost > 0 ? `Rs ${computedFabricCost.toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "-"}
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
            <Label className="text-xs">Repeat Order</Label>
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
              "Create Fabric Order"
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
