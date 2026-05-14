"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState, useEffect, useMemo } from "react";
import { Shield, ScrollText, BookOpen, Bell, Hash } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { ModuleSwitcher } from "./module-switcher";
import type { LucideIcon } from "lucide-react";

interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
}

const adminItems: NavItem[] = [
  { title: "Alert Rules", href: "/admin/alert-rules", icon: Bell },
  { title: "PO Counter", href: "/admin/po-counter", icon: Hash },
  { title: "Audit Log", href: "/admin/audit-log", icon: ScrollText },
  { title: "User Management", href: "/admin/users", icon: Shield },
  { title: "Documentation", href: "/admin/docs", icon: BookOpen },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const contentRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<string, HTMLAnchorElement | null>>(new Map());
  const [indicator, setIndicator] = useState<{ top: number; height: number } | null>(null);

  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;

    const activeItem = adminItems.find((item) => pathname.startsWith(item.href));
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
  }, [pathname]);

  const renderItem = (item: NavItem) => {
    const isActive = pathname.startsWith(item.href);
    const link = (
      <Link
        href={item.href}
        ref={(el) => { itemRefs.current.set(item.href, el); }}
        className={cn(
          "relative z-10 flex w-full items-center gap-2 rounded-md p-2 text-sm transition-colors",
          "group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-2",
          isActive
            ? "font-medium text-sidebar-accent-foreground"
            : "text-sidebar-foreground hover:text-sidebar-accent-foreground"
        )}
      >
        <item.icon className="h-4 w-4 shrink-0" />
        <span className="group-data-[collapsible=icon]:hidden">{item.title}</span>
      </Link>
    );
    return (
      <SidebarMenuItem key={item.href}>
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger render={link} />
            <TooltipContent side="right" sideOffset={8}>{item.title}</TooltipContent>
          </Tooltip>
        ) : link}
      </SidebarMenuItem>
    );
  };

  return (
    <TooltipProvider delay={0} closeDelay={0}>
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-0 overflow-hidden">
        <ModuleSwitcher />
      </SidebarHeader>
      <SidebarContent ref={contentRef} style={{ position: "relative" }}>
        {indicator && (
          <div
            className="rounded-md bg-sidebar-accent pointer-events-none left-3 right-3 group-data-[collapsible=icon]:left-1.5 group-data-[collapsible=icon]:right-1.5"
            style={{
              position: "absolute",
              top: indicator.top,
              height: indicator.height,
              zIndex: 0,
              transition: "top 250ms cubic-bezier(0.25, 0.1, 0.25, 1), height 150ms ease",
            }}
          />
        )}
        <SidebarGroup>
          <SidebarGroupLabel>Management</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {adminItems.map(renderItem)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
    </TooltipProvider>
  );
}
