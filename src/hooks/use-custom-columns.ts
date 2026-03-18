"use client";

import { useState, useCallback, useEffect } from "react";

type CustomColumnDef = {
  field: string;
  headerName: string;
};

type CustomColumnData = Record<string, Record<string, string>>;

export function useCustomColumns(gridId: string) {
  const colKey = `ag-grid-custom-cols-${gridId}`;
  const dataKey = `ag-grid-custom-data-${gridId}`;

  const [columns, setColumns] = useState<CustomColumnDef[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(localStorage.getItem(colKey) || "[]");
    } catch {
      return [];
    }
  });

  const [data, setData] = useState<CustomColumnData>(() => {
    if (typeof window === "undefined") return {};
    try {
      return JSON.parse(localStorage.getItem(dataKey) || "{}");
    } catch {
      return {};
    }
  });

  // Persist columns
  useEffect(() => {
    localStorage.setItem(colKey, JSON.stringify(columns));
  }, [columns, colKey]);

  // Persist data
  useEffect(() => {
    localStorage.setItem(dataKey, JSON.stringify(data));
  }, [data, dataKey]);

  const addColumn = useCallback((name: string) => {
    const field = `__custom_${Date.now()}`;
    setColumns((prev) => [...prev, { field, headerName: name }]);
    return field;
  }, []);

  const removeColumn = useCallback((field: string) => {
    setColumns((prev) => prev.filter((c) => c.field !== field));
    setData((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((rowId) => {
        if (next[rowId]) {
          const { [field]: _, ...rest } = next[rowId];
          next[rowId] = rest;
        }
      });
      return next;
    });
  }, []);

  const setCellValue = useCallback(
    (rowId: string, field: string, value: string) => {
      setData((prev) => ({
        ...prev,
        [rowId]: { ...prev[rowId], [field]: value },
      }));
    },
    []
  );

  const enrichRowData = useCallback(
    <T extends Record<string, unknown>>(rows: T[]): T[] => {
      if (columns.length === 0) return rows;
      return rows.map((row) => {
        const rowId = String(
          (row as Record<string, unknown>).id ||
            (row as Record<string, unknown>).__tempId ||
            ""
        );
        const customData = data[rowId] || {};
        return { ...row, ...customData };
      });
    },
    [columns, data]
  );

  return { columns, addColumn, removeColumn, setCellValue, enrichRowData };
}
