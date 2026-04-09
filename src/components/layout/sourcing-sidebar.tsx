"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useMemo, useRef, useEffect, useState } from "react";
import {
  LayoutDashboard,
  Search,
  Factory,
  Mail,
  Settings,
  Boxes,
  FileText,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { hasPermission, type Permission, type PermissionContext } from "@/lib/permissions";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { ModuleSwitcher } from "./module-switcher";

interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  permission: Permission;
}

const mainItems: NavItem[] = [
  { title: "Dashboard", href: "/sourcing/dashboard", icon: LayoutDashboard, permission: "sourcing:dashboard:view" },
  { title: "Materials", href: "/sourcing/materials", icon: Boxes, permission: "sourcing:materials:view" },
  { title: "Discover Suppliers", href: "/sourcing/agents/discover", icon: Search, permission: "sourcing:discover:run" },
  { title: "Suppliers", href: "/sourcing/suppliers", icon: Factory, permission: "sourcing:suppliers:view" },
];

const outreachItems: NavItem[] = [
  { title: "Compose Email", href: "/sourcing/outreach", icon: Mail, permission: "sourcing:outreach:compose" },
  { title: "Drafts", href: "/sourcing/outreach/drafts", icon: FileText, permission: "sourcing:outreach:view" },
];

const settingsItems: NavItem[] = [
  { title: "Company Profile", href: "/sourcing/settings", icon: Settings, permission: "sourcing:settings:view" },
  { title: "Scoring Methodology", href: "/sourcing/settings/scoring", icon: Settings, permission: "sourcing:settings:view" },
];

export function SourcingSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const contentRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<string, HTMLAnchorElement | null>>(new Map());
  const [indicator, setIndicator] = useState<{ top: number; height: number } | null>(null);

  const permCtx: PermissionContext = useMemo(() => ({
    role: session?.user?.role ?? "USER",
    inventoryRole: session?.user?.inventoryRole,
    sourcingRole: session?.user?.sourcingRole,
    permissionOverrides: session?.user?.permissionOverrides,
  }), [session]);

  const visibleMain = useMemo(() => mainItems.filter((item) => hasPermission(permCtx, item.permission)), [permCtx]);
  const visibleOutreach = useMemo(() => outreachItems.filter((item) => hasPermission(permCtx, item.permission)), [permCtx]);
  const visibleSettings = useMemo(() => settingsItems.filter((item) => hasPermission(permCtx, item.permission)), [permCtx]);

  const allItems = useMemo(() => [
    ...visibleMain,
    ...visibleOutreach,
    ...visibleSettings,
  ], [visibleMain, visibleOutreach, visibleSettings]);

  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;

    const activeItem = allItems.find((item) => {
      if (item.href === "/sourcing/dashboard") return pathname === item.href;
      return pathname.startsWith(item.href);
    });
    if (!activeItem) {
      setIndicator(null);
      return;
    }

    const el = itemRefs.current.get(activeItem.href);
    if (!el) {
      setIndicator(null);
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    setIndicator({
      top: elRect.top - containerRect.top + container.scrollTop,
      height: elRect.height,
    });
  }, [allItems, pathname]);

  const renderItem = (item: NavItem) => {
    const isActive = item.href === "/sourcing/dashboard"
      ? pathname === item.href
      : pathname.startsWith(item.href);
    return (
      <SidebarMenuItem key={item.href}>
        <Link
          href={item.href}
          ref={(el) => { itemRefs.current.set(item.href, el); }}
          className={cn(
            "relative z-10 flex w-full items-center gap-2 rounded-md p-2 text-sm transition-colors",
            isActive
              ? "font-medium text-sidebar-accent-foreground"
              : "text-sidebar-foreground hover:text-sidebar-accent-foreground"
          )}
        >
          <item.icon className="h-4 w-4" />
          <span>{item.title}</span>
        </Link>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar>
      <SidebarHeader className="p-0">
        <ModuleSwitcher />
      </SidebarHeader>
      <SidebarContent ref={contentRef} style={{ position: "relative" }}>
        {/* Global sliding indicator — pointer-events-none ensures links stay clickable */}
        {indicator && (
          <div
            className="rounded-md bg-sidebar-accent pointer-events-none"
            style={{
              position: "absolute",
              left: 12,
              right: 12,
              top: indicator.top,
              height: indicator.height,
              zIndex: 0,
              transition: "top 250ms cubic-bezier(0.25, 0.1, 0.25, 1), height 150ms ease",
            }}
          />
        )}
        {visibleMain.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Pipeline</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleMain.map(renderItem)}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
        {visibleOutreach.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Outreach</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleOutreach.map(renderItem)}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
        {visibleSettings.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Settings</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleSettings.map(renderItem)}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
