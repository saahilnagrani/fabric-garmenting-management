"use client";

import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import type { ICellEditorParams } from "ag-grid-community";
import { ChevronLeft, ChevronRight } from "lucide-react";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function parseDate(value: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function formatDate(date: Date): string {
  return `${String(date.getDate()).padStart(2, "0")} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

function buildCalendarDays(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  return cells;
}

export const DateCellEditor = forwardRef(
  (props: ICellEditorParams, ref: React.Ref<unknown>) => {
    const initial = parseDate(String(props.value || ""));
    const selectedRef = useRef<Date | null>(initial);

    const now = initial ?? new Date();
    const [viewYear, setViewYear] = useState(now.getFullYear());
    const [viewMonth, setViewMonth] = useState(now.getMonth());
    const [selected, setSelected] = useState<Date | null>(initial);

    useImperativeHandle(ref, () => ({
      getValue: () => (selectedRef.current ? formatDate(selectedRef.current) : ""),
      isCancelAfterEnd: () => false,
    }), []);

    const cells = buildCalendarDays(viewYear, viewMonth);

    const prevMonth = () => {
      if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
      else setViewMonth(m => m - 1);
    };
    const nextMonth = () => {
      if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
      else setViewMonth(m => m + 1);
    };

    const pickDay = (day: number) => {
      const picked = new Date(viewYear, viewMonth, day);
      selectedRef.current = picked;
      setSelected(picked);
      // Stop editing synchronously — getValue reads from ref
      props.api.stopEditing();
    };

    const isSelected = (day: number) =>
      selected &&
      selected.getFullYear() === viewYear &&
      selected.getMonth() === viewMonth &&
      selected.getDate() === day;

    const isToday = (day: number) => {
      const t = new Date();
      return t.getFullYear() === viewYear && t.getMonth() === viewMonth && t.getDate() === day;
    };

    return (
      <div
        style={{
          background: "white",
          border: "1px solid #e5e7eb",
          borderRadius: 8,
          boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
          padding: "10px",
          width: 230,
          userSelect: "none",
          fontFamily: "inherit",
          fontSize: 13,
        }}
        // Prevent AG Grid from intercepting mouse events
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); prevMonth(); }}
            style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 4px", borderRadius: 4, display: "flex", alignItems: "center" }}
          >
            <ChevronLeft size={14} />
          </button>
          <span style={{ fontWeight: 600, fontSize: 13 }}>
            {MONTHS[viewMonth]} {viewYear}
          </span>
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); nextMonth(); }}
            style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 4px", borderRadius: 4, display: "flex", alignItems: "center" }}
          >
            <ChevronRight size={14} />
          </button>
        </div>

        {/* Day-of-week headers */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 4 }}>
          {DAYS.map(d => (
            <div key={d} style={{ textAlign: "center", fontSize: 11, color: "#9ca3af", fontWeight: 600 }}>{d}</div>
          ))}
        </div>

        {/* Calendar days */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
          {cells.map((day, i) => {
            if (!day) return <div key={i} />;
            const sel = isSelected(day);
            const tod = isToday(day);
            return (
              <button
                key={i}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); pickDay(day); }}
                style={{
                  textAlign: "center",
                  padding: "4px 2px",
                  borderRadius: 4,
                  border: tod && !sel ? "1px solid #6366f1" : "1px solid transparent",
                  background: sel ? "#6366f1" : "none",
                  color: sel ? "white" : tod ? "#6366f1" : "#111827",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: sel ? 600 : 400,
                }}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>
    );
  }
);

DateCellEditor.displayName = "DateCellEditor";
