/**
 * `PRD-V-FIX-001` entrega 1.1 — el `amenityId` de una reserva del administrador.
 *
 * El formulario elige el área por su nombre, y hasta el 12 sep 2026 la reserva se
 * guardaba SIN `amenityId`. El servidor cuenta aforo y cupo por ese campo, así que
 * no la veía: un residente podía reservar encima. Con un nombre repetido, o sin
 * coincidencia, no se elige una al azar: `null`, y la página no guarda.
 */
export function amenityIdPorNombre(areas: { id: string; name: string }[], nombre: string): string | null {
  const buscado = nombre.trim().toLocaleLowerCase("es");
  const coincidencias = areas.filter((area) => area.name.trim().toLocaleLowerCase("es") === buscado);
  return coincidencias.length === 1 ? coincidencias[0].id : null;
}
