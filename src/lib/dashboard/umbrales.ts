/**
 * **La escala de color del Panel de Control, en un solo sitio.**
 *
 * Existe porque la misma regla vivía escrita a mano en dos ficheros y en tres formas distintas,
 * y eso hizo que la pantalla se contradijera con datos reales:
 *
 * - Las barras **por torre** aplicaban 70 / 40 correctamente.
 * - La barra del **total** estaba clavada en verde, así que marcaba **6% en verde** mientras
 *   Torre 1, dentro del mismo recuadro, marcaba **11% en rojo**.
 * - Las tarjetas de **% recaudo** y **Reservas** tenían el tono constante, así que un recaudo de
 *   **0,0%** se pintaba de verde.
 *
 * Con una sola función, dos verdes de esta pantalla significan lo mismo — que es lo único que
 * hace que un color informe en vez de decorar.
 */

/** Desde este porcentaje, la cosa va bien. */
export const UMBRAL_BIEN = 70;
/** Por debajo de este porcentaje, la cosa va mal. Entre los dos, atención. */
export const UMBRAL_ATENCION = 40;

export type TonoDeIndicador = "success" | "pending" | "alert" | "neutral";

/**
 * Tono de un indicador que se mide en porcentaje y donde **más alto es mejor**.
 *
 * No la uses con recuentos de actividad —visitantes, reservas—: contar lo que pasó no es un
 * logro ni un problema, y pintarlo de verde le quita significado al verde de las tarjetas
 * donde sí lo tiene.
 */
export function tonoPorPorcentaje(pct: number): TonoDeIndicador {
  if (pct >= UMBRAL_BIEN) return "success";
  if (pct >= UMBRAL_ATENCION) return "pending";
  return "alert";
}

/**
 * Color de una barra de avance, con la MISMA escala que `tonoPorPorcentaje`.
 *
 * Devuelve `null` cuando no hay nada que medir (`total === 0`), y eso es deliberado:
 * **«sin datos» no es «lo peor»**. Pintar de rojo un total vacío inventaría un problema donde
 * lo único que falta es el dato. Quien la use debe caer a un color neutro con `?? …`.
 */
export function colorPorPorcentaje(pct: number, total: number): string | null {
  if (total === 0) return null;
  if (pct >= UMBRAL_BIEN) return "#1D9E75";
  if (pct >= UMBRAL_ATENCION) return "#EF9F27";
  return "#E24B4A";
}

/**
 * Color del CARRIL de la barra: el mismo tono, muy rebajado.
 *
 * **Existe por una regresión que las pruebas no vieron y el navegador sí.** El primer intento
 * pintó carril y relleno del mismo color para que un 0% sobre un total real no se confundiera
 * con «sin datos» — y con eso **el avance dejó de verse**: una torre al 11% y tres al 0% salían
 * como cuatro barras rojas idénticas. Arreglar la lectura del cero rompió la del progreso.
 *
 * Con el carril teñido se cumplen las tres cosas a la vez: el relleno se distingue del carril,
 * un 0% con datos reales tiene color, y `total === 0` sigue cayendo a gris neutro.
 */
export function colorDeCarril(pct: number, total: number): string | null {
  const base = colorPorPorcentaje(pct, total);
  return base === null ? null : `${base}2E`;
}
