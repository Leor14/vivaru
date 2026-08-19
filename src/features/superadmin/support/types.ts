/**
 * Contrato de soporte para la consola interna.
 *
 * Reexporta el contrato compartido de `@/features/support/types` en vez de
 * mantener el suyo: soporte es UNA cola vista desde dos lados, y tener dos
 * definiciones de sus estados es la forma más segura de que se separen.
 *
 * Antes de PRD-V-FEAT-001 esto era una bitácora interna con estados y
 * categorías propios en inglés (`open` / `technical` / `high`). Se conserva la
 * traducción más abajo: hoy no hay ningún ticket con esos valores ni en
 * staging ni en producción —comprobado—, pero tolerarlos cuesta cero y
 * romperse delante de un cliente no.
 */

export type {
  SupportCategory,
  SupportMessage,
  SupportPriority,
  SupportStatus,
  SupportTicket,
} from "@/features/support/types";

export {
  PENDING_SUPPORT_STATUSES,
  SUPPORT_CATEGORIES,
  SUPPORT_LIMITS,
  SUPPORT_PRIORITIES,
  SUPPORT_STATUSES,
  canReopen,
  daysSinceActivity,
  esperaPrimeraRespuesta,
  horasHastaPrimeraRespuesta,
  isSupportPending,
} from "@/features/support/types";

import type { SupportCategory, SupportPriority, SupportStatus } from "@/features/support/types";

const LEGACY_STATUS: Record<string, SupportStatus> = {
  open: "abierto",
  in_progress: "en_proceso",
  resolved: "resuelto",
};

const LEGACY_CATEGORY: Record<string, SupportCategory> = {
  technical: "tecnico",
  billing: "facturacion",
  operational: "operativo",
  other: "otro",
};

const LEGACY_PRIORITY: Record<string, SupportPriority> = {
  high: "alta",
  medium: "media",
  low: "baja",
};

/**
 * Un estado desconocido cae en `abierto`: es mejor que aparezca en la cola a
 * que desaparezca sin que nadie lo note.
 */
export function normalizeSupportStatus(value: unknown): SupportStatus {
  const raw = typeof value === "string" ? value : "";
  if (LEGACY_STATUS[raw]) return LEGACY_STATUS[raw];
  const conocidos: SupportStatus[] = ["abierto", "en_proceso", "esperando_respuesta", "resuelto", "cerrado"];
  return conocidos.includes(raw as SupportStatus) ? (raw as SupportStatus) : "abierto";
}

export function normalizeSupportCategory(value: unknown): SupportCategory {
  const raw = typeof value === "string" ? value : "";
  if (LEGACY_CATEGORY[raw]) return LEGACY_CATEGORY[raw];
  const conocidas: SupportCategory[] = ["tecnico", "facturacion", "operativo", "otro"];
  return conocidas.includes(raw as SupportCategory) ? (raw as SupportCategory) : "otro";
}

export function normalizeSupportPriority(value: unknown): SupportPriority {
  const raw = typeof value === "string" ? value : "";
  if (LEGACY_PRIORITY[raw]) return LEGACY_PRIORITY[raw];
  const conocidas: SupportPriority[] = ["alta", "media", "baja"];
  return conocidas.includes(raw as SupportPriority) ? (raw as SupportPriority) : "media";
}
