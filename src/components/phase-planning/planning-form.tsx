"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { createPlanOrders, type PlannedSKUOrder, type PlannedFabricOrder } from "@/actions/phase-planning";
import { toast } from "sonner";
import { Plus, X, ArrowLeft, Loader2 } from "lucide-react";

type ProductMaster = Record<string, unknown>;
type FabricMaster = Record<string, unknown>;
type Vendor = { id: string; name: string };

type ColourQty = { colour: string; qty: number };

type SelectedArticle = {
  articleNumber: string;
  styleName: string;
  fabricName: string;
  fabric2Name: string | null;
  garmentsPerKg: number | null;
  garmentsPerKg2: number | null;
  fabricCostPerKg: number | null;
  fabric2CostPerKg: number | null;
  fabricVendorId: string;
  fabricVendorName: string;
  fabric2VendorId: string | null;
  fabric2VendorName: string | null;
  type: string;
  gender: string;
  productName: string;
  availableColours: string[];
  colourQtys: ColourQty[];
  isRepeat: boolean;
  // Cost defaults from master
  stitchingCost: number | null;
  brandLogoCost: number | null;
  neckTwillCost: number | null;
  reflectorsCost: number | null;
  fusingCost: number | null;
  accessoriesCost: number | null;
  brandTagCost: number | null;
  sizeTagCost: number | null;
  packagingCost: number | null;
  outwardShippingCost: number | null;
  proposedMrp: number | null;
  onlineMrp: number | null;
};

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

type SizeDistItem = { size: string; percentage: number };

export function PlanningForm({
  phaseId,
  phaseNumber,
  productMasters,
  fabricMasters,
  vendors,
  previousArticles,
  sizeDistributions = [],
}: {
  phaseId: string;
  phaseNumber: number;
  productMasters: ProductMaster[];
  fabricMasters: FabricMaster[];
  vendors: Vendor[];
  previousArticles: string[];
  sizeDistributions?: SizeDistItem[];
}) {
  const router = useRouter();
  const [step, setStep] = useState<"select" | "review">("select");
  const [selectedArticles, setSelectedArticles] = useState<SelectedArticle[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const previousArticleSet = useMemo(() => new Set(previousArticles), [previousArticles]);

  // Size distribution map for per-size calculations
  const sizeDistMap = useMemo(
    () => new Map(sizeDistributions.map((d) => [d.size, d.percentage])),
    [sizeDistributions]
  );
  const sizes = ["XS", "S", "M", "L", "XL", "XXL"];

  // Build fabric vendor lookup: fabricName -> { vendorId, vendorName, mrp }
  const fabricVendorMap = useMemo(() => {
    const map = new Map<string, { vendorId: string; vendorName: string; mrp: number | null }>();
    for (const fm of fabricMasters) {
      const name = String(fm.fabricName || "");
      if (!map.has(name)) {
        const vendor = fm.vendor as { id: string; name: string } | undefined;
        map.set(name, {
          vendorId: vendor?.id || String(fm.vendorId || ""),
          vendorName: vendor?.name || "",
          mrp: toNum(fm.mrp),
        });
      }
    }
    return map;
  }, [fabricMasters]);

  // Group product masters by articleNumber
  const articleGroups = useMemo(() => {
    const groups = new Map<string, ProductMaster[]>();
    for (const pm of productMasters) {
      const article = String(pm.articleNumber || "");
      if (!article) continue;
      if (!groups.has(article)) groups.set(article, []);
      groups.get(article)!.push(pm);
    }
    return groups;
  }, [productMasters]);

  // Build combobox options: "1001 - Womens Round Neck"
  const articleOptions = useMemo(() => {
    const options: { label: string; value: string }[] = [];
    for (const [article, masters] of articleGroups) {
      const productName = String(masters[0].productName || masters[0].styleNumber || "");
      options.push({ label: productName ? `${article} - ${productName}` : article, value: article });
    }
    return options.sort((a, b) => {
      const na = Number(a.value);
      const nb = Number(b.value);
      if (!isNaN(na) && !isNaN(nb)) return nb - na;
      return b.value.localeCompare(a.value);
    });
  }, [articleGroups]);

  function isRepeatArticle(articleNumber: string): boolean {
    // DB check
    if (previousArticleSet.has(articleNumber)) return true;
    // Prefix check: article # < currentPhaseNumber * 1000
    const num = Number(articleNumber);
    if (!isNaN(num) && num < phaseNumber * 1000) return true;
    return false;
  }

  const handleAddArticle = useCallback((articleNumber: string) => {
    if (!articleNumber) return;

    const masters = articleGroups.get(articleNumber);
    if (!masters || masters.length === 0) return;

    const first = masters[0];
    const styleName = String(first.productName || first.styleNumber || articleNumber);
    const fabricName = String(first.fabricName || "");
    const fabric2Name = first.fabric2Name ? String(first.fabric2Name) : null;

    // Get all unique colours across all SKUs for this article
    const colourSet = new Set<string>();
    for (const m of masters) {
      const colours = m.coloursAvailable as string[] | undefined;
      if (colours) colours.forEach((c) => colourSet.add(c));
    }

    // Look up vendor info from FabricMaster
    const fabricInfo = fabricVendorMap.get(fabricName);
    const fabric2Info = fabric2Name ? fabricVendorMap.get(fabric2Name) : null;

    const article: SelectedArticle = {
      articleNumber,
      styleName,
      fabricName,
      fabric2Name,
      garmentsPerKg: toNum(first.garmentsPerKg),
      garmentsPerKg2: toNum(first.garmentsPerKg2),
      fabricCostPerKg: toNum(first.fabricCostPerKg) ?? fabricInfo?.mrp ?? null,
      fabric2CostPerKg: toNum(first.fabric2CostPerKg) ?? fabric2Info?.mrp ?? null,
      fabricVendorId: fabricInfo?.vendorId || "",
      fabricVendorName: fabricInfo?.vendorName || "",
      fabric2VendorId: fabric2Info?.vendorId || null,
      fabric2VendorName: fabric2Info?.vendorName || null,
      type: String(first.type || ""),
      gender: String(first.gender || "MENS"),
      productName: String(first.productName || ""),
      availableColours: Array.from(colourSet),
      colourQtys: Array.from(colourSet).map((c) => ({ colour: c, qty: 0 })),
      isRepeat: isRepeatArticle(articleNumber),
      stitchingCost: toNum(first.stitchingCost),
      brandLogoCost: toNum(first.brandLogoCost),
      neckTwillCost: toNum(first.neckTwillCost),
      reflectorsCost: toNum(first.reflectorsCost),
      fusingCost: toNum(first.fusingCost),
      accessoriesCost: toNum(first.accessoriesCost),
      brandTagCost: toNum(first.brandTagCost),
      sizeTagCost: toNum(first.sizeTagCost),
      packagingCost: toNum(first.packagingCost),
      outwardShippingCost: toNum(first.inwardShipping),
      proposedMrp: toNum(first.proposedMrp),
      onlineMrp: toNum(first.onlineMrp),
    };

    setSelectedArticles((prev) => [...prev, article]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articleGroups, fabricVendorMap, previousArticleSet, phaseNumber]);

  function removeArticle(index: number) {
    setSelectedArticles((prev) => prev.filter((_, i) => i !== index));
  }

  function updateColourQty(articleIndex: number, colourIndex: number, qty: number) {
    setSelectedArticles((prev) =>
      prev.map((a, i) =>
        i === articleIndex
          ? {
              ...a,
              colourQtys: a.colourQtys.map((cq, j) =>
                j === colourIndex ? { ...cq, qty } : cq
              ),
            }
          : a
      )
    );
  }

  // Find SKU code from ProductMaster for a given article + colour
  function findSkuCode(articleNumber: string, colour: string): string {
    const masters = articleGroups.get(articleNumber) || [];
    for (const m of masters) {
      const colours = m.coloursAvailable as string[] | undefined;
      if (colours?.includes(colour) && m.skuCode) {
        return String(m.skuCode);
      }
    }
    return "";
  }

  // Build planned orders from selections
  const { skuOrders, fabricOrders } = useMemo(() => {
    const skus: PlannedSKUOrder[] = [];
    const fabrics: PlannedFabricOrder[] = [];

    for (const article of selectedArticles) {
      for (const cq of article.colourQtys) {
        if (cq.qty <= 0) continue;

        // SKU Order
        skus.push({
          styleNumber: article.styleName,
          articleNumber: article.articleNumber,
          skuCode: findSkuCode(article.articleNumber, cq.colour),
          colourOrdered: cq.colour,
          garmentNumber: cq.qty,
          isRepeat: article.isRepeat,
          type: article.type,
          gender: article.gender,
          productName: article.productName,
          fabricVendorId: article.fabricVendorId,
          fabricName: article.fabricName,
          fabric2Name: article.fabric2Name,
          fabric2VendorId: article.fabric2VendorId,
          fabricCostPerKg: article.fabricCostPerKg,
          fabric2CostPerKg: article.fabric2CostPerKg,
          assumedFabricGarmentsPerKg: article.garmentsPerKg,
          assumedFabric2GarmentsPerKg: article.garmentsPerKg2,
          stitchingCost: article.stitchingCost,
          brandLogoCost: article.brandLogoCost,
          neckTwillCost: article.neckTwillCost,
          reflectorsCost: article.reflectorsCost,
          fusingCost: article.fusingCost,
          accessoriesCost: article.accessoriesCost,
          brandTagCost: article.brandTagCost,
          sizeTagCost: article.sizeTagCost,
          packagingCost: article.packagingCost,
          outwardShippingCost: article.outwardShippingCost,
          proposedMrp: article.proposedMrp,
          onlineMrp: article.onlineMrp,
        });

        // Fabric 1 Order
        if (article.fabricVendorId) {
          const fabricQty = article.garmentsPerKg ? cq.qty / article.garmentsPerKg : 0;
          fabrics.push({
            fabricName: article.fabricName,
            fabricVendorId: article.fabricVendorId,
            articleNumbers: article.articleNumber,
            colour: cq.colour,
            fabricOrderedQuantityKg: Math.round(fabricQty * 100) / 100,
            costPerUnit: article.fabricCostPerKg,
            isRepeat: article.isRepeat,
            gender: article.gender,
            orderStatus: "DRAFT_ORDER",
            garmentingAt: null,
          });
        }

        // Fabric 2 Order
        if (article.fabric2Name && article.fabric2VendorId) {
          const fabric2Qty = article.garmentsPerKg2 ? cq.qty / article.garmentsPerKg2 : 0;
          fabrics.push({
            fabricName: article.fabric2Name,
            fabricVendorId: article.fabric2VendorId,
            articleNumbers: article.articleNumber,
            colour: cq.colour,
            fabricOrderedQuantityKg: Math.round(fabric2Qty * 100) / 100,
            costPerUnit: article.fabric2CostPerKg,
            isRepeat: article.isRepeat,
            gender: article.gender,
            orderStatus: "DRAFT_ORDER",
            garmentingAt: null,
          });
        }
      }
    }

    return { skuOrders: skus, fabricOrders: fabrics };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedArticles]);

  async function handleCreate() {
    if (skuOrders.length === 0) {
      toast.error("No orders to create. Enter quantities for at least one colour.");
      return;
    }
    setSubmitting(true);
    try {
      await createPlanOrders(phaseId, skuOrders, fabricOrders);
      toast.success(`Created ${skuOrders.length} article orders and ${fabricOrders.length} fabric orders`);
      router.push("/products");
      router.refresh();
    } catch {
      toast.error("Failed to create orders");
    } finally {
      setSubmitting(false);
    }
  }

  if (step === "review") {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => setStep("select")}>
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
          Back to Planning
        </Button>

        <div>
          <h2 className="text-lg font-semibold mb-3">Article Orders ({skuOrders.length})</h2>
          <div className="border rounded-lg overflow-auto">
            <table className="w-full text-sm table-fixed">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium w-[20%]">Product</th>
                  <th className="px-3 py-2 text-left font-medium w-[10%]">Article #</th>
                  <th className="px-3 py-2 text-left font-medium w-[18%]">Article Code</th>
                  <th className="px-3 py-2 text-left font-medium w-[18%]">Colour</th>
                  <th className="px-3 py-2 text-right font-medium w-[12%]">Target Qty</th>
                  <th className="px-3 py-2 text-left font-medium w-[14%]">Fabric</th>
                  <th className="px-3 py-2 text-left font-medium w-[8%]">Repeat?</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {skuOrders.map((sku, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2">{sku.styleNumber}</td>
                    <td className="px-3 py-2">{sku.articleNumber}</td>
                    <td className="px-3 py-2">{sku.skuCode || "—"}</td>
                    <td className="px-3 py-2">{sku.colourOrdered}</td>
                    <td className="px-3 py-2 text-right">{sku.garmentNumber}</td>
                    <td className="px-3 py-2">{sku.fabricName}</td>
                    <td className="px-3 py-2">{sku.isRepeat ? "Yes" : "No"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-3">Fabric Orders ({fabricOrders.length})</h2>
          <div className="border rounded-lg overflow-auto">
            <table className="w-full text-sm table-fixed">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium w-[18%]">Fabric</th>
                  <th className="px-3 py-2 text-left font-medium w-[14%]">Vendor</th>
                  <th className="px-3 py-2 text-left font-medium w-[10%]">For Article</th>
                  <th className="px-3 py-2 text-left font-medium w-[18%]">Colour</th>
                  <th className="px-3 py-2 text-right font-medium w-[14%]">Ordered Qty (kg)</th>
                  <th className="px-3 py-2 text-right font-medium w-[14%]">Cost/Unit</th>
                  <th className="px-3 py-2 text-left font-medium w-[8%]">Repeat?</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {fabricOrders.map((fo, i) => {
                  const vendor = vendors.find((v) => v.id === fo.fabricVendorId);
                  return (
                    <tr key={i}>
                      <td className="px-3 py-2">{fo.fabricName}</td>
                      <td className="px-3 py-2">{vendor?.name || "—"}</td>
                      <td className="px-3 py-2">{fo.articleNumbers}</td>
                      <td className="px-3 py-2">{fo.colour}</td>
                      <td className="px-3 py-2 text-right">{fo.fabricOrderedQuantityKg}</td>
                      <td className="px-3 py-2 text-right">{fo.costPerUnit ? `Rs ${fo.costPerUnit}` : "—"}</td>
                      <td className="px-3 py-2">{fo.isRepeat ? "Yes" : "No"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex gap-3">
          <Button onClick={handleCreate} disabled={submitting || skuOrders.length === 0}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create {skuOrders.length} Article Orders + {fabricOrders.length} Fabric Orders
          </Button>
        </div>
      </div>
    );
  }

  // Step: select
  return (
    <div className="space-y-6">
      {/* Article selector */}
      <div className="flex items-end gap-3">
        <div className="w-80">
          <label className="text-sm font-medium mb-1 block">Add Article</label>
          <Combobox
            value=""
            onValueChange={handleAddArticle}
            options={articleOptions}
            placeholder="Search by article # or product name..."
          />
        </div>
      </div>

      {selectedArticles.length === 0 && (
        <p className="text-sm text-muted-foreground py-8 text-center">
          Select articles above to start planning production quantities.
        </p>
      )}

      {/* Per-article cards */}
      {selectedArticles.map((article, articleIdx) => (
        <div key={`${article.articleNumber}-${articleIdx}`} className="border rounded-lg p-4 space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">
                  {article.articleNumber} - {article.styleName}
                </h3>
                {article.isRepeat && (
                  <span className="text-xs bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded">
                    Repeat
                  </span>
                )}
              </div>
              <div className="text-sm text-muted-foreground mt-0.5 space-x-4">
                <span>Fabric: {article.fabricName} ({article.fabricVendorName || "No vendor"})</span>
                {article.fabric2Name && (
                  <span>| 2nd: {article.fabric2Name} ({article.fabric2VendorName || "No vendor"})</span>
                )}
              </div>
              <div className="text-sm text-muted-foreground space-x-4">
                <span>Garments/kg: {article.garmentsPerKg ?? "—"}</span>
                {article.garmentsPerKg2 && <span>| 2nd: {article.garmentsPerKg2}</span>}
                <span>| Type: {article.type}</span>
                <span>| Gender: {article.gender}</span>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeArticle(articleIdx)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Colour qty inputs */}
          <div className="grid gap-2">
            <div className="grid grid-cols-[1fr_80px_repeat(6,_48px)_80px] gap-1.5 text-[10px] font-medium text-muted-foreground px-1">
              <span>Colour</span>
              <span className="text-right">Target Qty</span>
              {sizes.map((s) => (
                <span key={s} className="text-center">{s}</span>
              ))}
              <span className="text-right">Fabric (kg)</span>
            </div>
            {article.colourQtys.map((cq, colourIdx) => {
              const fabricKg = cq.qty > 0 && article.garmentsPerKg
                ? (cq.qty / article.garmentsPerKg).toFixed(1)
                : "—";
              return (
                <div key={cq.colour} className="grid grid-cols-[1fr_80px_repeat(6,_48px)_80px] gap-1.5 items-center">
                  <span className="text-sm px-1">{cq.colour}</span>
                  <Input
                    type="number"
                    min={0}
                    value={cq.qty || ""}
                    onChange={(e) => updateColourQty(articleIdx, colourIdx, Number(e.target.value) || 0)}
                    className="h-8 text-right"
                    placeholder="0"
                  />
                  {sizes.map((size) => {
                    const pct = sizeDistMap.get(size) || 0;
                    const sizeQty = cq.qty > 0 ? Math.round((cq.qty * pct) / 100) : 0;
                    return (
                      <span key={size} className="text-xs text-center text-blue-600 bg-blue-50 rounded py-1">
                        {sizeQty || "-"}
                      </span>
                    );
                  })}
                  <span className="text-sm text-muted-foreground text-right px-1">{fabricKg}</span>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {selectedArticles.length > 0 && (
        <div className="flex gap-3">
          <Button
            onClick={() => {
              const hasQty = selectedArticles.some((a) => a.colourQtys.some((cq) => cq.qty > 0));
              if (!hasQty) {
                toast.error("Enter quantities for at least one colour");
                return;
              }
              setStep("review");
            }}
          >
            Review Orders ({skuOrders.length} Article + {fabricOrders.length} Fabric)
          </Button>
        </div>
      )}
    </div>
  );
}
