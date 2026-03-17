"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type { CustomCellEditorProps } from "ag-grid-react";

export const MultiTagEditor = forwardRef(
  (props: CustomCellEditorProps, ref) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const [value, setValue] = useState<string>(
      (props.value || []).join(", ")
    );

    useEffect(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, []);

    useImperativeHandle(ref, () => ({
      getValue() {
        return value
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s.length > 0);
      },
      isCancelBeforeStart() {
        return false;
      },
      isCancelAfterEnd() {
        return false;
      },
    }));

    return (
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-full h-full px-2 text-sm bg-background border-0 outline-none"
        placeholder="value1, value2, ..."
      />
    );
  }
);

MultiTagEditor.displayName = "MultiTagEditor";
