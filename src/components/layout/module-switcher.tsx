"use client";

import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useMemo, useState, useRef, useEffect } from "react";
import { Package, Search, Shield, ChevronDown, Home } from "lucide-react";
import Link from "next/link";
import { hasInventoryAccess, hasSourcingAccess, type PermissionContext } from "@/lib/permissions";
import type { LucideIcon } from "lucide-react";

interface Module {
  label: string;
  icon: LucideIcon;
  href: string;
  pathPrefix: string;
}

const modules: Module[] = [
  { label: "Fabric & Garmenting", icon: Package, href: "/dashboard", pathPrefix: "/" },
  { label: "Sourcing Agent", icon: Search, href: "/sourcing/dashboard", pathPrefix: "/sourcing" },
  { label: "Admin", icon: Shield, href: "/admin/users", pathPrefix: "/admin" },
];

export function ModuleSwitcher() {
  const pathname = usePathname();
  const { data: session } = useSession();

  const permCtx: PermissionContext = useMemo(() => ({
    role: session?.user?.role ?? "USER",
    inventoryRole: session?.user?.inventoryRole,
    sourcingRole: session?.user?.sourcingRole,
    permissionOverrides: session?.user?.permissionOverrides,
  }), [session]);

  const isAdmin = session?.user?.role === "ADMIN";

  const availableModules = useMemo(() => {
    return modules.filter((mod) => {
      if (mod.pathPrefix === "/admin") return isAdmin;
      if (mod.pathPrefix === "/sourcing") return hasSourcingAccess(permCtx);
      return hasInventoryAccess(permCtx);
    });
  }, [permCtx, isAdmin]);

  const current = useMemo(() => {
    if (pathname.startsWith("/admin")) return modules[2];
    if (pathname.startsWith("/sourcing")) return modules[1];
    return modules[0];
  }, [pathname]);

  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="flex h-14 w-full items-center border-b px-4">
      <div className="relative min-w-0 flex-1" ref={containerRef}>
        <button
          onClick={() => availableModules.length > 1 && setOpen((v) => !v)}
          className="flex w-full items-center gap-1.5 text-sm font-bold"
        >
          <span className="whitespace-nowrap">{current.label}</span>
          {availableModules.length > 1 && (
            <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
          )}
        </button>
        {open && availableModules.length > 1 && (
          <div className="absolute left-0 top-full z-50 mt-1 min-w-[220px] border bg-sidebar p-1 shadow-md">
            {availableModules.map((mod) => {
              const isActive =
                mod.pathPrefix === "/admin"
                  ? pathname.startsWith("/admin")
                  : mod.pathPrefix === "/sourcing"
                    ? pathname.startsWith("/sourcing")
                    : !pathname.startsWith("/sourcing") && !pathname.startsWith("/admin");
              return (
                <Link
                  key={mod.pathPrefix}
                  href={mod.href}
                  onClick={() => setOpen(false)}
                  className={`flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm transition-colors ${
                    isActive
                      ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  }`}
                >
                  <mod.icon className="h-4 w-4" />
                  {mod.label}
                </Link>
              );
            })}
          </div>
        )}
      </div>
      <Link
        href="/"
        className="ml-auto flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors"
        title="Back to Home"
      >
        <Home className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
