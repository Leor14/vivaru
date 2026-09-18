/**
 * **`L-20` — quién trajo el paquete y en qué estado llegó.**
 *
 * Lote «Análisis de la plataforma», pág. 8: «Debe incluir la fecha y condiciones en que se recibió el
 * paquete, fecha y hora en que se lo llevó el propietario. Que entidad lo deja también es importante».
 * De las cuatro, **las fechas y la entrega ya se guardaban** —`arrivedAt`, `deliveredAt`,
 * `deliveredToName`, medidos en los 223 paquetes de producción—; lo que no existía es **la empresa** y
 * **el estado de llegada**, y la entrega no se veía en la tabla del administrador.
 *
 * **La condición es vocabulario cerrado** y no texto libre: es lo que permite filtrarla y contarla el
 * día que haya volumen, y evita que «dañado», «Dañado» y «roto» sean tres cosas. La empresa sí es
 * libre: la lista de transportadoras cambia por ciudad y no hay catálogo que mantener.
 *
 * **Los 223 paquetes anteriores no traen ninguno de los dos**, así que todo aquí devuelve `null`
 * cuando falta y la pantalla escribe «—»: inventar un estado de llegada sería peor que no decirlo.
 */

export const CONDICIONES_DE_LLEGADA = [
  { clave: "bueno", etiqueta: "En buen estado" },
  { clave: "abierto", etiqueta: "Abierto o mal sellado" },
  { clave: "danado", etiqueta: "Dañado" },
  { clave: "mojado", etiqueta: "Mojado" },
] as const;

export type CondicionDeLlegada = (typeof CONDICIONES_DE_LLEGADA)[number]["clave"];

export function esCondicionDeLlegada(valor: unknown): valor is CondicionDeLlegada {
  return typeof valor === "string" && CONDICIONES_DE_LLEGADA.some((c) => c.clave === valor);
}

export function etiquetaDeCondicion(valor: unknown): string | null {
  if (!esCondicionDeLlegada(valor)) return null;
  return CONDICIONES_DE_LLEGADA.find((c) => c.clave === valor)?.etiqueta ?? null;
}

/**
 * La línea que lee el administrador: «Servientrega · Dañado», o solo una de las dos, o `null` si el
 * paquete es de los de antes.
 */
export function textoDeLlegada(paquete: { carrier?: unknown; condition?: unknown }): string | null {
  const empresa = typeof paquete.carrier === "string" ? paquete.carrier.trim() : "";
  const condicion = etiquetaDeCondicion(paquete.condition);
  if (empresa && condicion) return `${empresa} · ${condicion}`;
  return empresa || condicion || null;
}

/**
 * La entrega, que YA se guardaba (`deliveredAt`, `deliveredToName`) y **no se veía en la tabla del
 * administrador**: era la mitad de la pág. 8 que faltaba sin que faltara ningún dato. Recibe la fecha
 * ya formateada porque el formato lo decide la pantalla (`es-CO`, `formatDate`), no este módulo.
 */
export function textoDeEntrega(entrega: { fecha?: string | null; quien?: unknown }): string | null {
  const fecha = typeof entrega.fecha === "string" ? entrega.fecha.trim() : "";
  const quien = typeof entrega.quien === "string" ? entrega.quien.trim() : "";
  if (fecha && quien) return `${fecha} · a ${quien}`;
  if (fecha) return fecha;
  return quien ? `a ${quien}` : null;
}
