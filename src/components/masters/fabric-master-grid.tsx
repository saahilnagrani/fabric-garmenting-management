"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ColDef } from "ag-grid-community";
import { DataGrid } from "@/components/ag-grid/data-grid";
import { MultiTagRenderer } from "@/components/ag-grid/multi-tag-renderer";
import { createFabricMaster, updateFabricMaster } from "@/actions/fabric-masters";
import { validateFabricMaster } from "@/lib/validations";
import { Button } from "@/components/ui/button";
import { Plus, Archive, Eye, EyeOff } from "lucide-react";
import { FabricMasterSheet, type FabricMasterRow } from "./fabric-master-sheet";

type Vendor = { id: string; name: string };

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

export function FabricMasterGrid({
  masters,
  vendors,
  showArchived = false,
}: {
  masters: unknown[];
  vendors: Vendor[];
  showArchived?: boolean;
}) {
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<FabricMasterRow | null>(null);

  const rowData: FabricMasterRow[] = useMemo(
    () =>
      (masters as Record<string, unknown>[]).map((m) => ({
        id: m.id as string,
        fabricName: String(m.fabricName ?? ""),
        vendorId: String(m.vendorId ?? ""),
        genders: (m.genders as string[]) || [],
        styleNumbers: (m.styleNumbers as string[]) || [],
        coloursAvailable: (m.coloursAvailable as string[]) || [],
        mrp: toNum(m.mrp),
        isStrikedThrough: Boolean(m.isStrikedThrough),
      })),
    [masters]
  );

  const columnDefs = useMemo<ColDef<FabricMasterRow>[]>(() => {
    const vendorLabels: Record<string, string> = {};
    vendors.forEach((v) => { vendorLabels[v.id] = v.name; });

    return [
      { field: "fabricName", headerName: "Fabric Name", pinned: "left", minWidth: 150, editable: false },
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
        field: "styleNumbers",
        headerName: "Style Numbers",
        minWidth: 180,
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
    ];
  }, [vendors]);

  const defaultRow: Partial<FabricMasterRow> = {
    fabricName: "",
    vendorId: vendors[0]?.id || "",
    genders: [],
    styleNumbers: [],
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
            styleNumbers: data.styleNumbers || [],
            coloursAvailable: data.coloursAvailable || [],
            mrp: toNum(data.mrp),
          };
          return createFabricMaster(payload);
        }}
        onSave={async (id, data) => {
          const payload = {
            fabricName: data.fabricName,
            vendorId: data.vendorId,
            genders: data.genders || [],
            styleNumbers: data.styleNumbers || [],
            coloursAvailable: data.coloursAvailable || [],
            mrp: toNum(data.mrp),
          };
          return updateFabricMaster(id, payload);
        }}
        validate={validateFabricMaster}
        height="500px"
      />
      <FabricMasterSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        editingRow={editingRow}
        vendors={vendors}
      />
    </>
  );
}
