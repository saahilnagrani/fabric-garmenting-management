"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Bell, AlertTriangle, AlertCircle, Info, ArrowRight, X } from "lucide-react";
import type { DashboardAlert } from "@/actions/dashboard";
import { cn } from "@/lib/utils";

const SEVERITY_STYLES: Record<
  DashboardAlert["severity"],
  { border: string; bg: string; iconColor: string; darkBg: string; darkBorder: string }
> = {
  critical: {
    border: "border-red-300",
    bg: "bg-red-50",
    iconColor: "text-red-600",
    darkBg: "dark:bg-red-950/40",
    darkBorder: "dark:border-red-800",
  },
  warning: {
    border: "border-amber-300",
    bg: "bg-amber-50",
    iconColor: "text-amber-600",
    darkBg: "dark:bg-amber-950/40",
    darkBorder: "dark:border-amber-800",
  },
  info: {
    border: "border-blue-200",
    bg: "bg-blue-50",
    iconColor: "text-blue-600",
    darkBg: "dark:bg-blue-950/40",
    darkBorder: "dark:border-blue-800",
  },
};

function SeverityIcon({ severity }: { severity: DashboardAlert["severity"] }) {
  const cls = `h-3.5 w-3.5 shrink-0 ${SEVERITY_STYLES[severity].iconColor}`;
  if (severity === "critical") return <AlertCircle className={cls} />;
  if (severity === "warning") return <AlertTriangle className={cls} />;
  return <Info className={cls} />;
}

export function AlertBell({ alerts }: { alerts: DashboardAlert[] }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, right: 0 });

  const critical = alerts.filter((a) => a.severity === "critical").length;
  const total = alerts.length;

  // Position the dropdown below the bell icon
  const updatePos = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPos({
      top: rect.bottom + 6,
      right: window.innerWidth - rect.right,
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePos();
    function handleClick(e: MouseEvent) {
      if (
        panelRef.current?.contains(e.target as Node) ||
        triggerRef.current?.contains(e.target as Node)
      )
        return;
      setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    window.addEventListener("resize", updatePos);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
      window.removeEventListener("resize", updatePos);
    };
  }, [open, updatePos]);

  const badgeColor =
    critical > 0
      ? "bg-red-500"
      : total > 0
        ? "bg-amber-500"
        : "bg-transparent";

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(!open)}
        className="relative inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        aria-label={`${total} alert${total === 1 ? "" : "s"}`}
      >
        <Bell className="h-4 w-4" />
        {total > 0 && (
          <span
            className={cn(
              "absolute -top-0.5 -right-0.5 flex items-center justify-center rounded-full text-white text-[9px] font-bold leading-none min-w-[16px] h-4 px-1",
              badgeColor
            )}
          >
            {total}
          </span>
        )}
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            className="fixed z-50 w-[360px] max-h-[420px] overflow-y-auto rounded-lg border bg-popover text-popover-foreground shadow-lg"
            style={{ top: pos.top, right: pos.right }}
          >
            <div className="flex items-center justify-between px-3 py-2 border-b">
              <span className="text-xs font-semibold">
                Alerts
                {total > 0 && (
                  <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">
                    ({total} total{critical > 0 ? `, ${critical} critical` : ""})
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded p-0.5 hover:bg-muted transition-colors"
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </div>

            {total === 0 ? (
              <div className="px-3 py-4 text-center">
                <p className="text-xs text-muted-foreground">All clear. No active alerts.</p>
              </div>
            ) : (
              <div className="p-2 space-y-1.5">
                {alerts.map((alert) => {
                  const styles = SEVERITY_STYLES[alert.severity];
                  return (
                    <Link
                      key={alert.id}
                      href={alert.actionUrl}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "group flex items-start gap-2 rounded-md border px-2.5 py-2 transition-colors hover:opacity-90",
                        styles.border,
                        styles.bg,
                        styles.darkBg,
                        styles.darkBorder
                      )}
                    >
                      <SeverityIcon severity={alert.severity} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-[11px] font-semibold">{alert.title}</span>
                          <span className="text-[10px] font-medium text-muted-foreground px-1 py-0.5 rounded bg-white/60 dark:bg-white/10">
                            {alert.count}
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug line-clamp-2">
                          {alert.message}
                        </p>
                      </div>
                      <div className="flex items-center gap-0.5 text-[10px] font-medium text-muted-foreground group-hover:text-foreground shrink-0 mt-0.5">
                        {alert.actionLabel}
                        <ArrowRight className="h-2.5 w-2.5" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>,
          document.body
        )}
    </>
  );
}
