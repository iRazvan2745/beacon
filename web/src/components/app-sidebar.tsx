"use client";

import * as React from "react";
import {
  Archive,
  BarChart3,
  BookOpen,
  Server,
  Settings2,
  SquareTerminal,
} from "lucide-react";

import { NavMain } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";

const data = {
  user: {
    name: "shadcn",
    email: "m@example.com",
    avatar: "",
  },
  // Make sure keys match NavMain expectations
  navMain: [
    { name: "Dashboard", url: "/", icon: SquareTerminal },
    { name: "Statistics", url: "/stats", icon: BarChart3 },
    { name: "Snapshots", url: "/snapshots", icon: Archive },
    { name: "Machines", url: "/machines", icon: Server },
    { name: "Settings", url: "/settings", icon: Settings2 },
  ],
};

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader />
      <SidebarContent>
        <NavMain items={data.navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
