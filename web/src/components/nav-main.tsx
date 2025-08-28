"use client";

import Link from "next/link";
import { type LucideIcon } from "lucide-react";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type NavItem = {
  name: string;
  url: string;
  icon: LucideIcon;
};

export function NavMain({
  items,
  currentPath,
}: {
  items: NavItem[];
  currentPath?: string;
}) {
  const { state } = useSidebar(); // "expanded" | "collapsed"

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Platform</SidebarGroupLabel>
      <SidebarMenu>
        <TooltipProvider delayDuration={200}>
          {items.map((item) => {
            const Icon = item.icon;
            const active = currentPath === item.url;

            const button = (
              <SidebarMenuButton asChild data-active={active || undefined}>
                <Link href={item.url}>
                  <Icon className="h-5 w-5" />
                  {state === "expanded" && <span>{item.name}</span>}
                </Link>
              </SidebarMenuButton>
            );

            return (
              <SidebarMenuItem key={item.url}>
                {state === "collapsed" ? (
                  <Tooltip>
                    <TooltipTrigger asChild>{button}</TooltipTrigger>
                    <TooltipContent side="right">{item.name}</TooltipContent>
                  </Tooltip>
                ) : (
                  button
                )}
              </SidebarMenuItem>
            );
          })}
        </TooltipProvider>
      </SidebarMenu>
    </SidebarGroup>
  );
}