"use client";

import * as React from "react";
import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { ChevronDownIcon, CheckIcon, X } from "lucide-react";

type OptionItem = string | { label: string; value: string; searchText?: string };

interface MultiComboboxProps {
  values: string[];
  onValuesChange: (values: string[]) => void;
  options: OptionItem[];
  placeholder?: string;
  className?: string;
  showValueInChip?: boolean;
}

function getLabel(opt: OptionItem): string {
  return typeof opt === "string" ? opt : opt.label;
}

function getValue(opt: OptionItem): string {
  return typeof opt === "string" ? opt : opt.value;
}

function getSearchText(opt: OptionItem): string {
  if (typeof opt === "string") return opt;
  return opt.searchText || opt.label;
}

export function MultiCombobox({
  values,
  onValuesChange,
  options,
  placeholder = "Select...",
  className,
  showValueInChip = false,
}: MultiComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const triggerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });

  const filtered = options.filter((opt) =>
    getSearchText(opt).toLowerCase().includes(search.toLowerCase())
  );

  const labelMap = React.useMemo(() => {
    const map: Record<string, string> = {};
    options.forEach((opt) => {
      map[getValue(opt)] = getLabel(opt);
    });
    return map;
  }, [options]);

  const updatePosition = useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPos({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    }
  }, []);

  useEffect(() => {
    if (open) {
      updatePosition();
    }
  }, [open, updatePosition]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        triggerRef.current && !triggerRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleToggle(opt: OptionItem) {
    const v = getValue(opt);
    if (values.includes(v)) {
      onValuesChange(values.filter((val) => val !== v));
    } else {
      onValuesChange([...values, v]);
    }
  }

  function handleRemove(v: string) {
    onValuesChange(values.filter((val) => val !== v));
  }

  const dropdown = open
    ? createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: "fixed",
            top: pos.top,
            left: pos.left,
            minWidth: Math.max(pos.width, 256),
            zIndex: 9999,
          }}
          className="rounded-lg border bg-popover shadow-md"
        >
          <div className="p-1">
            <input
              ref={inputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-full rounded-md border border-input bg-transparent px-2 py-1 text-xs outline-none focus-visible:border-ring"
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setOpen(false);
                  setSearch("");
                }
              }}
            />
          </div>
          <div className="max-h-52 overflow-y-auto p-0.5">
            {filtered.length === 0 ? (
              <div className="px-2 py-1 text-xs text-muted-foreground">
                No results found
              </div>
            ) : (
              filtered.map((opt) => {
                const optValue = getValue(opt);
                const optLabel = getLabel(opt);
                const selected = values.includes(optValue);
                return (
                  <button
                    key={optValue}
                    type="button"
                    onClick={() => handleToggle(opt)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-md px-2 py-1 text-xs text-left whitespace-nowrap cursor-default hover:bg-accent hover:text-accent-foreground",
                      selected && "bg-accent"
                    )}
                  >
                    <span>{optLabel}</span>
                    {selected && (
                      <CheckIcon className="h-3 w-3 shrink-0 ml-2" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <div className={cn("relative", className)} ref={triggerRef}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => {
          setOpen(!open);
          if (!open) {
            setTimeout(() => inputRef.current?.focus(), 0);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(!open);
            if (!open) setTimeout(() => inputRef.current?.focus(), 0);
          }
        }}
        className={cn(
          "flex w-full items-center justify-between rounded-lg border border-input bg-transparent px-2.5 py-2 text-xs min-h-8 transition-colors outline-none cursor-pointer focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          values.length === 0 && "text-muted-foreground"
        )}
      >
        <div className="flex flex-wrap gap-1 flex-1">
          {values.length === 0 ? (
            <span>{placeholder}</span>
          ) : (
            values.map((v) => (
              <span
                key={v}
                className="inline-flex items-center gap-0.5 bg-muted text-foreground text-xs px-1.5 py-0.5 rounded"
              >
                {showValueInChip ? v : (labelMap[v] || v)}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemove(v);
                  }}
                  className="hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))
          )}
        </div>
        <ChevronDownIcon className="ml-1 h-4 w-4 shrink-0 text-muted-foreground" />
      </div>
      {dropdown}
    </div>
  );
}
