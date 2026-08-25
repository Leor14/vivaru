import type { ComponentType } from "react";
import {
  BarChart2,
  BriefcaseBusiness,
  Building2,
  CalendarCheck,
  ClipboardList,
  FileText,
  Grid3X3,
  Home,
  MessageSquare,
  Package,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Store,
  ToggleRight,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";

import { roleNavigation } from "@/lib/constants/navigation";
import type { AppRole } from "@/lib/constants/roles";
import { ADMIN_SIDEBAR_GROUPS, type AdminSidebarGroup } from "@/components/shared/admin-sidebar";
import { type ResidentModules, DEFAULT_RESIDENT_MODULES } from "@/features/admin/services";
import type { FinanceVariant } from "@/lib/config/module-variants";

type IconComponent = ComponentType<{ className?: string; strokeWidth?: number }>;

const ICON_BY_HREF: Record<string, IconComponent> = {
  "/superadmin": ShieldCheck,
  "/superadmin/tenants": Building2,
  "/superadmin/administradoras": Building2,
  "/superadmin/leads": UserPlus,
  "/superadmin/comerciales": BriefcaseBusiness,
  "/superadmin/admin-users": Users,
  "/superadmin/plans": Wallet,
  "/superadmin/metrics": BarChart2,
  "/superadmin/support": MessageSquare,
  "/superadmin/flags": ToggleRight,
  "/superadmin/ia": Sparkles,
  "/superadmin/audit": FileText,
  "/admin": Grid3X3,
  "/admin/users": Users,
  "/admin/residents": Users,
  "/admin/communications": MessageSquare,
  "/admin/services": Store,
  "/admin/surveys": ClipboardList,
  "/admin/regulations": ScrollText,
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
  "/resident/services": Store,
  "/resident/surveys": ClipboardList,
  "/resident/regulations": ScrollText,
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

/** Maps resident module keys to the hrefs they control in the resident sidebar. */
const RESIDENT_MODULE_HREFS: Record<keyof ResidentModules, string> = {
  reservations: "/resident/reservations",
  services: "/resident/services",
  surveys: "/resident/surveys",
  regulations: "/resident/regulations",
};

/**
 * Build sidebar groups for any non-admin role from the shared roleNavigation
 * configuration so all roles share the same dark sidebar visual language.
 * Admin roles render their own curated GROUPS inside AdminSidebar (default).
 *
 * For the "resident" role, pass `residentModules` to hide disabled modules.
 * Omitting `residentModules` defaults to all modules enabled.
 */
/**
 * Módulos de FIRMA que se ocultan al residente mientras el conjunto está en
 * prueba: una firma de reglamento o de acuerdo sin valor legal es una promesa
 * falsa, y ese es el único riesgo real del portal del residente en un trial.
 * El resto sigue visible — el administrador necesita evaluar la experiencia
 * completa, y en prueba no se invita a residentes reales (Regla B).
 */
const SIGNATURE_HREFS_HIDDEN_IN_TRIAL = ["/resident/regulations", "/resident/agreements"];

export function buildRoleSidebarGroups(
  role: AppRole,
  residentModules?: ResidentModules,
  isTrialTenant = false,
): AdminSidebarGroup[] {
  const items = roleNavigation[role] ?? [];
  if (items.length === 0) return [];

  // Build the set of hrefs that should be hidden for the resident role
  const hiddenHrefs = new Set<string>();
  if (role === "resident" && residentModules) {
    const effective = { ...DEFAULT_RESIDENT_MODULES, ...residentModules };
    for (const [key, href] of Object.entries(RESIDENT_MODULE_HREFS)) {
      if (!effective[key as keyof ResidentModules]) {
        hiddenHrefs.add(href);
      }
    }
  }

  if (role === "resident" && isTrialTenant) {
    for (const href of SIGNATURE_HREFS_HIDDEN_IN_TRIAL) hiddenHrefs.add(href);
  }

  const filteredItems = items.filter((item) => !hiddenHrefs.has(item.href));

  return [
    {
      label: GROUP_LABEL_BY_ROLE[role],
      items: filteredItems.map((item) => ({
        href: item.href,
        label: item.label,
        icon: ICON_BY_HREF[item.href] ?? Home,
      })),
    },
  ];
}

/** Rutas del grupo FINANCIERO que permanecen en modo `solo_consulta` (solo Cartera/consulta). */
const SOLO_CONSULTA_FINANCE_HREFS = new Set<string>(["/admin/billing"]);

/**
 * Grupos del sidebar admin, gateados por la variante de Finanzas. En `solo_consulta` se ocultan
 * las herramientas contables pesadas (Egresos, Libro y fondos, Conciliación); queda solo Cartera.
 * En `completa` (default) devuelve los grupos completos sin cambios.
 */
export function buildAdminSidebarGroups(financeVariant?: FinanceVariant): AdminSidebarGroup[] {
  if (financeVariant !== "solo_consulta") return ADMIN_SIDEBAR_GROUPS;
  return ADMIN_SIDEBAR_GROUPS.map((group) =>
    group.label === "FINANCIERO"
      ? { ...group, items: group.items.filter((item) => SOLO_CONSULTA_FINANCE_HREFS.has(item.href)) }
      : group,
  );
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
