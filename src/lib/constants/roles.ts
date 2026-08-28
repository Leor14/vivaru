export const APP_ROLES = {
  SUPER_ADMIN: "super_admin",
  ADMIN_TENANT: "admin_tenant",
  SUPERADMIN: "superadmin",
  TENANT_ADMIN: "tenant_admin",
  RESIDENT: "resident",
  SECURITY_GUARD: "security_guard",
  SECURITY: "security",
  COMMITTEE: "committee",
} as const;

export type AppRole = (typeof APP_ROLES)[keyof typeof APP_ROLES];

export const ROLE_LABEL: Record<AppRole, string> = {
  super_admin: "Superadmin Vivaru",
  admin_tenant: "Administración",
  superadmin: "Superadmin Vivaru",
  tenant_admin: "Administración",
  resident: "Residente",
  security_guard: "Guarda de seguridad",
  security: "Porteria",
  committee: "Consejo",
};
