import type { AppRole } from "@/lib/constants/roles";

function isSuper(role: AppRole) {
  return role === "super_admin" || role === "superadmin";
}

function isTenantAdmin(role: AppRole) {
  return role === "admin_tenant" || role === "tenant_admin";
}

function isSecurityGuard(role: AppRole) {
  return role === "security_guard" || role === "security";
}

export function routeByRole(role: AppRole) {
  if (isSuper(role)) return "/superadmin";
  if (isTenantAdmin(role)) return "/admin";
  if (role === "resident") return "/resident";
  if (isSecurityGuard(role)) return "/guard";
  return "/unauthorized";
}

/**
 * **El consejo no tiene rama aquí** (`PRD-V-PLAT-004`, `TBD-B`): el consejero es un residente
 * con una marca y sus pantallas viven en `/resident`, que ya es suyo. Lo que se las cierra a
 * los demás residentes es `veLasPantallasDelConsejo` (`src/lib/auth/consejo.ts`). Hasta el 11
 * de septiembre de 2026 había una rama del rol `committee` que abría `/admin/documents` —vista
 * de administrador para un residente— y no la usaba nadie.
 */
export function canAccessPath(role: AppRole, pathname: string) {
  if (pathname.startsWith("/superadmin")) return isSuper(role);
  if (pathname.startsWith("/admin")) return isTenantAdmin(role);
  if (pathname.startsWith("/guard")) return isSecurityGuard(role);
  if (pathname.startsWith("/resident")) return role === "resident";
  return true;
}
