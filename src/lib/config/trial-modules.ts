import type { TenantStatus } from "@/types/domain";

/**
 * Matriz de acceso a módulos durante el trial (Regla A del plan self-service).
 *
 * Tres niveles, porque un candado binario desperdicia el mejor activo
 * comercial: **lo que el prospecto ve pero no puede usar es lo que genera el
 * deseo de pagar.**
 *
 * - `libre`    → usar sin restricción durante la prueba.
 * - `limitado` → usar con cuota (storage, correo a terceros).
 * - `preview`  → VER la pantalla con datos de ejemplo, sin poder operar.
 *
 * Solo aplica a ambientes en `trial` / `expired`. Un cliente (`active`) tiene
 * todo abierto — por eso `moduleAccessFor` devuelve "libre" para ellos.
 *
 * OJO: esta matriz se replica en `functions/src/trial-modules.ts` porque `src/`
 * no puede importar de `functions/` (rompe el build de App Hosting, ver
 * CLAUDE.md). Si cambias una, cambia la otra.
 */

export type ModuleAccess = "libre" | "limitado" | "preview";

/** Clave de módulo = prefijo de ruta del admin. */
export type TrialModuleKey =
  | "dashboard"
  | "residents"
  | "visitors"
  | "packages"
  | "communications"
  | "pqrs"
  | "reservations"
  | "surveys"
  | "services"
  | "documents"
  | "regulations"
  | "billing"
  | "finanzas"
  | "reports"
  | "users"
  | "settings";

/**
 * Núcleo operativo + los dos que sorprenden (reservas y encuestas) quedan
 * libres; lo que se vende queda en vista previa.
 */
export const TRIAL_MODULE_ACCESS: Record<TrialModuleKey, ModuleAccess> = {
  // Núcleo operativo: la rutina diaria de un administrador.
  dashboard: "libre",
  residents: "libre",
  visitors: "libre",
  packages: "libre",
  communications: "libre",
  pqrs: "libre",
  // Los dos que sorprenden — donde se gana la conversión.
  reservations: "libre",
  surveys: "libre",
  services: "libre",
  // Configuración: necesaria para configurar el conjunto.
  users: "libre",
  settings: "libre",
  // Limitado por costo, no por capacidad.
  documents: "limitado",
  // 🔒 Lo que se vende: se ve poblado con datos de ejemplo, no se opera.
  billing: "preview",
  finanzas: "preview",
  reports: "preview",
  regulations: "preview",
};

/** Copy del candado por módulo: qué es y por qué vale la pena. */
export const PREVIEW_COPY: Partial<Record<TrialModuleKey, { title: string; body: string }>> = {
  billing: {
    title: "Cartera y cobros",
    body: "Emite cuotas por unidad o en lote, registra pagos, controla la mora y envía recordatorios automáticos. Lo que ves abajo son datos de ejemplo.",
  },
  finanzas: {
    title: "Finanzas del conjunto",
    body: "Libro de ingresos y egresos, fondo de reserva y conciliación bancaria contra el extracto. Lo que ves abajo son datos de ejemplo.",
  },
  reports: {
    title: "Reporte de Comité",
    body: "El informe ejecutivo que presentas al comité y a la asamblea: cartera, morosidad, resultado del período y firmas. Lo que ves abajo son datos de ejemplo.",
  },
  regulations: {
    title: "Reglamento y firmas",
    body: "Publica el reglamento y recoge la firma de cada unidad con constancia. Durante la prueba no se emiten firmas con valor legal.",
  },
};

const ROUTE_TO_MODULE: Array<[string, TrialModuleKey]> = [
  ["/admin/residents", "residents"],
  ["/admin/visitors", "visitors"],
  ["/admin/packages", "packages"],
  ["/admin/communications", "communications"],
  ["/admin/pqrs", "pqrs"],
  ["/admin/reservations", "reservations"],
  ["/admin/surveys", "surveys"],
  ["/admin/services", "services"],
  ["/admin/documents", "documents"],
  ["/admin/regulations", "regulations"],
  ["/admin/billing", "billing"],
  ["/admin/finanzas", "finanzas"],
  ["/admin/reports", "reports"],
  ["/admin/users", "users"],
  ["/admin/settings", "settings"],
];

/** Módulo al que pertenece una ruta del admin (o null si no aplica). */
export function moduleForPath(pathname: string): TrialModuleKey | null {
  for (const [prefix, key] of ROUTE_TO_MODULE) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return key;
  }
  return pathname === "/admin" ? "dashboard" : null;
}

/**
 * Nivel de acceso efectivo. Los clientes (`active`) y los estados sin
 * restricción tienen todo libre; el candado solo existe durante la prueba.
 */
export function moduleAccessFor(status: TenantStatus | undefined, key: TrialModuleKey): ModuleAccess {
  if (status !== "trial" && status !== "expired") return "libre";
  return TRIAL_MODULE_ACCESS[key] ?? "libre";
}

/** `true` si el módulo está bajo llave para ese estado de tenant. */
export function isModuleLocked(status: TenantStatus | undefined, key: TrialModuleKey): boolean {
  return moduleAccessFor(status, key) === "preview";
}
