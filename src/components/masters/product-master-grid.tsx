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
import { formatCurrency, formatPercent, formatNumber } from "@/lib/formatters";
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
  fabricVendorByName = {},
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
  fabricVendorByName?: Record<string, string>;
}) {
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<GroupedStyleRow | null>(null);
  const gridApiRef = useRef<import("ag-grid-community").GridApi | null>(null);
  // Hold fabric→vendor map in a ref so the column defs don't rebuild
  // when the parent re-renders with a new (but content-equivalent) object.
  const fabricVendorByNameRef = useRef(fabricVendorByName);
  fabricVendorByNameRef.current = fabricVendorByName;

  const genderLabels = GENDER_LABELS;

  const numCol = (field: keyof GroupedStyleRow, headerName: string, w = 90): ColDef<GroupedStyleRow> => ({
    field, headerName, minWidth: w, editable: false, type: "numericColumn",
    valueFormatter: (p) => (p.value === null || p.value === undefined || p.value === "" ? "" : formatNumber(p.value as number | string)),
  });

  const columnDefs = useMemo<ColDef<GroupedStyleRow>[]>(
    () => [
      // Pinned identity columns (mirrors Article Orders pin convention)
      { field: "articleNumber", headerName: "Article Number", pinned: "left", minWidth: 100, editable: false },
      { field: "fabricName", headerName: "Fabric 1", pinned: "left", minWidth: 110, editable: false },
      { field: "productName", headerName: "Product Name", pinned: "left", minWidth: 110, editable: false },
      // Visible columns aligned with Article Orders order
      {
        colId: "fabric1Vendor",
        headerName: "Fabric 1 Vendor",
        minWidth: 110,
        editable: false,
        valueGetter: (p) => {
          const name = p.data?.fabricName;
          if (!name) return "";
          return fabricVendorByNameRef.current[name] || "";
        },
      },
      { field: "fabric2Name", headerName: "Fabric 2", minWidth: 110, editable: false },
      { field: "type", headerName: "Type", minWidth: 90, editable: false },
      {
        field: "colours",
        headerName: "Colours",
        minWidth: 150,
        editable: false,
        cellRenderer: MultiTagRenderer,
        cellStyle: { display: "flex", alignItems: "center" },
      },
      { field: "garmentingAt", headerName: "Garmenting At", minWidth: 110, editable: false, valueFormatter: (p) => p.value || "—" },
      numCol("garmentsPerKg", "Fabric 1 Garments/Kg", 130),
      numCol("fabricCostPerKg", "Fabric Cost/kg", 95),
      numCol("stitchingCost", "Stitching Cost", 110),
      numCol("brandLogoCost", "Logo Cost", 95),
      numCol("neckTwillCost", "Neck Twill", 100),
      numCol("reflectorsCost", "Reflectors", 100),
      numCol("fusingCost", "Fusing", 90),
      numCol("accessoriesCost", "Accessories", 105),
      numCol("brandTagCost", "Brand Tag Cost", 110),
      numCol("sizeTagCost", "Size Tag/hyperballik", 130),
      numCol("packagingCost", "Packaging", 100),
      {
        headerName: "Total Garmenting",
        minWidth: 120,
        editable: false,
        cellClass: "computed-cell",
        valueGetter: (p) => (p.data ? computeTotalGarmenting(p.data) : 0),
        valueFormatter: (p) => formatCurrency(p.value),
      },
      {
        headerName: "Fabric Cost/Piece",
        minWidth: 115,
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
        headerName: "Total Cost Per Piece",
        minWidth: 120,
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
      numCol("inwardShipping", "Inward Shipping", 110),
      {
        headerName: "Total Landed Cost Per Piece",
        minWidth: 140,
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
        field: "proposedMrp", headerName: "Proposed MRP", minWidth: 100, editable: false, type: "numericColumn",
        valueFormatter: (p) => (p.value === null || p.value === undefined || p.value === "" ? "" : formatNumber(p.value as number | string)),
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
        headerName: "Profit Margin",
        minWidth: 100,
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
      // Master-only fields at the end
      {
        field: "skuCount",
        headerName: "Variants",
        minWidth: 70,
        editable: false,
        type: "numericColumn",
      },
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
      {
        field: "gender",
        headerName: "Gender",
        minWidth: 80,
        editable: false,
        valueFormatter: (p) => genderLabels[p.value] || p.value || "",
      },
      { field: "styleNumber", headerName: "Style # (legacy)", minWidth: 100, editable: false },
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
