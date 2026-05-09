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
  if (role === "committee") return "/admin/documents";
  return "/unauthorized";
}

export function canAccessPath(role: AppRole, pathname: string) {
  if (pathname.startsWith("/superadmin")) return isSuper(role);
  if (pathname.startsWith("/admin")) {
    if (isTenantAdmin(role)) return true;
    if (role === "committee") {
      return pathname.startsWith("/admin/documents");
    }
    return false;
  }
  if (pathname.startsWith("/guard")) return isSecurityGuard(role);
  if (pathname.startsWith("/resident")) return role === "resident";
  return true;
}
