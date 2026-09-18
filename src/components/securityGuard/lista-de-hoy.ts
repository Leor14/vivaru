import { frecuenteLeTocaElDia } from "@/features/visitors/frecuente";
import { toDateInputValue } from "@/utils/datetimeValidation";

/**
 * La lista de hoy de la portería: qué visitas y reservas son «de hoy».
 *
 * «Hoy» es el día del calendario de quien está en la puerta, no el de UTC. Se comparaba con el
 * día de `toISOString()`, que desde las 18:00 de México (19:00 en Colombia y Ecuador) ya es
 * mañana: por la tarde el panel enseñaba las reservas y las visitas del día siguiente.
 *
 * El otro lado de la comparación también es local: reservas y pases guardan el día del
 * formulario, y las invitaciones del residente lo guardan así desde que dejaron de sacarlo de
 * `toISOString()` (`src/features/visitors/invitations.ts`). Van juntos: arreglar solo este lado
 * habría escondido las invitaciones de la tarde, que guardaban ya el día siguiente.
 *
 * Vive fuera de `GuardDashboard` para que una prueba la alcance: dentro del componente ningún
 * banco la veía (`tests/porteria-hoy-local.test.ts`).
 */
export function esDeHoy(fecha: string | undefined, ahora: Date = new Date()) {
  if (!fecha) return false;
  return fecha.slice(0, 10) === toDateInputValue(ahora);
}

/**
 * **Un frecuente sale cada día que le toca, no solo el primero** (`L-08b`, 18 sep 2026). Comparaba
 * solo `date`, que en un frecuente es el día de inicio: el de la administración salía en la lista
 * de hoy una vez y luego nunca más. Un revocado no sale nunca.
 */
export function visitasEsperadasHoy<
  T extends Parameters<typeof frecuenteLeTocaElDia>[0] & { visitDate?: string; status: string },
>(visitas: T[], ahora: Date = new Date()) {
  const hoy = toDateInputValue(ahora);
  return visitas.filter((visita) => {
    if (visita.status === "completed" || visita.status === "cancelled") return false;
    if (visita.authorizationType === "larga_duracion") return frecuenteLeTocaElDia(visita, hoy);
    return esDeHoy(visita.date || visita.visitDate, ahora);
  });
}

export function reservasActivasHoy<T extends { date?: string; status?: string }>(
  reservas: T[],
  ahora: Date = new Date(),
) {
  return reservas.filter((reserva) => esDeHoy(reserva.date, ahora) && reserva.status !== "cancelled");
}
