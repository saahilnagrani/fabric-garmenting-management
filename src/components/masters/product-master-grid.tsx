"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ColDef } from "ag-grid-community";
import { DataGrid } from "@/components/ag-grid/data-grid";
import { MultiTagRenderer } from "@/components/ag-grid/multi-tag-renderer";
import { createProductMaster, updateProductMaster } from "@/actions/product-masters";
import { validateProductMaster } from "@/lib/validations";
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
import { Button } from "@/components/ui/button";
import { Plus, Eye, EyeOff } from "lucide-react";
import { ProductMasterSheet, type ProductMasterRow } from "./product-master-sheet";

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

type FabricData = { name: string; mrp: number | null };

export function ProductMasterGrid({ masters, productTypes = [], fabricData = [], showArchived = false }: { masters: unknown[]; productTypes?: string[]; fabricData?: FabricData[]; showArchived?: boolean }) {
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<ProductMasterRow | null>(null);

  const rowData: ProductMasterRow[] = useMemo(
    () =>
      (masters as Record<string, unknown>[]).map((m) => {
        const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));
        return {
          id: m.id as string,
          skuCode: s(m.skuCode),
          styleNumber: s(m.styleNumber),
          articleNumber: s(m.articleNumber),
          fabricName: s(m.fabricName),
          fabric2Name: s(m.fabric2Name),
          type: s(m.type),
          gender: s(m.gender),
          productName: s(m.productName),
          coloursAvailable: (m.coloursAvailable as string[]) || [],
          colours2Available: (m.colours2Available as string[]) || [],
          garmentsPerKg: toNum(m.garmentsPerKg),
          garmentsPerKg2: toNum(m.garmentsPerKg2),
          stitchingCost: toNum(m.stitchingCost),
          brandLogoCost: toNum(m.brandLogoCost),
          neckTwillCost: toNum(m.neckTwillCost),
          reflectorsCost: toNum(m.reflectorsCost),
          fusingCost: toNum(m.fusingCost),
          accessoriesCost: toNum(m.accessoriesCost),
          brandTagCost: toNum(m.brandTagCost),
          sizeTagCost: toNum(m.sizeTagCost),
          packagingCost: toNum(m.packagingCost),
          fabricCostPerKg: toNum(m.fabricCostPerKg),
          fabric2CostPerKg: toNum(m.fabric2CostPerKg),
          inwardShipping: toNum(m.inwardShipping),
          proposedMrp: toNum(m.proposedMrp),
          onlineMrp: toNum(m.onlineMrp),
          isStrikedThrough: Boolean(m.isStrikedThrough),
        };
      }),
    [masters]
  );

  const genderLabels = GENDER_LABELS;

  const numCol = (field: keyof ProductMasterRow, headerName: string, width = 80): ColDef<ProductMasterRow> => ({
    field: field as string,
    headerName,
    minWidth: width,
    type: "numericColumn",
    editable: false,
  });

  const columnDefs = useMemo<ColDef<ProductMasterRow>[]>(
    () => [
      { field: "skuCode", headerName: "SKU", pinned: "left", minWidth: 70, editable: false },
      { field: "styleNumber", headerName: "Style #", minWidth: 60, editable: false },
      { field: "articleNumber", headerName: "Article #", minWidth: 60, editable: false },
      { field: "fabricName", headerName: "Fabric Name", minWidth: 70, editable: false },
      { field: "fabric2Name", headerName: "2nd Fabric Name", minWidth: 70, editable: false },
      { field: "type", headerName: "Type", minWidth: 60, editable: false },
      {
        field: "gender",
        headerName: "Gender",
        minWidth: 60,
        editable: false,
        valueFormatter: (p) => genderLabels[p.value] || p.value || "",
      },
      { field: "productName", headerName: "Product Name", minWidth: 70, editable: false },
      {
        field: "coloursAvailable",
        headerName: "Colours (Primary)",
        minWidth: 80,
        editable: false,
        cellRenderer: MultiTagRenderer,
      },
      {
        field: "colours2Available",
        headerName: "Colours (2nd)",
        minWidth: 80,
        editable: false,
        cellRenderer: MultiTagRenderer,
      },
      numCol("garmentsPerKg", "No of Garments/kg (Fabric 1)"),
      numCol("garmentsPerKg2", "No of Garments/kg (Fabric 2)"),
      numCol("stitchingCost", "Stitching Cost (Rs)"),
      numCol("brandLogoCost", "Logo Cost (Rs)"),
      numCol("neckTwillCost", "Neck Twill Cost (Rs)"),
      numCol("reflectorsCost", "Reflectors Cost (Rs)"),
      numCol("fusingCost", "Fusing Cost (Rs)"),
      numCol("accessoriesCost", "Accessories Cost (Rs)"),
      numCol("brandTagCost", "Brand Tag Cost (Rs)"),
      numCol("sizeTagCost", "Size Tag Cost (Rs)"),
      numCol("packagingCost", "Packaging Cost (Rs)"),
      {
        headerName: "Total Garmenting Cost (Rs)",
        minWidth: 70,
        editable: false,
        cellClass: "computed-cell",
        valueGetter: (p) => (p.data ? computeTotalGarmenting(p.data) : 0),
        valueFormatter: (p) => formatCurrency(p.value),
      },
      numCol("fabricCostPerKg", "Fabric 1 Cost/kg"),
      numCol("fabric2CostPerKg", "Fabric 2 Cost/kg"),
      {
        headerName: "Fabric Cost per Piece (Rs)",
        minWidth: 70,
        editable: false,
        cellClass: "computed-cell",
        valueGetter: (p) => (p.data ? computeFabricCostPerPiece({ ...p.data, assumedFabricGarmentsPerKg: p.data.garmentsPerKg, assumedFabric2GarmentsPerKg: p.data.garmentsPerKg2 }) : 0),
        valueFormatter: (p) => formatCurrency(p.value),
      },
      {
        headerName: "Total Cost per piece (Rs)",
        minWidth: 70,
        editable: false,
        cellClass: "computed-cell",
        valueGetter: (p) => (p.data ? computeTotalCost({ ...p.data, assumedFabricGarmentsPerKg: p.data.garmentsPerKg, assumedFabric2GarmentsPerKg: p.data.garmentsPerKg2 }) : 0),
        valueFormatter: (p) => formatCurrency(p.value),
      },
      numCol("inwardShipping", "Outward Shipping Cost (Rs)"),
      {
        headerName: "Total Landed Cost per piece (Rs)",
        minWidth: 70,
        editable: false,
        cellClass: "computed-cell",
        valueGetter: (p) => (p.data ? computeTotalLandedCost({ ...p.data, assumedFabricGarmentsPerKg: p.data.garmentsPerKg, assumedFabric2GarmentsPerKg: p.data.garmentsPerKg2, outwardShippingCost: p.data.inwardShipping }) : 0),
        valueFormatter: (p) => formatCurrency(p.value),
      },
      numCol("proposedMrp", "Proposed MRP (Rs)"),
      numCol("onlineMrp", "Online MRP (Rs)"),
      {
        headerName: "Dealer Price (50% off)",
        minWidth: 70,
        editable: false,
        cellClass: "computed-cell",
        valueGetter: (p) => (p.data ? computeDealerPrice(p.data.proposedMrp) : 0),
        valueFormatter: (p) => formatCurrency(p.value),
      },
      {
        headerName: "Profit Margin (%)",
        minWidth: 60,
        editable: false,
        cellClass: "computed-cell",
        valueGetter: (p) => {
          if (!p.data) return 0;
          // Use proposedMrp for PM calculation in masters
          const d = { ...p.data, proposedMrp: p.data.proposedMrp, assumedFabricGarmentsPerKg: p.data.garmentsPerKg, assumedFabric2GarmentsPerKg: p.data.garmentsPerKg2, outwardShippingCost: p.data.inwardShipping };
          return computeProfitMargin(d);
        },
        valueFormatter: (p) => formatPercent(p.value),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const defaultRow: Partial<ProductMasterRow> = {
    skuCode: "",
    styleNumber: "",
    articleNumber: "",
    fabricName: "",
    type: "",
    gender: "MENS",
    productName: "",
    coloursAvailable: [],
    colours2Available: [],
  };

  function handleRowClicked(data: ProductMasterRow) {
    setEditingRow(data);
    setSheetOpen(true);
  }

  function handleAddNew() {
    setEditingRow(null);
    setSheetOpen(true);
  }

  function toggleArchived() {
    const url = showArchived ? "/product-masters" : "/product-masters?showArchived=true";
    router.push(url);
  }

  return (
    <>
      <div className="flex items-center gap-2 mb-3">
        <Button variant="outline" size="sm" onClick={handleAddNew}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add SKU/Style
        </Button>
        <Button variant="ghost" size="sm" onClick={toggleArchived} className="text-muted-foreground">
          {showArchived ? (
            <><EyeOff className="mr-1.5 h-3.5 w-3.5" />Hide Archived</>
          ) : (
            <><Eye className="mr-1.5 h-3.5 w-3.5" />Show Archived</>
          )}
        </Button>
      </div>
      <DataGrid<ProductMasterRow>
        gridId="product-masters"
        rowData={rowData}
        columnDefs={columnDefs}
        defaultRow={defaultRow}
        defaultSort={[{ colId: "articleNumber", sort: "desc" }]}
        hideAddRowButtons
        onRowClicked={handleRowClicked}
        getRowClass={(params) => {
          if (params.data?.isStrikedThrough) return "opacity-40";
          return "";
        }}
        onCreate={async (data) => {
        const payload = {
          skuCode: data.skuCode,
          styleNumber: data.styleNumber,
          articleNumber: data.articleNumber || null,
          fabricName: data.fabricName,
          fabric2Name: data.fabric2Name || null,
          type: data.type,
          gender: data.gender || "MENS",
          productName: data.productName || null,
          coloursAvailable: data.coloursAvailable || [],
          colours2Available: data.colours2Available || [],
          garmentsPerKg: toNum(data.garmentsPerKg),
          garmentsPerKg2: toNum(data.garmentsPerKg2),
          stitchingCost: toNum(data.stitchingCost),
          brandLogoCost: toNum(data.brandLogoCost),
          neckTwillCost: toNum(data.neckTwillCost),
          reflectorsCost: toNum(data.reflectorsCost),
          fusingCost: toNum(data.fusingCost),
          accessoriesCost: toNum(data.accessoriesCost),
          brandTagCost: toNum(data.brandTagCost),
          sizeTagCost: toNum(data.sizeTagCost),
          packagingCost: toNum(data.packagingCost),
          fabricCostPerKg: toNum(data.fabricCostPerKg),
          fabric2CostPerKg: toNum(data.fabric2CostPerKg),
          inwardShipping: toNum(data.inwardShipping),
          proposedMrp: toNum(data.proposedMrp),
          onlineMrp: toNum(data.onlineMrp),
        };
        return createProductMaster(payload);
      }}
      onSave={async (id, data) => {
        const payload = {
          skuCode: data.skuCode,
          styleNumber: data.styleNumber,
          articleNumber: data.articleNumber || null,
          fabricName: data.fabricName,
          fabric2Name: data.fabric2Name || null,
          type: data.type,
          gender: data.gender || "MENS",
          productName: data.productName || null,
          coloursAvailable: data.coloursAvailable || [],
          colours2Available: data.colours2Available || [],
          garmentsPerKg: toNum(data.garmentsPerKg),
          garmentsPerKg2: toNum(data.garmentsPerKg2),
          stitchingCost: toNum(data.stitchingCost),
          brandLogoCost: toNum(data.brandLogoCost),
          neckTwillCost: toNum(data.neckTwillCost),
          reflectorsCost: toNum(data.reflectorsCost),
          fusingCost: toNum(data.fusingCost),
          accessoriesCost: toNum(data.accessoriesCost),
          brandTagCost: toNum(data.brandTagCost),
          sizeTagCost: toNum(data.sizeTagCost),
          packagingCost: toNum(data.packagingCost),
          fabricCostPerKg: toNum(data.fabricCostPerKg),
          fabric2CostPerKg: toNum(data.fabric2CostPerKg),
          inwardShipping: toNum(data.inwardShipping),
          proposedMrp: toNum(data.proposedMrp),
          onlineMrp: toNum(data.onlineMrp),
        };
        return updateProductMaster(id, payload);
      }}
      validate={validateProductMaster}
      height="600px"
    />
      <ProductMasterSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        editingRow={editingRow}
        productTypes={productTypes}
        fabricData={fabricData}
      />
    </>
  );
}
