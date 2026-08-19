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
 * ESPEJO del contrato que vive dentro de `functions/src/support.ts` — el tipo
 * `TicketDoc` y su `SUPPORT_LIMITS`. `src/` no puede importar de `functions/`
 * (rompe el build de App Hosting, ver CLAUDE.md), así que está duplicado a
 * propósito: si cambias uno, cambia el otro. (Este comentario decía
 * `functions/src/support-types.ts`, que nunca ha existido.)
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

/**
 * Evidencia adjunta a un mensaje. Se guarda la ruta de Storage además de la
 * URL: la ruta es lo que el servidor valida —que pertenezca al conjunto que
 * dice— y la URL es solo para mostrarla.
 */
export type SupportAttachment = {
  name: string;
  /** `tenants/{tenantId}/support/...` */
  path: string;
  url: string;
  size: number;
  contentType: string;
};

export type SupportMessage = {
  id: string;
  role: SupportAuthorRole;
  authorUid: string;
  authorName: string;
  message: string;
  attachments?: SupportAttachment[];
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
   * `SUP-001` — quién de Vivaru responde por este ticket. Se rellena solo al
   * responder por primera vez (quien contesta se lo queda) y se puede
   * reasignar desde Superadmin. Sin la asignación automática, un ticket
   * contestado seguiría sin responsable hasta que alguien pulsara un botón.
   */
  assignedTo?: string;
  assignedToName?: string;
  assignedAt?: string;
  /**
   * `SUP-001` — cuándo respondió Vivaru por PRIMERA vez. ISO, sellada en el
   * servidor y **nunca sobrescrita**.
   *
   * Un cambio de estado no cuenta: responder es escribirle al cliente, y
   * marcar «en proceso» sin decirle nada no es haber respondido.
   *
   * **No se rellena hacia atrás y no se puede.** Los tickets anteriores a esta
   * ficha no tienen el dato y nunca lo tendrán: sale de un momento que ya pasó
   * y del que no queda registro. Inventarlo a partir de `updatedAt` daría una
   * métrica con aspecto de real, que es peor que no tenerla.
   */
  firstResponseAt?: string;
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
  /**
   * Adjuntos. El tope global de Storage son 25 MB, pero para soporte se baja a
   * 5: una captura pesa cientos de kilobytes, y un tope alto solo invita a
   * subir un vídeo de pantalla que nadie va a ver.
   *
   * El límite vive en la callable, no en las reglas de Storage, y sigue
   * viviendo ahí después de `FIN-000`: la callable lee el tamaño y el tipo
   * REALES del archivo ya subido, mientras que una regla solo puede creerse lo
   * que el cliente declara en la petición — y el cliente es justo quien
   * queremos validar.
   *
   * (Hasta agosto de 2026 el motivo era otro: existía una concesión ancha
   * sobre `tenants/{id}/**` que daba 25 MB, y como las reglas de Storage SUMAN
   * permisos, ninguna regla de subruta podía recortarla. `FIN-000` eliminó esa
   * concesión y ahora el permiso se da carpeta a carpeta.)
   */
  maxAttachmentsPerMessage: 3,
  maxAttachmentBytes: 5 * 1024 * 1024,
  subjectMaxLength: 120,
  descriptionMaxLength: 4000,
  messageMaxLength: 4000,
} as const;

/** Antigüedad en días desde la última actividad. Null si no hay dato. */
/** Tipos que se aceptan como evidencia. Una captura o un PDF, nada más. */
export const SUPPORT_ATTACHMENT_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
] as const;

export function isAllowedAttachment(file: { type: string; size: number }): string | null {
  if (!(SUPPORT_ATTACHMENT_TYPES as readonly string[]).includes(file.type)) {
    return "Solo se aceptan imágenes (PNG, JPG, WEBP, GIF) o PDF.";
  }
  if (file.size > SUPPORT_LIMITS.maxAttachmentBytes) {
    return `Cada archivo debe pesar menos de ${SUPPORT_LIMITS.maxAttachmentBytes / (1024 * 1024)} MB.`;
  }
  return null;
}

export function daysSinceActivity(ticket: Pick<SupportTicket, "lastActivityAt">): number | null {
  if (!ticket.lastActivityAt) return null;
  const then = new Date(ticket.lastActivityAt).getTime();
  if (Number.isNaN(then)) return null;
  return Math.floor((Date.now() - then) / 86_400_000);
}

/**
 * Horas hasta la primera respuesta de Vivaru (`SUP-001`).
 *
 * `null` significa **dos cosas distintas** y por eso quien lo pinta debe
 * mirar también el estado: o el ticket sigue sin respuesta, o es anterior a
 * esta ficha y el dato no existe. Confundirlos haría parecer desatendidos a
 * tickets que se contestaron hace meses.
 */
export function horasHastaPrimeraRespuesta(
  ticket: Pick<SupportTicket, "createdAt" | "firstResponseAt">,
): number | null {
  if (!ticket.createdAt || !ticket.firstResponseAt) return null;
  const alta = new Date(ticket.createdAt).getTime();
  const respuesta = new Date(ticket.firstResponseAt).getTime();
  if (Number.isNaN(alta) || Number.isNaN(respuesta)) return null;
  const horas = (respuesta - alta) / 3_600_000;
  return horas < 0 ? null : Math.round(horas * 10) / 10;
}

/** `true` si el ticket espera acción nuestra y todavía nadie ha respondido. */
export function esperaPrimeraRespuesta(
  ticket: Pick<SupportTicket, "status" | "firstResponseAt">,
): boolean {
  return !ticket.firstResponseAt && isSupportPending(ticket.status);
}

/** `true` si el cliente todavía está a tiempo de reabrir. */
export function canReopen(ticket: Pick<SupportTicket, "status" | "resolvedAt">): boolean {
  if (ticket.status !== "resuelto" || !ticket.resolvedAt) return false;
  const resolved = new Date(ticket.resolvedAt).getTime();
  if (Number.isNaN(resolved)) return false;
  const dias = (Date.now() - resolved) / 86_400_000;
  return dias <= SUPPORT_LIMITS.reopenWindowDays;
}
