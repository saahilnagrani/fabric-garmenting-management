"use client";

import { useMemo } from "react";
import type { ColDef } from "ag-grid-community";
import { DataGrid } from "@/components/ag-grid/data-grid";
import { MultiTagRenderer } from "@/components/ag-grid/multi-tag-renderer";
import { MultiTagEditor } from "@/components/ag-grid/multi-tag-editor";
import { createFabricMaster, updateFabricMaster } from "@/actions/fabric-masters";
import { validateFabricMaster } from "@/lib/validations";

type FabricMasterRow = {
  id: string;
  fabricName: string;
  vendorId: string;
  genders: string[];
  styleNumbers: string[];
  coloursAvailable: string[];
  mrp: number | null;
  [key: string]: unknown;
};

type Vendor = { id: string; name: string };

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

export function FabricMasterGrid({
  masters,
  vendors,
}: {
  masters: unknown[];
  vendors: Vendor[];
}) {
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
      })),
    [masters]
  );

  const columnDefs = useMemo<ColDef<FabricMasterRow>[]>(() => {
    const vendorValues = vendors.map((v) => v.id);
    const vendorLabels: Record<string, string> = {};
    vendors.forEach((v) => { vendorLabels[v.id] = v.name; });

    return [
      { field: "fabricName", headerName: "Fabric Name", pinned: "left", minWidth: 150 },
      {
        field: "vendorId",
        headerName: "Vendor",
        minWidth: 130,
        cellEditor: "agSelectCellEditor",
        cellEditorParams: { values: vendorValues },
        valueFormatter: (p) => vendorLabels[p.value] || p.value || "",
      },
      {
        field: "genders",
        headerName: "Genders",
        minWidth: 120,
        cellRenderer: MultiTagRenderer,
        cellEditor: MultiTagEditor,
      },
      {
        field: "styleNumbers",
        headerName: "Style Numbers",
        minWidth: 180,
        cellRenderer: MultiTagRenderer,
        cellEditor: MultiTagEditor,
      },
      {
        field: "coloursAvailable",
        headerName: "Colours Available",
        minWidth: 200,
        cellRenderer: MultiTagRenderer,
        cellEditor: MultiTagEditor,
      },
      {
        field: "mrp",
        headerName: "MRP",
        minWidth: 90,
        type: "numericColumn",
        valueParser: (p) => toNum(p.newValue),
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

  return (
    <DataGrid<FabricMasterRow>
      gridId="fabric-masters"
      rowData={rowData}
      columnDefs={columnDefs}
      defaultRow={defaultRow}
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
      onStrikethrough={async (id, isStrikedThrough) => updateFabricMaster(id, { isStrikedThrough })}
      validate={validateFabricMaster}
      height="500px"
    />
  );
}
