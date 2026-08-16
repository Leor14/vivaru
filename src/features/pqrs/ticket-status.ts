import type { Ticket } from "@/types/domain";

/**
 * Definición ÚNICA de "PQRS pendiente de acción" (VIV-1003): abierta o en
 * proceso. Una PQRS "respondida" ya fue atendida por la administración (espera
 * cierre) y NO cuenta como pendiente. Antes el Dashboard y el badge del
 * sidebar contaban `responded` como abierta y el módulo no, así que el mismo
 * indicador mostraba 5 vs 3.
 */
export const PENDING_TICKET_STATUSES: ReadonlyArray<Ticket["status"]> = ["open", "in_progress"];

export function isTicketPending(status: unknown): boolean {
  const value = typeof status === "string" ? status : "open";
  return (PENDING_TICKET_STATUSES as readonly string[]).includes(value);
}

/**
 * Rótulos de `type`, en el mismo sitio y por la misma razón que lo de arriba.
 *
 * Vivían dentro de `/admin/pqrs/page.tsx`, y el asistente de IA necesita
 * exactamente los mismos: una sugerencia que diga «Petición» donde la pantalla
 * dice otra cosa es una sugerencia que el administrador no puede comparar.
 * Copiarlos habría sido la CUARTA copia — `docs/pendientes.md` ya anota que las
 * tres existentes divergieron (el widget de antigüedad pinta `other` como
 * «Otros» y estas dos pantallas como «General», así que el mismo ticket cambia
 * de nombre según dónde se mire).
 *
 * **Aquí se unifican dos de las tres, no las tres.** El widget se queda fuera a
 * propósito: unificarlo obliga a elegir entre «Otros» y «General», y esa es una
 * decisión de copy con su propio alcance, no un efecto colateral del asistente.
 */
export const TICKET_TYPE_LABELS: Record<string, string> = {
  petition: "Petición",
  complaint: "Queja",
  claim: "Reclamo",
  suggestion: "Sugerencia",
  other: "General",
};

export function getTicketTypeLabel(type?: string | null): string {
  if (!type) return "General";
  const key = type.trim().toLowerCase();
  return TICKET_TYPE_LABELS[key] ?? type;
}

/**
 * Rótulos de `category`. No existían en ninguna pantalla porque **nadie la
 * enseña**: el hallazgo del 15 de agosto es que `category` nace constante
 * (`"pqrs"`) y su único consumidor es un conteo del reporte del comité.
 *
 * El asistente es el primero que la pone delante de una persona, así que las
 * palabras se eligen aquí y con la definición del catálogo de la operación
 * detrás, no inventadas en el componente.
 */
export const TICKET_CATEGORY_LABELS: Record<string, string> = {
  pqrs: "PQRS",
  maintenance: "Mantenimiento",
  billing: "Cartera",
};

export function getTicketCategoryLabel(category?: string | null): string {
  if (!category) return "—";
  return TICKET_CATEGORY_LABELS[category.trim().toLowerCase()] ?? category;
}

/**
 * Rótulos de `priority`. Tampoco existían, y por una razón más fuerte que la de
 * `category`: **en un ticket de PQRS la prioridad no se escribe nunca.**
 * `createTicket` no la pone, ninguna pantalla del administrador la enseña y
 * ningún servicio la cambia. Todas las prioridades que hay en el repositorio son
 * del módulo de soporte del superadministrador, que es otra colección.
 */
export const TICKET_PRIORITY_LABELS: Record<string, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
};

export function getTicketPriorityLabel(priority?: string | null): string {
  if (!priority) return "—";
  return TICKET_PRIORITY_LABELS[priority.trim().toLowerCase()] ?? priority;
}
