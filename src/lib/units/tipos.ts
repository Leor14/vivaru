/**
 * El vocabulario de tipos de unidad, en UN solo sitio.
 *
 * **POR QUÉ EXISTE.** Hasta el 1 de septiembre de 2026 los cuatro tipos vivían
 * escritos a mano en **siete** sitios —un `z.enum` que valida, una unión de
 * TypeScript que declara, dos listas de `<option>`, dos mapas de rótulos (uno
 * de ellos dentro del asistente de importación) y la tabla de alias del
 * importador— y **nada comprobaba que dijeran lo mismo**. Ya habían derivado:
 * el mapa de rótulos de la página conocía `parking`, `storage` y `commercial`
 * mientras el esquema los rechazaba, así que el lado que PINTA se había
 * adelantado al que VALIDA y nadie lo notaba. Es la misma forma del catálogo de
 * banderas, que vive en cinco sitios y ha mordido dos veces.
 *
 * Ahora el `z.enum`, la unión, los desplegables, los rótulos y los alias con
 * que un archivo nombra cada tipo salen de aquí, y `Record<UnitType, …>` obliga
 * al compilador a exigir el rótulo de cualquier tipo nuevo.
 *
 * **Los alias de VALOR también viven aquí, y no en el asistente.** No son lo
 * mismo que los de `field-catalog.ts`: aquellos dicen qué COLUMNA alimenta un
 * campo, y estos qué escribe una CELDA para significar un tipo. Estaban dentro
 * del componente, así que ninguna prueba podía alcanzarlos sin arrastrar React,
 * y la sonda y el banco llevaban cada uno su copia a mano — tres listas que
 * había que mantener iguales para vigilar precisamente eso.
 *
 * **`parking` y `storage` entraron el 1 de septiembre de 2026, decisión de
 * David.** Un conjunto real tiene parqueaderos y bodegas como unidades con
 * dueño y coeficiente, y sin ellos el importador no marcaba esas filas:
 * **bloqueaba el archivo entero**. Con ellos, el padrón, la lista de
 * coeficientes y Cartera cuentan también esas unidades — que es la consecuencia
 * de fondo, y no el rótulo.
 */

/** El orden es el que se enseña en los desplegables. «Otro» va al final. */
export const TIPOS_DE_UNIDAD = [
  "apartment",
  "house",
  "office",
  "parking",
  "storage",
  "other",
] as const;

export type UnitType = (typeof TIPOS_DE_UNIDAD)[number];

/** Lo que lee la persona. El compilador exige uno por tipo. */
export const ETIQUETA_DE_TIPO: Record<UnitType, string> = {
  apartment: "Apartamento",
  house: "Casa",
  office: "Oficina",
  parking: "Parqueadero",
  storage: "Bodega",
  other: "Otro",
};

/**
 * Lo que puede decir una celda para significar cada tipo, ya normalizado
 * (minúsculas, sin acentos). Lo consume el asistente de importación, que se lo
 * pasa al catálogo de campos como «valores aceptados».
 *
 * `garaje` y `deposito` son los sinónimos que de verdad aparecen en los
 * padrones; `local` sigue resolviendo a oficina, que es lo que hacía antes.
 */
export const ALIAS_DE_TIPO: Record<string, UnitType> = {
  apartment: "apartment",
  apartamento: "apartment",
  apto: "apartment",
  house: "house",
  casa: "house",
  office: "office",
  oficina: "office",
  local: "office",
  // Un conjunto real los tiene como unidades, y hasta el 1 de septiembre de
  // 2026 estas dos palabras BLOQUEABAN el archivo entero, no solo sus filas.
  parking: "parking",
  parqueadero: "parking",
  garaje: "parking",
  storage: "storage",
  bodega: "storage",
  deposito: "storage",
  other: "other",
  otro: "other",
  otra: "other",
};

/**
 * Lo que se PINTA para un `type` guardado, incluso si el esquema ya no lo
 * aceptaría.
 *
 * **Vive aquí y no dentro de la página por la misma razón que los alias.**
 * Estaba declarado dentro del componente de residentes, así que ninguna prueba
 * podía alcanzarlo sin arrastrar React — y fue exactamente ahí donde el
 * vocabulario volvió a derivar: el mapa conocía `commercial` y `local`, que el
 * esquema RECHAZA, y además `local` se pintaba «Local comercial» mientras
 * `ALIAS_DE_TIPO` lo resuelve a `office`, que se pinta «Oficina». La misma
 * palabra tenía dos respuestas según entrara por un archivo o estuviera
 * guardada cruda.
 *
 * Las dos entradas se retiraron el 1 de septiembre de 2026 después de CONTAR:
 * cero unidades con `commercial` o `local` en producción (93 unidades) y en
 * staging (87). Ninguna las estaba usando.
 *
 * **Y desde entonces el mapa NO SE ESCRIBE: SE DERIVA.** Retirar dos entradas
 * arreglaba el caso y dejaba viva la causa —un mapa a mano al lado de un
 * catálogo—, que es la misma forma que ya mordió dos veces. Derivándolo de
 * `ALIAS_DE_TIPO`, una palabra no puede tener aquí una respuesta distinta de la
 * que tiene allí: no queda sitio donde escribirla. `commercial` desaparece
 * porque no es alias de nada, y `local` pasa a decir «Oficina», que es lo que
 * ya decía al importarla.
 *
 * El respaldo de abajo sigue cubriendo lo que no es ni tipo ni alias: sale con
 * la primera en mayúscula en vez de en blanco.
 */
const ROTULOS_TOLERADOS: Record<string, string> = {
  // Cada palabra que un archivo sabe leer se pinta con el rótulo del tipo al
  // que ESA MISMA tabla la resuelve. Así `local` dice «Oficina» venga como
  // venga, y `apto`, `garaje` y `deposito` dejan de degradar a «Apto»,
  // «Garaje» y «Deposito» teniendo un rótulo bueno a mano.
  ...Object.fromEntries(
    Object.entries(ALIAS_DE_TIPO).map(([palabra, tipo]) => [palabra, ETIQUETA_DE_TIPO[tipo]]),
  ),
  // Va DESPUÉS a propósito: el rótulo propio de un tipo manda sobre cualquier
  // alias que coincida con su nombre. Un tipo no puede quedar mal escrito en
  // pantalla por una fila torcida de la tabla de alias.
  ...ETIQUETA_DE_TIPO,
};

/** El rótulo de un `type` guardado, tolerante con lo que el esquema rechazaría. */
export function rotuloDeTipo(value: string | undefined | null): string {
  if (!value) return "-";
  const clave = value.trim().toLowerCase();
  if (ROTULOS_TOLERADOS[clave]) return ROTULOS_TOLERADOS[clave];
  return clave.charAt(0).toUpperCase() + clave.slice(1);
}

/** Solo para el banco: qué palabras conoce el mapa tolerante. */
export const PALABRAS_CON_ROTULO = Object.keys(ROTULOS_TOLERADOS);
