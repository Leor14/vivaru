import type { AppRole } from "@/lib/constants/roles";
import type { SessionUser } from "@/types/domain";

export function hasRole(user: SessionUser | null, roles: AppRole[]) {
  if (!user) return false;
  return roles.includes(user.role);
}

export function assertTenantAccess(user: SessionUser | null, tenantId: string) {
  if (!user) return false;
  if (user.role === "superadmin" || user.role === "super_admin") return true;
  return user.tenantId === tenantId;
}
