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
