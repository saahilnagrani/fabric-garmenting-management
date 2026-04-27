"use client";

import { type RefObject } from "react";
import type { GridApi, Column } from "ag-grid-community";
import ExcelJS from "exceljs";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

const CENTERED_FIELDS = new Set<string>(["invoiceNumber"]);

function isNumericCol(col: Column): boolean {
  const def = col.getColDef();
  const t = def.type;
  if (t === "numericColumn") return true;
  if (Array.isArray(t) && t.includes("numericColumn")) return true;
  // Computed columns without `field` and without explicit type but with valueGetter
  // commonly produce numbers; detect via valueFormatter heuristics is not reliable,
  // so we only treat declared numericColumn as numeric here.
  return false;
}

function isCentered(col: Column): boolean {
  const def = col.getColDef();
  const field = def.field || "";
  if (CENTERED_FIELDS.has(field)) return true;
  return isNumericCol(col);
}

const RUPEE_PATTERN = /[₹]/;
function parseFormattedNumber(s: string): number | null {
  const cleaned = s.replace(/[₹,\s]/g, "").replace(/[^\d.\-eE]/g, "");
  if (cleaned === "" || cleaned === "-") return null;
  const n = Number(cleaned);
  return isNaN(n) ? null : n;
}

export function ExportExcelButton({
  gridApiRef,
  fileName,
  sheetName = "Sheet1",
}: {
  gridApiRef: RefObject<GridApi | null>;
  fileName: string;
  sheetName?: string;
}) {
  const handleExport = async () => {
    const api = gridApiRef.current;
    if (!api) return;

    const visibleCols = api.getAllDisplayedColumns().filter((c) => {
      const def = c.getColDef();
      return !def.checkboxSelection;
    });

    const headers = visibleCols.map(
      (c) => c.getColDef().headerName || c.getColId()
    );

    type Cell = { value: string | number | null; isCurrency?: boolean; isPercent?: boolean };
    const rows: Cell[][] = [];
    api.forEachNodeAfterFilterAndSort((node) => {
      if (!node.data) return;
      const row: Cell[] = visibleCols.map((c) => {
        const raw = api.getCellValue({ rowNode: node, colKey: c });
        const formatted = api.getCellValue({
          rowNode: node,
          colKey: c,
          useFormatter: true,
        });
        if (formatted === null || formatted === undefined || formatted === "") {
          return { value: null };
        }
        if (typeof formatted === "boolean") {
          return { value: formatted ? "Yes" : "No" };
        }
        if (typeof formatted === "number") {
          return { value: formatted };
        }
        const str = String(formatted);
        const isCurrency = RUPEE_PATTERN.test(str);
        const isPercent = /%\s*$/.test(str);
        // If raw is numeric, prefer that as the cell value so Excel treats it as a number
        if (typeof raw === "number" && !isNaN(raw)) {
          return { value: raw, isCurrency, isPercent };
        }
        if (typeof raw === "string" && raw !== "" && !isNaN(Number(raw))) {
          return { value: Number(raw), isCurrency, isPercent };
        }
        // Fall back: try to parse the formatted string into a number
        if (isNumericCol(c) || isCurrency || isPercent) {
          const parsed = parseFormattedNumber(str);
          if (parsed !== null) {
            // Percent string like "28.7%": parsed back as 28.7. Convert to 0.287 for Excel %.
            const v = isPercent ? parsed / 100 : parsed;
            return { value: v, isCurrency, isPercent };
          }
        }
        return { value: str, isCurrency, isPercent };
      });
      rows.push(row);
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(sheetName, {
      views: [{ state: "frozen", xSplit: 1, ySplit: 1 }],
    });

    const headerRow = worksheet.addRow(headers);
    headerRow.font = { bold: true };
    headerRow.alignment = { horizontal: "center", vertical: "middle", wrapText: true };

    rows.forEach((cells) => {
      const r = worksheet.addRow(cells.map((c) => c.value));
      cells.forEach((c, i) => {
        const cell = r.getCell(i + 1);
        if (c.isCurrency && typeof c.value === "number") {
          cell.numFmt = '[$₹-en-IN]#,##0;[$₹-en-IN]-#,##0';
        } else if (c.isPercent && typeof c.value === "number") {
          cell.numFmt = '0.00%';
        }
      });
    });

    visibleCols.forEach((col, idx) => {
      const wsCol = worksheet.getColumn(idx + 1);
      const headerLen = headers[idx]?.length ?? 0;
      let maxLen = headerLen;
      let hasNumber = false;
      let hasNonNumber = false;
      for (const r of rows) {
        const cell = r[idx];
        const v = cell?.value;
        if (v != null) {
          maxLen = Math.max(maxLen, String(v).length);
          if (typeof v === "number" || cell?.isCurrency || cell?.isPercent) {
            hasNumber = true;
          } else {
            hasNonNumber = true;
          }
        }
      }
      wsCol.width = Math.min(Math.max(maxLen + 2, 10), 40);
      const center = isCentered(col) || (hasNumber && !hasNonNumber);
      if (center) {
        wsCol.alignment = { horizontal: "center", vertical: "middle" };
      }
    });

    headerRow.eachCell((cell) => {
      cell.font = { bold: true };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const date = new Date().toISOString().slice(0, 10);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileName}-${date}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Button variant="outline" size="sm" onClick={handleExport}>
      <Download className="mr-1.5 h-3.5 w-3.5" />
      Export to Excel
    </Button>
  );
}
