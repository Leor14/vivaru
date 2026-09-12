export const APP_ROLES = {
  SUPER_ADMIN: "super_admin",
  ADMIN_TENANT: "admin_tenant",
  SUPERADMIN: "superadmin",
  TENANT_ADMIN: "tenant_admin",
  RESIDENT: "resident",
  SECURITY_GUARD: "security_guard",
  SECURITY: "security",
} as const;

// **`committee` no está, y no es un olvido** (`PRD-V-PLAT-004`, `RN-01`). El consejo es una
// MARCA de la membresía de residente (`isCommittee`), no un rol: como rol le quitaba a la
// persona su unidad. En el front solo abría `/admin/documents`, y `TBD-B` llevó al consejero
// al portal del residente. El valor sigue admitido en `firestore.rules` y en
// `identidadParaFirmar` por compatibilidad —no lo tiene nadie: 0 de 41 en producción el 4 de
// septiembre de 2026—; si apareciera, la sesión caería al `resident` por defecto.

export type AppRole = (typeof APP_ROLES)[keyof typeof APP_ROLES];

export const ROLE_LABEL: Record<AppRole, string> = {
  super_admin: "Superadmin Vivaru",
  admin_tenant: "Administración",
  superadmin: "Superadmin Vivaru",
  tenant_admin: "Administración",
  resident: "Residente",
  security_guard: "Guarda de seguridad",
  security: "Porteria",
};
