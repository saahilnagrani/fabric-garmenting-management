"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { ICellEditorParams } from "ag-grid-community";

function parseInitialValue(v: unknown): string {
  if (!v) return "";
  try {
    const d = new Date(v as string);
    if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
  } catch { /* ignore */ }
  return String(v);
}

export const DateCellEditor = forwardRef(
  (props: ICellEditorParams, ref: React.Ref<unknown>) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const initial = parseInitialValue(props.value);
    const valueRef = useRef(initial);
    const [value, setValue] = useState(initial);

    useEffect(() => {
      inputRef.current?.focus();
      try {
        inputRef.current?.showPicker?.();
      } catch {
        // showPicker() requires user gesture in some browsers
      }
    }, []);

    useImperativeHandle(ref, () => ({
      getValue: () => valueRef.current,
      isCancelAfterEnd: () => false,
    }));

    return (
      <input
        ref={inputRef}
        type="date"
        value={value}
        onChange={(e) => {
          valueRef.current = e.target.value;
          setValue(e.target.value);
        }}
        className="w-full h-full px-2 border-0 outline-none bg-white"
        style={{ fontSize: "inherit", fontFamily: "inherit" }}
      />
    );
  }
);

DateCellEditor.displayName = "DateCellEditor";
