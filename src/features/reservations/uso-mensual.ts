/**
 * `PRD-V-FIX-001` entrega 1.1 — el cupo mensual que VE el residente, con los mismos
 * límites que el servidor (`crearReserva` en `functions/src/reservations.ts`): el
 * mes de la fecha elegida, del día 01 al «31» como cadena, sin canceladas ni
 * rechazadas. Solo se muestra; decide el servidor.
 */
export function rangoDelMes(fecha: string): { desde: string; hasta: string } {
  const mes = fecha.slice(0, 7);
  return { desde: `${mes}-01`, hasta: `${mes}-31` };
}

export function contarUsoMensual(reservas: { status?: string }[]): number {
  return reservas.filter((reserva) => reserva.status !== "cancelled" && reserva.status !== "rejected").length;
}
