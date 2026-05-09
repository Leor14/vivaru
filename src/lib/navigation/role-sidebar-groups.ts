import type { ComponentType } from "react";
import {
  Building2,
  CalendarCheck,
  FileText,
  Grid3X3,
  Home,
  MessageSquare,
  Package,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";

import { roleNavigation } from "@/lib/constants/navigation";
import type { AppRole } from "@/lib/constants/roles";
import type { AdminSidebarGroup } from "@/components/shared/admin-sidebar";

type IconComponent = ComponentType<{ className?: string; strokeWidth?: number }>;

const ICON_BY_HREF: Record<string, IconComponent> = {
  "/superadmin": ShieldCheck,
  "/superadmin/tenants": Building2,
  "/superadmin/admin-users": Users,
  "/superadmin/plans": Wallet,
  "/superadmin/support": MessageSquare,
  "/superadmin/audit": FileText,
  "/admin": Grid3X3,
  "/admin/users": Users,
  "/admin/residents": Users,
  "/admin/communications": MessageSquare,
  "/admin/billing": Wallet,
  "/admin/reservations": CalendarCheck,
  "/admin/visitors": Users,
  "/admin/packages": Package,
  "/admin/pqrs": FileText,
  "/admin/documents": FileText,
  "/admin/settings": Building2,
  "/resident": Home,
  "/resident/account": Wallet,
  "/resident/reservations": CalendarCheck,
  "/resident/visitors": Users,
  "/resident/communications": MessageSquare,
  "/resident/packages": Package,
  "/resident/pqrs": FileText,
  "/resident/profile": Users,
  "/guard": Home,
  "/guard/reservations": CalendarCheck,
  "/guard/visitors": Users,
  "/guard/packages/new": Package,
  "/guard/packages": Package,
};

const GROUP_LABEL_BY_ROLE: Record<string, string | undefined> = {
  resident: "MI EDIFICIO",
  security: "PORTERIA",
  security_guard: "PORTERIA",
  super_admin: "PLATAFORMA",
  superadmin: "PLATAFORMA",
  committee: "COMITE",
};

/**
 * Build sidebar groups for any non-admin role from the shared roleNavigation
 * configuration so all roles share the same dark sidebar visual language.
 * Admin roles render their own curated GROUPS inside AdminSidebar (default).
 */
export function buildRoleSidebarGroups(role: AppRole): AdminSidebarGroup[] {
  const items = roleNavigation[role] ?? [];
  if (items.length === 0) return [];
  return [
    {
      label: GROUP_LABEL_BY_ROLE[role],
      items: items.map((item) => ({
        href: item.href,
        label: item.label,
        icon: ICON_BY_HREF[item.href] ?? Home,
      })),
    },
  ];
}

export function profileHrefForRole(role: AppRole): string {
  switch (role) {
    case "resident":
      return "/resident/profile";
    case "security":
    case "security_guard":
      return "/guard";
    case "super_admin":
    case "superadmin":
      return "/superadmin";
    default:
      return "/admin/settings";
  }
}
