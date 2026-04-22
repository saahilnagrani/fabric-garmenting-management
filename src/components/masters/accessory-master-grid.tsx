"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ColDef } from "ag-grid-community";
import { DataGrid } from "@/components/ag-grid/data-grid";
import { Button } from "@/components/ui/button";
import { Plus, Eye, EyeOff } from "lucide-react";
import { ManageColumnsDialog } from "@/components/ag-grid/manage-columns-dialog";
import { AccessoryMasterSheet, type AccessoryMasterRow } from "./accessory-master-sheet";
import { accessoryDisplayName } from "@/lib/accessory-display";

type Vendor = { id: string; name: string };

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

type ArticleCodeOption = { value: string; label: string };

export function AccessoryMasterGrid({
  masters,
  vendors,
  categories,
  articleCodes,
  showArchived = false,
}: {
  masters: unknown[];
  vendors: Vendor[];
  categories: string[];
  articleCodes: ArticleCodeOption[];
  showArchived?: boolean;
}) {
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<AccessoryMasterRow | null>(null);
  const gridApiRef = useRef<import("ag-grid-community").GridApi | null>(null);

  const rowData: AccessoryMasterRow[] = useMemo(
    () =>
      (masters as Record<string, unknown>[]).map((m) => {
        const attrs = (m.attributes as Record<string, unknown> | null) ?? {};
        const displayName = accessoryDisplayName({
          displayName: m.displayName as string | null,
          category: m.category as string | null,
          attributes: attrs,
          baseName: (m.baseName as string | null) ?? null,
          colour: (m.colour as string | null) ?? null,
          size: (m.size as string | null) ?? null,
        });
        return {
          id: m.id as string,
          baseName: (m.baseName as string | null) ?? null,
          colour: (m.colour as string | null) ?? null,
          size: (m.size as string | null) ?? null,
          category: String(m.category ?? ""),
          attributes: attrs,
          priceTiers: (m.priceTiers as unknown[] | null) ?? [],
          unit: String(m.unit ?? "PIECES"),
          vendorId: (m.vendorId as string | null) ?? null,
          defaultCostPerUnit: toNum(m.defaultCostPerUnit),
          hsnCode: (m.hsnCode as string | null) ?? null,
          comments: (m.comments as string | null) ?? null,
          imageUrl: (m.imageUrl as string | null) ?? null,
          articleCodeUnits: (
            (m.productLinks as Array<{ productMaster: { skuCode: string }; quantityPerPiece: unknown }> | null) ?? []
          ).map((l) => ({ code: l.productMaster.skuCode, units: Number(l.quantityPerPiece) })),
          isStrikedThrough: Boolean(m.isStrikedThrough),
          displayName,
        };
      }),
    [masters]
  );

  const columnDefs = useMemo<ColDef<AccessoryMasterRow>[]>(() => {
    const vendorLabels: Record<string, string> = {};
    vendors.forEach((v) => { vendorLabels[v.id] = v.name; });

    return [
      {
        field: "displayName",
        headerName: "Accessory",
        pinned: "left",
        minWidth: 260,
        editable: false,
      },
      {
        field: "category",
        headerName: "Category",
        minWidth: 120,
        editable: false,
        valueFormatter: (p) => {
          const label = p.value as string;
          // Humanize ALL_CAPS category codes like "REFLECTOR" -> "Reflector"
          if (!label) return "";
          return label.charAt(0) + label.slice(1).toLowerCase().replace(/_/g, " ");
        },
      },
      { field: "unit", headerName: "Unit", minWidth: 90, editable: false },
      {
        field: "vendorId",
        headerName: "Vendor",
        minWidth: 140,
        editable: false,
        valueFormatter: (p) => (p.value ? vendorLabels[p.value] || p.value : ""),
      },
      {
        field: "defaultCostPerUnit",
        headerName: "Default Cost",
        minWidth: 110,
        editable: false,
        type: "numericColumn",
      },
      {
        headerName: "Tiers",
        minWidth: 80,
        editable: false,
        valueGetter: (p) => (p.data?.priceTiers as unknown[] | null)?.length ?? 0,
        cellRenderer: (params: { value: number }) =>
          params.value > 0 ? (
            <span className="inline-flex items-center rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-200 dark:border-emerald-800 px-1.5 text-[11px] font-medium whitespace-nowrap h-5">
              {params.value} tier{params.value === 1 ? "" : "s"}
            </span>
          ) : null,
      },
      {
        headerName: "Articles",
        minWidth: 90,
        editable: false,
        valueGetter: (p) => (p.data?.articleCodeUnits as unknown[] | null)?.length ?? 0,
        cellRenderer: (params: { value: number }) =>
          params.value > 0 ? (
            <span className="inline-flex items-center rounded-md bg-blue-100 text-blue-800 border border-blue-200 dark:bg-blue-900/40 dark:text-blue-200 dark:border-blue-800 px-1.5 text-[11px] font-medium whitespace-nowrap h-5">
              {params.value} article{params.value === 1 ? "" : "s"}
            </span>
          ) : null,
      },
      {
        headerName: "Image",
        minWidth: 70,
        editable: false,
        valueGetter: (p) => (p.data?.imageUrl as string | null) ?? null,
        cellRenderer: (params: { value: string | null }) => {
          if (!params.value) return null;
          function openImage() {
            const dataUrl = params.value as string;
            // Browsers block navigating to data: URLs in new tabs.
            // Convert to a blob URL instead so the image opens correctly.
            if (dataUrl.startsWith("data:")) {
              const [header, b64] = dataUrl.split(",");
              const mime = header.match(/:(.*?);/)?.[1] ?? "image/jpeg";
              const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
              const blob = new Blob([bytes], { type: mime });
              const url = URL.createObjectURL(blob);
              window.open(url, "_blank");
              setTimeout(() => URL.revokeObjectURL(url), 15_000);
            } else {
              window.open(dataUrl, "_blank");
            }
          }
          return (
            <button onClick={openImage} className="text-[11px] text-blue-600 underline cursor-pointer">
              View
            </button>
          );
        },
      },
      { field: "hsnCode", headerName: "HSN", minWidth: 90, editable: false },
      { field: "comments", headerName: "Comments", minWidth: 150, editable: false },
    ];
  }, [vendors]);

  const defaultRow: Partial<AccessoryMasterRow> = {
    baseName: "",
    colour: null,
    size: null,
    category: "",
    unit: "PIECES",
    vendorId: null,
    defaultCostPerUnit: null,
  };

  function handleRowClicked(data: AccessoryMasterRow) {
    setEditingRow(data);
    setSheetOpen(true);
  }
  function handleAddNew() {
    setEditingRow(null);
    setSheetOpen(true);
  }
  function toggleArchived() {
    router.push(showArchived ? "/accessory-masters" : "/accessory-masters?showArchived=true");
  }

  return (
    <>
      <div className="flex items-center gap-2 mb-3">
        <Button variant="outline" size="sm" onClick={handleAddNew}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add Accessory
        </Button>
        <ManageColumnsDialog
          gridApiRef={gridApiRef}
          colStateKey="ag-grid-col-state-accessory-masters"
        />
        <Button variant="ghost" size="sm" onClick={toggleArchived} className="text-muted-foreground">
          {showArchived ? (
            <><EyeOff className="mr-1.5 h-3.5 w-3.5" />Hide Archived</>
          ) : (
            <><Eye className="mr-1.5 h-3.5 w-3.5" />Show Archived</>
          )}
        </Button>
      </div>
      <DataGrid<AccessoryMasterRow>
        gridId="accessory-masters"
        rowData={rowData}
        columnDefs={columnDefs}
        defaultRow={defaultRow}
        onGridApiReady={(api) => { gridApiRef.current = api; }}
        defaultSort={[{ colId: "displayName", sort: "asc" }]}
        hideAddRowButtons
        onRowClicked={handleRowClicked}
        getRowClass={(params) => (params.data?.isStrikedThrough ? "opacity-40" : "")}
        // Master grid is read-only — sheet handles all writes. Stub onCreate/onSave.
        onCreate={async () => undefined}
        onSave={async () => undefined}
        height="600px"
      />
      <AccessoryMasterSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        editingRow={editingRow}
        vendors={vendors}
        categories={categories}
        articleCodes={articleCodes}
      />
    </>
  );
}
