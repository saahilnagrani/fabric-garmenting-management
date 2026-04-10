"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ColDef } from "ag-grid-community";
import { DataGrid } from "@/components/ag-grid/data-grid";
import { MultiTagRenderer } from "@/components/ag-grid/multi-tag-renderer";
import { createFabricMaster, updateFabricMaster } from "@/actions/fabric-masters";
import { validateFabricMaster } from "@/lib/validations";
import { Button } from "@/components/ui/button";
import { Plus, Eye, EyeOff } from "lucide-react";
import { ManageColumnsDialog } from "@/components/ag-grid/manage-columns-dialog";
import { FabricMasterSheet, type FabricMasterRow } from "./fabric-master-sheet";

type Vendor = { id: string; name: string };

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

type Phase = { id: string; name: string; number: number };

export function FabricMasterGrid({
  masters,
  vendors,
  colours = [],
  phases = [],
  showArchived = false,
}: {
  masters: unknown[];
  vendors: Vendor[];
  colours?: string[];
  phases?: Phase[];
  showArchived?: boolean;
}) {
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<FabricMasterRow | null>(null);
  const gridApiRef = useRef<import("ag-grid-community").GridApi | null>(null);

  const rowData: FabricMasterRow[] = useMemo(
    () =>
      (masters as Record<string, unknown>[]).map((m) => ({
        id: m.id as string,
        fabricName: String(m.fabricName ?? ""),
        vendorId: String(m.vendorId ?? ""),
        genders: (m.genders as string[]) || [],
        articleNumbers: (m.articleNumbers as string[]) || [],
        deletedArticleNumbers: (m.deletedArticleNumbers as string[]) || [],
        coloursAvailable: (m.coloursAvailable as string[]) || [],
        mrp: toNum(m.mrp),
        hsnCode: (m.hsnCode as string) || null,
        comments: (m.comments as string) || null,
        isStrikedThrough: Boolean(m.isStrikedThrough),
      })),
    [masters]
  );

  const columnDefs = useMemo<ColDef<FabricMasterRow>[]>(() => {
    const vendorLabels: Record<string, string> = {};
    vendors.forEach((v) => { vendorLabels[v.id] = v.name; });

    return [
      {
        field: "fabricName", headerName: "Fabric Name", pinned: "left", minWidth: 150, editable: false,
        comparator: (a, b) => (a || "").toLowerCase().localeCompare((b || "").toLowerCase()),
      },
      {
        field: "vendorId",
        headerName: "Vendor",
        minWidth: 130,
        editable: false,
        valueFormatter: (p) => vendorLabels[p.value] || p.value || "",
      },
      {
        field: "genders",
        headerName: "Genders",
        minWidth: 120,
        editable: false,
        cellRenderer: MultiTagRenderer,
      },
      {
        field: "articleNumbers",
        headerName: "Article Numbers",
        minWidth: 180,
        editable: false,
        cellRenderer: MultiTagRenderer,
      },
      {
        field: "deletedArticleNumbers",
        headerName: "Deleted Articles",
        minWidth: 150,
        editable: false,
        cellRenderer: MultiTagRenderer,
      },
      {
        field: "coloursAvailable",
        headerName: "Colours Available",
        minWidth: 200,
        editable: false,
        cellRenderer: MultiTagRenderer,
      },
      {
        field: "mrp",
        headerName: "Cost/kg (Rs)",
        minWidth: 90,
        type: "numericColumn",
        editable: false,
      },
      {
        field: "hsnCode",
        headerName: "HSN Code",
        minWidth: 100,
        editable: false,
      },
      {
        field: "comments",
        headerName: "Comments",
        minWidth: 150,
        editable: false,
      },
    ];
  }, [vendors]);

  const defaultRow: Partial<FabricMasterRow> = {
    fabricName: "",
    vendorId: vendors[0]?.id || "",
    genders: [],
    articleNumbers: [],
    deletedArticleNumbers: [],
    coloursAvailable: [],
    mrp: null,
  };

  function handleRowClicked(data: FabricMasterRow) {
    setEditingRow(data);
    setSheetOpen(true);
  }

  function handleAddNew() {
    setEditingRow(null);
    setSheetOpen(true);
  }

  function toggleArchived() {
    const url = showArchived ? "/fabric-masters" : "/fabric-masters?showArchived=true";
    router.push(url);
  }

  return (
    <>
      <div className="flex items-center gap-2 mb-3">
        <Button variant="outline" size="sm" onClick={handleAddNew}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add Fabric
        </Button>
        <ManageColumnsDialog
          gridApiRef={gridApiRef}
          colStateKey="ag-grid-col-state-fabric-masters"
        />
        <Button variant="ghost" size="sm" onClick={toggleArchived} className="text-muted-foreground">
          {showArchived ? (
            <><EyeOff className="mr-1.5 h-3.5 w-3.5" />Hide Archived</>
          ) : (
            <><Eye className="mr-1.5 h-3.5 w-3.5" />Show Archived</>
          )}
        </Button>
      </div>
      <DataGrid<FabricMasterRow>
        gridId="fabric-masters"
        rowData={rowData}
        columnDefs={columnDefs}
        defaultRow={defaultRow}
        onGridApiReady={(api) => { gridApiRef.current = api; }}
        defaultSort={[{ colId: "fabricName", sort: "asc" }]}
        hideAddRowButtons
        onRowClicked={handleRowClicked}
        getRowClass={(params) => {
          if (params.data?.isStrikedThrough) return "opacity-40";
          return "";
        }}
        onCreate={async (data) => {
          const payload = {
            fabricName: data.fabricName,
            vendorId: data.vendorId,
            genders: data.genders || [],
            articleNumbers: data.articleNumbers || [],
            coloursAvailable: data.coloursAvailable || [],
            mrp: toNum(data.mrp),
            hsnCode: (data.hsnCode as string | null) || null,
          };
          return createFabricMaster(payload);
        }}
        onSave={async (id, data) => {
          const payload = {
            fabricName: data.fabricName,
            vendorId: data.vendorId,
            genders: data.genders || [],
            articleNumbers: data.articleNumbers || [],
            coloursAvailable: data.coloursAvailable || [],
            mrp: toNum(data.mrp),
            hsnCode: (data.hsnCode as string | null) || null,
          };
          return updateFabricMaster(id, payload);
        }}
        validate={validateFabricMaster}
        height="600px"
      />
      <FabricMasterSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        editingRow={editingRow}
        vendors={vendors}
        colours={colours}
        phases={phases}
      />
    </>
  );
}
