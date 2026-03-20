"use client";

import * as React from "react";
import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { ChevronDownIcon, CheckIcon } from "lucide-react";

type OptionItem = string | { label: string; value: string; searchText?: string };

interface ComboboxProps {
  value: string;
  onValueChange: (value: string) => void;
  options: OptionItem[];
  placeholder?: string;
  className?: string;
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

export function Combobox({
  value,
  onValueChange,
  options,
  placeholder = "Select...",
  className,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });

  const filtered = options.filter((opt) =>
    getSearchText(opt).toLowerCase().includes(search.toLowerCase())
  );

  // Find the display label for the current value
  const displayLabel = React.useMemo(() => {
    const match = options.find((opt) => getValue(opt) === value);
    return match ? getLabel(match) : value;
  }, [options, value]);

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

  function handleSelect(opt: OptionItem) {
    onValueChange(getValue(opt));
    setOpen(false);
    setSearch("");
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
          <div className="p-1.5">
            <input
              ref={inputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-full rounded-md border border-input bg-transparent px-2 py-1.5 text-sm outline-none focus-visible:border-ring"
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setOpen(false);
                  setSearch("");
                }
                if (e.key === "Enter" && filtered.length === 1) {
                  handleSelect(filtered[0]);
                }
              }}
            />
          </div>
          <div className="max-h-52 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <div className="px-2 py-1.5 text-sm text-muted-foreground">
                No results found
              </div>
            ) : (
              filtered.map((opt) => {
                const optValue = getValue(opt);
                const optLabel = getLabel(opt);
                return (
                  <button
                    key={optValue}
                    type="button"
                    onClick={() => handleSelect(opt)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-sm text-left whitespace-nowrap cursor-default hover:bg-accent hover:text-accent-foreground",
                      value === optValue && "bg-accent"
                    )}
                  >
                    <span>{optLabel}</span>
                    {value === optValue && (
                      <CheckIcon className="h-3.5 w-3.5 shrink-0 ml-2" />
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
    <div className={cn("relative", className)}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          setOpen(!open);
          if (!open) {
            setTimeout(() => inputRef.current?.focus(), 0);
          }
        }}
        className={cn(
          "flex w-full items-center justify-between rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm h-8 transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          !value && "text-muted-foreground"
        )}
      >
        <span className="truncate">{displayLabel || placeholder}</span>
        <ChevronDownIcon className="ml-1 h-4 w-4 shrink-0 text-muted-foreground" />
      </button>
      {dropdown}
    </div>
  );
}
