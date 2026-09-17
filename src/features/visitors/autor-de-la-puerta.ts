/**
 * **`L-29` — cómo se lee el autor de una entrada o una salida.**
 *
 * Lote «Análisis de la plataforma», T4.3. El pase guarda un uid; la pantalla tiene que enseñar una
 * persona, y nunca el uid. Tres casos, y los tres importan:
 *
 * - **Con nombre:** «Registró Carlos Ramírez».
 * - **Con uid y sin nombre** (la cuenta se borró, o la membresía ya no está): «Registró la
 *   portería» — se sabe que fue la puerta, no quién.
 * - **Sin uid:** `null`, y la pantalla no dice nada. Es el caso de los 309 ingresos y 301 salidas
 *   anteriores al arreglo: inventar un autor ahí sería peor que callar.
 */
export function autorDeLaPuerta(
  uid: string | null | undefined,
  nombrePorUid: ReadonlyMap<string, string>,
): string | null {
  const clave = (uid ?? "").trim();
  if (!clave) return null;
  const nombre = (nombrePorUid.get(clave) ?? "").trim();
  return nombre ? `Registró ${nombre}` : "Registró la portería";
}
