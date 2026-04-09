"use client";

import { useMemo } from "react";
import type { ColDef } from "ag-grid-community";
import { DataGrid } from "@/components/ag-grid/data-grid";
import { createVendor, updateVendor } from "@/actions/vendors";
import { VENDOR_TYPE_LABELS } from "@/lib/constants";

type VendorRow = {
  id: string;
  name: string;
  type: string;
  contactInfo: string;
  address: string;
  [key: string]: unknown;
};

export function VendorGrid({ vendors }: { vendors: unknown[] }) {
  const rowData: VendorRow[] = useMemo(
    () =>
      (vendors as Record<string, unknown>[]).map((v) => ({
        id: v.id as string,
        name: String(v.name ?? ""),
        type: String(v.type ?? "FABRIC_SUPPLIER"),
        contactInfo: String(v.contactInfo ?? ""),
        address: String(v.address ?? ""),
        isStrikedThrough: Boolean(v.isStrikedThrough),
      })),
    [vendors]
  );

  const typeValues = Object.keys(VENDOR_TYPE_LABELS);

  const columnDefs = useMemo<ColDef<VendorRow>[]>(
    () => [
      { field: "name", headerName: "Name", minWidth: 180, flex: 1, pinned: "left" },
      {
        field: "type",
        headerName: "Type",
        minWidth: 150,
        flex: 1,
        cellEditor: "agSelectCellEditor",
        cellEditorParams: { values: typeValues },
        valueFormatter: (p) => VENDOR_TYPE_LABELS[p.value] || p.value || "",
      },
      { field: "contactInfo", headerName: "Contact", minWidth: 200, flex: 1 },
      { field: "address", headerName: "Address", minWidth: 250, flex: 1 },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const defaultRow: Partial<VendorRow> = {
    name: "",
    type: "FABRIC_SUPPLIER",
    contactInfo: "",
    address: "",
  };

  return (
    <DataGrid<VendorRow>
      gridId="vendors"
      rowData={rowData}
      columnDefs={columnDefs}
      defaultRow={defaultRow}
      onCreate={async (data) => {
        return createVendor({
          name: data.name,
          type: data.type as never,
          contactInfo: data.contactInfo || undefined,
          address: data.address || undefined,
        });
      }}
      onSave={async (id, data) => {
        return updateVendor(id, {
          name: data.name,
          type: data.type,
          contactInfo: data.contactInfo || null,
          address: data.address || null,
        });
      }}
      autoHeight
      height="600px"
    />
  );
}
