"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useMemo, useRef, useEffect, useState } from "react";
import {
  LayoutDashboard,
  Package,
  Scissors,
  Receipt,
  Users,
  Layers,
  BookOpen,
  ClipboardList,
  List,
  CalendarPlus,
  ShoppingBag,
  Send,
  Scale,
  Boxes,
} from "lucide-react";
import { FEATURES } from "@/lib/feature-flags";
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

const navItems: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard, permission: "inventory:dashboard:view" },
  { title: "Phase Planning", href: "/phase-planning", icon: CalendarPlus, permission: "inventory:phases:view" },
  { title: "Article Orders", href: "/products", icon: Package, permission: "inventory:products:view" },
  { title: "Fabric Orders", href: "/fabric-orders", icon: Scissors, permission: "inventory:fabric_orders:view" },
  { title: "Fabric Balance", href: "/fabric-balance", icon: Scale, permission: "inventory:fabric_orders:view" },
  ...(FEATURES.accessories
    ? [
        { title: "Accessory Purchases", href: "/accessory-purchases", icon: ShoppingBag, permission: "inventory:accessories:view" as const },
        { title: "Accessory Dispatches", href: "/accessory-dispatches", icon: Send, permission: "inventory:accessories:view" as const },
        { title: "Accessory Balance", href: "/accessory-balance", icon: Scale, permission: "inventory:accessories:view" as const },
      ]
    : []),
  { title: "Expenses", href: "/expenses", icon: Receipt, permission: "inventory:expenses:view" },
  { title: "Vendors", href: "/vendors", icon: Users, permission: "inventory:vendors:view" },
  { title: "Phases", href: "/phases", icon: Layers, permission: "inventory:phases:view" },
];

const masterItems: NavItem[] = [
  { title: "Fabrics Master DB", href: "/fabric-masters", icon: BookOpen, permission: "inventory:masters:view" },
  { title: "Article Master DB", href: "/product-masters", icon: ClipboardList, permission: "inventory:masters:view" },
  ...(FEATURES.accessories
    ? [
        { title: "Accessories Master DB", href: "/accessory-masters", icon: Boxes, permission: "inventory:accessories:view" as const },
      ]
    : []),
];

const listItems: NavItem[] = [
  { title: "Product Types", href: "/lists/types", icon: List, permission: "inventory:lists:view" },
  { title: "Colours", href: "/lists/colours", icon: List, permission: "inventory:lists:view" },
  { title: "Garmenting Locations", href: "/lists/garmenting-locations", icon: List, permission: "inventory:lists:view" },
  { title: "Size Distribution", href: "/lists/size-distribution", icon: List, permission: "inventory:lists:view" },
];

export function AppSidebar() {
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

  const visibleNav = useMemo(() => navItems.filter((item) => hasPermission(permCtx, item.permission)), [permCtx]);
  const visibleMasters = useMemo(() => masterItems.filter((item) => hasPermission(permCtx, item.permission)), [permCtx]);
  const visibleLists = useMemo(() => listItems.filter((item) => hasPermission(permCtx, item.permission)), [permCtx]);

  const allItems = useMemo(() => [
    ...visibleNav,
    ...visibleMasters,
    ...visibleLists,
  ], [visibleNav, visibleMasters, visibleLists]);

  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;

    const activeItem = allItems.find((item) => pathname.startsWith(item.href));
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
    const isActive = pathname.startsWith(item.href);
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
        {visibleNav.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Navigation</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleNav.map(renderItem)}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
        {visibleMasters.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Masters</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleMasters.map(renderItem)}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
        {visibleLists.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Lists</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleLists.map(renderItem)}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
