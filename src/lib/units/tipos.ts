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
