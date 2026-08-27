/**
 * **La pestaña activa, leída y escrita en la URL (pasada 3).**
 *
 * El admin tenía cuatro barras de pestañas hechas a mano —`billing`, `settings`,
 * `regulations`, `documents`— y **ninguna dejaba rastro**: no se podía enlazar
 * una pestaña, el botón «atrás» salía de la pantalla en vez de volver a la
 * anterior, y recargar devolvía siempre a la primera. `useSearchParams` no
 * aparecía en ninguna pantalla del portal.
 *
 * Esto es la parte pura —sin React y sin `window`— para poder probarla. El
 * enganche vive en `use-tab-param.ts`.
 *
 * **Aditivo por construcción:** una URL sin el parámetro devuelve el mismo valor
 * por defecto de hoy, así que cada pantalla se comporta exactamente igual que
 * antes mientras nadie escriba el parámetro.
 */

/**
 * La pestaña que dice la URL, o el valor por defecto.
 *
 * Un valor **desconocido se ignora en silencio** y cae al defecto: la URL la
 * escribe cualquiera —un enlace viejo, una pestaña que se renombró, alguien
 * tecleando— y una pantalla en blanco por un parámetro basura sería peor que
 * abrir por donde abre siempre.
 */
export function leerTab<K extends string>(
  search: string,
  param: string,
  keys: readonly K[],
  fallback: K,
): K {
  const valor = new URLSearchParams(search).get(param);
  return valor !== null && (keys as readonly string[]).includes(valor) ? (valor as K) : fallback;
}

/**
 * La cadena de consulta que corresponde a una pestaña, **conservando los demás
 * parámetros** — la URL puede llevar cosas que no son nuestras.
 *
 * Cuando la pestaña es la de por defecto, el parámetro **se borra** en vez de
 * escribirse: así la dirección canónica de cada pantalla sigue siendo la de
 * siempre y no aparecen dos URLs para la misma vista.
 */
export function escribirTab<K extends string>(
  search: string,
  param: string,
  valor: K,
  fallback: K,
): string {
  const params = new URLSearchParams(search);
  if (valor === fallback) params.delete(param);
  else params.set(param, valor);
  const texto = params.toString();
  return texto ? `?${texto}` : "";
}
