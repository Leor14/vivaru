import type { AppRole } from "@/lib/constants/roles";

export interface NavItem {
  href: string;
  label: string;
}

export const roleNavigation: Record<AppRole, NavItem[]> = {
  super_admin: [
    { href: "/superadmin", label: "Dashboard global" },
    { href: "/superadmin/tenants", label: "Tenants" },
    { href: "/superadmin/admin-users", label: "Admins" },
    { href: "/superadmin/plans", label: "Planes" },
    { href: "/superadmin/support", label: "Soporte" },
    { href: "/superadmin/audit", label: "Auditoria" },
  ],
  superadmin: [
    { href: "/superadmin", label: "Dashboard global" },
    { href: "/superadmin/tenants", label: "Tenants" },
    { href: "/superadmin/admin-users", label: "Admins" },
    { href: "/superadmin/plans", label: "Planes" },
    { href: "/superadmin/support", label: "Soporte" },
    { href: "/superadmin/audit", label: "Auditoria" },
  ],
  admin_tenant: [
    { href: "/admin", label: "Panel de Control" },
    { href: "/admin/users", label: "Usuarios" },
    { href: "/admin/residents", label: "Residentes y unidades" },
    { href: "/admin/communications", label: "Comunicaciones" },
    { href: "/admin/billing", label: "Cartera" },
    { href: "/admin/reservations", label: "Reservas" },
    { href: "/admin/visitors", label: "Visitantes" },
    { href: "/admin/packages", label: "Paquetería" },
    { href: "/admin/pqrs", label: "PQRS" },
    { href: "/admin/documents", label: "Documentos" },
    { href: "/admin/settings", label: "Perfil" },
  ],
  tenant_admin: [
    { href: "/admin", label: "Panel de Control" },
    { href: "/admin/users", label: "Usuarios" },
    { href: "/admin/residents", label: "Residentes y unidades" },
    { href: "/admin/communications", label: "Comunicaciones" },
    { href: "/admin/billing", label: "Cartera" },
    { href: "/admin/reservations", label: "Reservas" },
    { href: "/admin/visitors", label: "Visitantes" },
    { href: "/admin/packages", label: "Paquetería" },
    { href: "/admin/pqrs", label: "PQRS" },
    { href: "/admin/documents", label: "Documentos" },
    { href: "/admin/settings", label: "Perfil" },
  ],
  resident: [
    { href: "/resident", label: "Inicio" },
    { href: "/resident/account", label: "Estado de cuenta" },
    { href: "/resident/reservations", label: "Reservas" },
    { href: "/resident/visitors", label: "Visitantes" },
    { href: "/resident/communications", label: "Comunicaciones" },
    { href: "/resident/packages", label: "Paquetería" },
    { href: "/resident/pqrs", label: "PQRS" },
    { href: "/resident/profile", label: "Perfil" },
  ],
  security_guard: [
    { href: "/guard", label: "Inicio" },
    { href: "/guard/reservations", label: "Reservas" },
    { href: "/guard/visitors", label: "Visitantes" },
    { href: "/guard/packages/new", label: "Registrar paquete" },
    { href: "/guard/packages", label: "Paquetes recibidos" },
  ],
  security: [
    { href: "/guard", label: "Inicio" },
    { href: "/guard/reservations", label: "Reservas" },
    { href: "/guard/visitors", label: "Visitantes" },
    { href: "/guard/packages/new", label: "Registrar paquete" },
    { href: "/guard/packages", label: "Paquetes recibidos" },
  ],
  committee: [{ href: "/admin/documents", label: "Asambleas" }],
};
