"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ColDef } from "ag-grid-community";
import { DataGrid } from "@/components/ag-grid/data-grid";
import { MultiTagRenderer } from "@/components/ag-grid/multi-tag-renderer";
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
import { ManageColumnsDialog } from "@/components/ag-grid/manage-columns-dialog";
import { ProductMasterSheet, type GroupedStyleRow } from "./product-master-sheet";

type FabricData = { name: string; mrp: number | null };
type Phase = { id: string; name: string; number: number };
type ProductTypeWithCode = { name: string; code: string };
type ColourWithCode = { name: string; code: string };
type AccessoryOption = { id: string; label: string; unit: string };

export function ProductMasterGrid({
  groupedMasters,
  productTypes = [],
  productTypesWithCode = [],
  fabricData = [],
  colours = [],
  coloursWithCode = [],
  phases = [],
  accessories = [],
  garmentingLocations = [],
  showArchived = false,
}: {
  groupedMasters: GroupedStyleRow[];
  productTypes?: string[];
  productTypesWithCode?: ProductTypeWithCode[];
  fabricData?: FabricData[];
  colours?: string[];
  coloursWithCode?: ColourWithCode[];
  phases?: Phase[];
  accessories?: AccessoryOption[];
  garmentingLocations?: string[];
  showArchived?: boolean;
}) {
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<GroupedStyleRow | null>(null);
  const gridApiRef = useRef<import("ag-grid-community").GridApi | null>(null);

  const genderLabels = GENDER_LABELS;

  const columnDefs = useMemo<ColDef<GroupedStyleRow>[]>(
    () => [
      { field: "articleNumber", headerName: "Article #", pinned: "left", minWidth: 100, editable: false },
      {
        field: "manuallyCleanedAt",
        headerName: "Cleaned",
        minWidth: 70,
        maxWidth: 100,
        editable: false,
        cellStyle: { display: "flex", alignItems: "center", justifyContent: "center" } as Record<string, string>,
        valueFormatter: (p) => (p.value ? "✓" : ""),
        cellClass: (p) => (p.value ? "text-emerald-600 font-bold" : ""),
        tooltipValueGetter: (p) => (p.value ? `Manually cleaned on ${new Date(p.value as string).toLocaleString()}` : ""),
      },
      { field: "styleNumber", headerName: "Style # (legacy)", minWidth: 80, editable: false },
      { field: "fabricName", headerName: "Fabric", minWidth: 100, editable: false },
      { field: "type", headerName: "Product Type", minWidth: 70, editable: false },
      {
        field: "gender",
        headerName: "Gender",
        minWidth: 60,
        editable: false,
        valueFormatter: (p) => genderLabels[p.value] || p.value || "",
      },
      { field: "productName", headerName: "Product Name", minWidth: 100, editable: false },
      {
        field: "colours",
        headerName: "Colours",
        minWidth: 150,
        editable: false,
        cellRenderer: MultiTagRenderer,
        cellStyle: { display: "flex", alignItems: "center" },
      },
      {
        field: "skuCount",
        headerName: "Variants",
        minWidth: 50,
        editable: false,
        type: "numericColumn",
      },
      {
        headerName: "Total Garmenting (Rs)",
        minWidth: 70,
        editable: false,
        cellClass: "computed-cell",
        valueGetter: (p) => (p.data ? computeTotalGarmenting(p.data) : 0),
        valueFormatter: (p) => formatCurrency(p.value),
      },
      {
        field: "fabricCostPerKg",
        headerName: "Fabric Cost/kg",
        minWidth: 70,
        editable: false,
        type: "numericColumn",
      },
      {
        headerName: "Fabric Cost/Piece (Rs)",
        minWidth: 70,
        editable: false,
        cellClass: "computed-cell",
        valueGetter: (p) =>
          p.data
            ? computeFabricCostPerPiece({
                ...p.data,
                assumedFabricGarmentsPerKg: p.data.garmentsPerKg,
                assumedFabric2GarmentsPerKg: p.data.garmentsPerKg2,
              })
            : 0,
        valueFormatter: (p) => formatCurrency(p.value),
      },
      {
        headerName: "Total Cost/Piece (Rs)",
        minWidth: 70,
        editable: false,
        cellClass: "computed-cell",
        valueGetter: (p) =>
          p.data
            ? computeTotalCost({
                ...p.data,
                assumedFabricGarmentsPerKg: p.data.garmentsPerKg,
                assumedFabric2GarmentsPerKg: p.data.garmentsPerKg2,
              })
            : 0,
        valueFormatter: (p) => formatCurrency(p.value),
      },
      {
        headerName: "Landed Cost/Piece (Rs)",
        minWidth: 70,
        editable: false,
        cellClass: "computed-cell",
        valueGetter: (p) =>
          p.data
            ? computeTotalLandedCost({
                ...p.data,
                assumedFabricGarmentsPerKg: p.data.garmentsPerKg,
                assumedFabric2GarmentsPerKg: p.data.garmentsPerKg2,
                outwardShippingCost: p.data.inwardShipping,
              })
            : 0,
        valueFormatter: (p) => formatCurrency(p.value),
      },
      {
        field: "proposedMrp",
        headerName: "MRP (Rs)",
        minWidth: 60,
        editable: false,
        type: "numericColumn",
      },
      {
        headerName: "Dealer Price (50%)",
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
          return computeProfitMargin({
            ...p.data,
            assumedFabricGarmentsPerKg: p.data.garmentsPerKg,
            assumedFabric2GarmentsPerKg: p.data.garmentsPerKg2,
            outwardShippingCost: p.data.inwardShipping,
          });
        },
        valueFormatter: (p) => formatPercent(p.value),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  function handleRowClicked(data: GroupedStyleRow) {
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
          Add Article
        </Button>
        <ManageColumnsDialog
          gridApiRef={gridApiRef}
          colStateKey="ag-grid-col-state-product-masters"
        />
        <Button variant="ghost" size="sm" onClick={toggleArchived} className="text-muted-foreground">
          {showArchived ? (
            <><EyeOff className="mr-1.5 h-3.5 w-3.5" />Hide Archived</>
          ) : (
            <><Eye className="mr-1.5 h-3.5 w-3.5" />Show Archived</>
          )}
        </Button>
      </div>
      <DataGrid<GroupedStyleRow>
        gridId="product-masters"
        rowData={groupedMasters}
        onGridApiReady={(api) => { gridApiRef.current = api; }}
        columnDefs={columnDefs}
        defaultSort={[{ colId: "articleNumber", sort: "desc" }]}
        defaultRow={{}}
        onSave={async () => {}}
        onCreate={async () => {}}
        hideAddRowButtons
        getRowId={(data) => data.articleNumber}
        onRowClicked={handleRowClicked}
        getRowClass={(params) => {
          if (params.data?.isStrikedThrough) return "opacity-40";
          return "";
        }}
        height="600px"
      />
      <ProductMasterSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        editingRow={editingRow}
        productTypes={productTypes}
        productTypesWithCode={productTypesWithCode}
        fabricData={fabricData}
        colours={colours}
        coloursWithCode={coloursWithCode}
        phases={phases}
        accessories={accessories}
        garmentingLocations={garmentingLocations}
      />
    </>
  );
}
