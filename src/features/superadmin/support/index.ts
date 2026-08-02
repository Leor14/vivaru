/**
 * Punto de entrada del módulo de soporte para la consola interna.
 *
 * El contrato (estados, categorías, prioridades) viene de
 * `@/features/support/types`, que es el mismo que usa el portal del
 * administrador: soporte es UNA cola vista desde dos lados.
 */
export * from "./types";
export { addInternalNote, replyAsVivaru, updateSupportTicket, watchSupportTickets } from "./services";
