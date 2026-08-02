/**
 * Tickets de soporte al cliente — contrato compartido.
 *
 * Ver `docs/PRD-V-FEAT-001-tickets-soporte.md`. Tres decisiones del modelo que
 * conviene tener presentes al tocar esto:
 *
 * 1. **El ticket pertenece al CONJUNTO, no a la persona.** Si el administrador
 *    se va, el siguiente ve el historial completo. Por eso `tenantId` manda y
 *    `createdBy` es solo trazabilidad.
 * 2. **El hilo es append-only.** Nada se edita ni se borra: es el registro de
 *    una conversación comercial, y un hilo editable no sirve de prueba de nada.
 * 3. **Las notas internas NO viven aquí.** Van en la subcolección
 *    `supportTickets/{id}/internal`, porque las reglas de Firestore no filtran
 *    campos: si estuvieran en este documento, el administrador con permiso de
 *    lectura las recibiría enteras por mucho que la interfaz no las pinte.
 *
 * ESPEJO de `functions/src/support-types.ts`. `src/` no puede importar de
 * `functions/` (rompe el build de App Hosting, ver CLAUDE.md), así que el
 * contrato vive duplicado a propósito. Si cambias uno, cambia el otro.
 */

export const SUPPORT_CATEGORIES = {
  tecnico: "Técnico",
  facturacion: "Facturación",
  operativo: "Operativo",
  otro: "Otro",
} as const;

export type SupportCategory = keyof typeof SUPPORT_CATEGORIES;

/**
 * Estados del ciclo de vida. `cerrado` es TERMINAL: no admite mensajes ni
 * cambios. Es justo lo que permite que «pendientes» signifique algo.
 */
export const SUPPORT_STATUSES = {
  abierto: "Abierto",
  en_proceso: "En proceso",
  esperando_respuesta: "Esperando tu respuesta",
  resuelto: "Resuelto",
  cerrado: "Cerrado",
} as const;

export type SupportStatus = keyof typeof SUPPORT_STATUSES;

export const SUPPORT_PRIORITIES = {
  alta: "Alta",
  media: "Media",
  baja: "Baja",
} as const;

export type SupportPriority = keyof typeof SUPPORT_PRIORITIES;

/**
 * Pendiente de VIVARU: lo que espera acción nuestra.
 *
 * `esperando_respuesta` NO cuenta: la pelota está en el cliente. Mezclarlos
 * haría que la cola creciera con tickets que no podemos avanzar, y el número
 * dejaría de servir para priorizar. Mismo criterio que ya usa PQRS
 * (`PENDING_TICKET_STATUSES` en `src/features/pqrs/ticket-status.ts`).
 */
export const PENDING_SUPPORT_STATUSES: ReadonlyArray<SupportStatus> = ["abierto", "en_proceso"];

export function isSupportPending(status: unknown): boolean {
  const value = typeof status === "string" ? status : "abierto";
  return (PENDING_SUPPORT_STATUSES as readonly string[]).includes(value);
}

/** Estados desde los que el cliente puede volver a escribir. */
export const CLIENT_WRITABLE_STATUSES: ReadonlyArray<SupportStatus> = [
  "abierto",
  "en_proceso",
  "esperando_respuesta",
];

export type SupportAuthorRole = "cliente" | "vivaru";

export type SupportMessage = {
  id: string;
  role: SupportAuthorRole;
  authorUid: string;
  authorName: string;
  message: string;
  /** ISO. Se sella en el servidor: el cliente no decide cuándo escribió. */
  createdAt: string;
};

export type SupportTicket = {
  id: string;
  tenantId: string;
  tenantName: string;
  createdBy: string;
  createdByName: string;
  createdByEmail: string;
  category: SupportCategory;
  subject: string;
  description: string;
  priority: SupportPriority;
  status: SupportStatus;
  thread: SupportMessage[];
  createdAt?: string;
  updatedAt?: string;
  /** Cualquier mensaje o cambio de estado lo mueve. Alimenta antigüedad. */
  lastActivityAt?: string;
  resolvedAt?: string;
  closedAt?: string;
  /**
   * Campos de la etapa en que esto era una bitácora interna del superadmin.
   * Se conservan para no perder los tickets viejos; no se escriben en nuevos.
   */
  reportedByName?: string;
  notes?: string;
};

/** Límites por conjunto. Frenan el abuso, no el uso. */
export const SUPPORT_LIMITS = {
  /** Tickets sin cerrar a la vez. Obliga a cerrar antes de abrir más. */
  maxOpenPerTenant: 5,
  /** Altas por día. Freno para bucles y errores de integración. */
  maxPerDay: 10,
  /** Días para reabrir un ticket resuelto. Pasados, se abre uno nuevo. */
  reopenWindowDays: 7,
  subjectMaxLength: 120,
  descriptionMaxLength: 4000,
  messageMaxLength: 4000,
} as const;

/** Antigüedad en días desde la última actividad. Null si no hay dato. */
export function daysSinceActivity(ticket: Pick<SupportTicket, "lastActivityAt">): number | null {
  if (!ticket.lastActivityAt) return null;
  const then = new Date(ticket.lastActivityAt).getTime();
  if (Number.isNaN(then)) return null;
  return Math.floor((Date.now() - then) / 86_400_000);
}

/** `true` si el cliente todavía está a tiempo de reabrir. */
export function canReopen(ticket: Pick<SupportTicket, "status" | "resolvedAt">): boolean {
  if (ticket.status !== "resuelto" || !ticket.resolvedAt) return false;
  const resolved = new Date(ticket.resolvedAt).getTime();
  if (Number.isNaN(resolved)) return false;
  const dias = (Date.now() - resolved) / 86_400_000;
  return dias <= SUPPORT_LIMITS.reopenWindowDays;
}
