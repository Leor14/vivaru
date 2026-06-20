import { toDateKeyLocal } from "./date";

/**
 * Fecha canónica de eventos (`eventDate`, "YYYY-MM-DD") para colecciones
 * operativas. Permite consultas por rango server-side sin subcontar registros
 * con campos de fecha inconsistentes. Ver docs/plan-backfill-event-date.md.
 */

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Normaliza cualquier valor de fecha a "YYYY-MM-DD" local; "" si es inválido.
 * Si ya viene como date-key (YYYY-MM-DD) se devuelve tal cual, para no desfasar
 * un día al reinterpretarlo en otra zona horaria.
 */
export function asDateKey(value: unknown): string {
  if (typeof value === "string" && DATE_KEY_RE.test(value)) return value;
  return toDateKeyLocal(value);
}

/** Fecha canónica de una visita: día de la visita (no del check-in si hay fecha). */
export function resolveVisitorEventDate(pass: {
  date?: unknown;
  visitDate?: unknown;
  checkInAt?: unknown;
  createdAt?: unknown;
}): string {
  return (
    asDateKey(pass.date) ||
    asDateKey(pass.visitDate) ||
    asDateKey(pass.checkInAt) ||
    asDateKey(pass.createdAt) ||
    ""
  );
}

/** Fecha canónica de un ticket: fecha de radicación. */
export function resolveTicketEventDate(ticket: {
  radicationDate?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
}): string {
  return asDateKey(ticket.radicationDate) || asDateKey(ticket.createdAt) || asDateKey(ticket.updatedAt) || "";
}
