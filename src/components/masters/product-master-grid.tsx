"use client";

import { useMemo } from "react";
import type { ColDef } from "ag-grid-community";
import { DataGrid } from "@/components/ag-grid/data-grid";
import { MultiTagRenderer } from "@/components/ag-grid/multi-tag-renderer";
import { MultiTagEditor } from "@/components/ag-grid/multi-tag-editor";
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

type ProductMasterRow = {
  id: string;
  skuCode: string;
  styleNumber: string;
  articleNumber: string;
  fabricName: string;
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

export function ProductMasterGrid({ masters }: { masters: unknown[] }) {
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
        };
      }),
    [masters]
  );

  const genderValues = Object.keys(GENDER_LABELS);
  const genderLabels = GENDER_LABELS;

  const numCol = (field: keyof ProductMasterRow, headerName: string, width = 80): ColDef<ProductMasterRow> => ({
    field: field as string,
    headerName,
    minWidth: width,
    type: "numericColumn",
    valueParser: (p) => toNum(p.newValue),
  });

  const columnDefs = useMemo<ColDef<ProductMasterRow>[]>(
    () => [
      { field: "skuCode", headerName: "SKU", pinned: "left", minWidth: 120 },
      { field: "styleNumber", headerName: "Style #", minWidth: 100 },
      { field: "articleNumber", headerName: "Article #", minWidth: 100 },
      { field: "fabricName", headerName: "Fabric Name", minWidth: 120 },
      { field: "type", headerName: "Type", minWidth: 100 },
      {
        field: "gender",
        headerName: "Gender",
        minWidth: 90,
        cellEditor: "agSelectCellEditor",
        cellEditorParams: { values: genderValues },
        valueFormatter: (p) => genderLabels[p.value] || p.value || "",
      },
      { field: "productName", headerName: "Product Name", minWidth: 130 },
      {
        field: "coloursAvailable",
        headerName: "Colours (Primary)",
        minWidth: 180,
        cellRenderer: MultiTagRenderer,
        cellEditor: MultiTagEditor,
      },
      {
        field: "colours2Available",
        headerName: "Colours (2nd)",
        minWidth: 150,
        cellRenderer: MultiTagRenderer,
        cellEditor: MultiTagEditor,
      },
      numCol("garmentsPerKg", "No of Garments/kg (Fabric 1)", 140),
      numCol("garmentsPerKg2", "No of Garments/kg (Fabric 2)", 140),
      numCol("stitchingCost", "Stitching Cost (Rs)", 110),
      numCol("brandLogoCost", "Logo Cost (Rs)", 95),
      numCol("neckTwillCost", "Neck Twill Cost (Rs)", 110),
      numCol("reflectorsCost", "Reflectors Cost (Rs)", 110),
      numCol("fusingCost", "Fusing Cost (Rs)", 100),
      numCol("accessoriesCost", "Accessories Cost (Rs)", 115),
      numCol("brandTagCost", "Brand Tag Cost (Rs)", 110),
      numCol("sizeTagCost", "Size Tag Cost (Rs)", 105),
      numCol("packagingCost", "Packaging Cost (Rs)", 110),
      {
        headerName: "Total Garmenting Cost (Rs)",
        minWidth: 130,
        editable: false,
        cellClass: "computed-cell",
        valueGetter: (p) => (p.data ? computeTotalGarmenting(p.data) : 0),
        valueFormatter: (p) => formatCurrency(p.value),
      },
      numCol("fabricCostPerKg", "Fabric 1 Cost/kg", 100),
      numCol("fabric2CostPerKg", "Fabric 2 Cost/kg", 100),
      {
        headerName: "Fabric Cost per Piece (Rs)",
        minWidth: 125,
        editable: false,
        cellClass: "computed-cell",
        valueGetter: (p) => (p.data ? computeFabricCostPerPiece(p.data) : 0),
        valueFormatter: (p) => formatCurrency(p.value),
      },
      {
        headerName: "Total Cost per piece (Rs)",
        minWidth: 125,
        editable: false,
        cellClass: "computed-cell",
        valueGetter: (p) => (p.data ? computeTotalCost(p.data) : 0),
        valueFormatter: (p) => formatCurrency(p.value),
      },
      numCol("inwardShipping", "Shipping Cost per piece (Rs)", 125),
      {
        headerName: "Total Landed Cost per piece (Rs)",
        minWidth: 145,
        editable: false,
        cellClass: "computed-cell",
        valueGetter: (p) => (p.data ? computeTotalLandedCost(p.data) : 0),
        valueFormatter: (p) => formatCurrency(p.value),
      },
      {
        headerName: "Dealer Price (50% off)",
        minWidth: 115,
        editable: false,
        cellClass: "computed-cell",
        valueGetter: (p) => (p.data ? computeDealerPrice(p.data.proposedMrp) : 0),
        valueFormatter: (p) => formatCurrency(p.value),
      },
      {
        headerName: "Profit Margin (%)",
        minWidth: 100,
        editable: false,
        cellClass: "computed-cell",
        valueGetter: (p) => {
          if (!p.data) return 0;
          // Use proposedMrp for PM calculation in masters
          const d = { ...p.data, mrp: p.data.proposedMrp };
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

  return (
    <DataGrid<ProductMasterRow>
      gridId="product-masters"
      rowData={rowData}
      columnDefs={columnDefs}
      defaultRow={defaultRow}
      onCreate={async (data) => {
        const payload = {
          skuCode: data.skuCode,
          styleNumber: data.styleNumber,
          articleNumber: data.articleNumber || null,
          fabricName: data.fabricName,
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
      onStrikethrough={async (id, isStrikedThrough) => updateProductMaster(id, { isStrikedThrough })}
      validate={validateProductMaster}
      height="600px"
    />
  );
}
