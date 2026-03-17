"use client";

import { useMemo } from "react";
import type { ColDef } from "ag-grid-community";
import { DataGrid } from "@/components/ag-grid/data-grid";
import { DateCellEditor } from "@/components/ag-grid/date-cell-editor";
import { createPhase, updatePhase, setCurrentPhase } from "@/actions/phases";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

type PhaseRow = {
  id: string;
  name: string;
  number: number | null;
  startDate: string;
  isCurrent: boolean;
  [key: string]: unknown;
};

export function PhaseGrid({ phases }: { phases: unknown[] }) {
  const router = useRouter();

  const rowData: PhaseRow[] = useMemo(
    () =>
      (phases as Record<string, unknown>[]).map((p) => ({
        id: p.id as string,
        name: String(p.name ?? ""),
        number: p.number as number | null,
        startDate: p.startDate
          ? new Date(p.startDate as string).toLocaleDateString("en-IN")
          : "",
        isCurrent: Boolean(p.isCurrent),
        isStrikedThrough: Boolean(p.isStrikedThrough),
      })),
    [phases]
  );

  const columnDefs = useMemo<ColDef<PhaseRow>[]>(
    () => [
      { field: "name", headerName: "Phase", minWidth: 220, flex: 2, pinned: "left" },
      {
        field: "number",
        headerName: "Number",
        minWidth: 90,
        flex: 1,
        type: "numericColumn",
        valueParser: (p) => {
          const n = Number(p.newValue);
          return isNaN(n) ? null : Math.round(n);
        },
      },
      { field: "startDate", headerName: "Start Date", minWidth: 130, flex: 1, cellEditor: DateCellEditor },
      {
        field: "isCurrent",
        headerName: "Status",
        minWidth: 140,
        flex: 1,
        editable: false,
        cellRenderer: (params: { data: PhaseRow }) => {
          if (!params.data) return null;
          if (params.data.isCurrent) {
            return (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                <Check className="h-3 w-3" /> Current
              </span>
            );
          }
          return (
            <Button
              variant="outline"
              size="sm"
              className="h-6 text-xs"
              onClick={async () => {
                await setCurrentPhase(params.data.id);
                router.refresh();
              }}
            >
              Set as Current
            </Button>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const defaultRow: Partial<PhaseRow> = {
    name: "",
    number: null,
    startDate: "",
    isCurrent: false,
  };

  return (
    <DataGrid<PhaseRow>
      gridId="phases"
      rowData={rowData}
      columnDefs={columnDefs}
      defaultRow={defaultRow}
      onCreate={async (data) => {
        return createPhase({
          name: data.name,
          number: data.number ?? 0,
          startDate: data.startDate || undefined,
        });
      }}
      onSave={async (id, data) => {
        return updatePhase(id, {
          name: data.name,
          number: data.number,
          startDate: data.startDate ? new Date(data.startDate) : null,
        });
      }}
      onStrikethrough={async (id, isStrikedThrough) => updatePhase(id, { isStrikedThrough })}
      autoHeight
      height="600px"
    />
  );
}
