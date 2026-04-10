"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  useCallback,
} from "react";
import type { CustomCellEditorProps } from "ag-grid-react";
import { X } from "lucide-react";

const TAG_COLORS = [
  "bg-blue-100 text-blue-800 border-blue-200",
  "bg-green-100 text-green-800 border-green-200",
  "bg-orange-100 text-orange-800 border-orange-200",
  "bg-purple-100 text-purple-800 border-purple-200",
  "bg-pink-100 text-pink-800 border-pink-200",
  "bg-teal-100 text-teal-800 border-teal-200",
];

export const MultiTagEditor = forwardRef(
  (props: CustomCellEditorProps, ref) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const [selected, setSelected] = useState<string[]>(
      Array.isArray(props.value) ? [...props.value] : []
    );
    const [inputValue, setInputValue] = useState("");

    // Get predefined options from cellEditorParams
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const options: string[] = (props as any).colDef?.cellEditorParams?.options || [];

    useEffect(() => {
      setTimeout(() => inputRef.current?.focus(), 50);
    }, []);

    const addTag = useCallback(
      (tag: string) => {
        const trimmed = tag.trim();
        if (trimmed && !selected.includes(trimmed)) {
          setSelected((prev) => [...prev, trimmed]);
        }
        setInputValue("");
      },
      [selected]
    );

    const removeTag = useCallback((tag: string) => {
      setSelected((prev) => prev.filter((t) => t !== tag));
    }, []);

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (e.key === "Enter" || e.key === ",") {
          e.preventDefault();
          if (inputValue.trim()) {
            addTag(inputValue);
          }
        } else if (
          e.key === "Backspace" &&
          !inputValue &&
          selected.length > 0
        ) {
          setSelected((prev) => prev.slice(0, -1));
        }
      },
      [inputValue, selected, addTag]
    );

    useImperativeHandle(ref, () => ({
      getValue() {
        const final = [...selected];
        if (inputValue.trim() && !final.includes(inputValue.trim())) {
          final.push(inputValue.trim());
        }
        return final;
      },
      isPopup() {
        return true;
      },
      isCancelBeforeStart() {
        return false;
      },
    }));

    const filteredOptions = options.filter(
      (o) =>
        !selected.includes(o) &&
        (!inputValue || o.toLowerCase().includes(inputValue.toLowerCase()))
    );

    return (
      <div className="bg-white border border-border rounded-lg shadow-lg p-2 min-w-[220px] max-w-[350px]">
        {/* Selected tags + input */}
        <div className="flex flex-wrap items-center gap-1 min-h-[32px] border border-border rounded-md px-1.5 py-1 bg-white focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-100">
          {selected.map((tag, i) => (
            <span
              key={tag}
              className={`inline-flex items-center gap-0.5 rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${TAG_COLORS[i % TAG_COLORS.length]}`}
            >
              {tag}
              <button
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  removeTag(tag);
                }}
                className="hover:opacity-70 cursor-pointer ml-0.5"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
          <input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 min-w-[60px] text-xs border-0 outline-none bg-transparent placeholder:text-gray-400"
            placeholder={selected.length ? "" : "Type or select..."}
          />
        </div>

        {/* Predefined options dropdown */}
        {filteredOptions.length > 0 && (
          <div className="mt-1.5 max-h-[140px] overflow-y-auto">
            {filteredOptions.map((option) => (
              <button
                key={option}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  addTag(option);
                }}
                className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-muted/50 transition-colors cursor-pointer"
              >
                {option}
              </button>
            ))}
          </div>
        )}

        {/* Helper text when no predefined options */}
        {options.length === 0 && (
          <p className="text-[10px] text-gray-400 mt-1 px-1">
            Type and press Enter or comma to add tags
          </p>
        )}
      </div>
    );
  }
);

MultiTagEditor.displayName = "MultiTagEditor";
