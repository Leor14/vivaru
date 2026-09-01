/**
 * Catálogo de campos destino de la importación tabular.
 *
 * **POR QUÉ EXISTE, y es el punto entero de `PRD-V-FEAT-002`.** Hasta el 14 de
 * agosto de 2026 este catálogo existía, pero implícito y **duplicado**: cada
 * asistente de importación llevaba su propia función `getField(raw, ...alias)`
 * con una lista fija distinta. Dos espejos de la misma idea que había que
 * mantener iguales a mano — el mismo problema que el catálogo de banderas, que
 * vive en tres sitios y obliga a cambiarlos a la vez.
 *
 * Y ya colisionaban: **`tipo` significaba «tipo de unidad» en uno y «rol de la
 * persona» en el otro.** Un catálogo compartido que heredara esa ambigüedad
 * nacería roto, así que **los alias van declarados por entidad** y nunca se
 * comparan entre entidades. Es la decisión de diseño de este archivo.
 *
 * **Tres cosas lo consumen, y por eso vive aquí y no dentro de un componente:**
 * las plantillas descargables, el paso de mapeo de columnas, y —cuando llegue—
 * el mapeo asistido de `PRD-VAI-FEAT-001`. Si se añade un cuarto consumidor,
 * sigue siendo un solo sitio que tocar.
 *
 * **Lo que este archivo NO hace:** no valida valores ni convierte tipos. Decidir
 * si «apartamento» es un `UnitType` válido es de quien parsea, porque depende de
 * enumeraciones que viven en el dominio. Aquí solo se resuelve **qué columna del
 * archivo alimenta qué campo**.
 */

export type ImportEntity = "unit" | "person";

export interface ImportField {
  /** Identificador estable. No se enseña a nadie; se usa en el mapeo. */
  key: string;
  entity: ImportEntity;
  /** Lo que lee la persona en el paso de mapeo y en la plantilla. */
  label: string;
  /**
   * Sin él la fila no se puede importar. `PRD-V-FEAT-002` §8, `RN-01`: un
   * obligatorio sin mapear impide avanzar a Revisión.
   */
  required: boolean;
  /**
   * Encabezados que sugieren este campo, **ya normalizados** (minúsculas, sin
   * acentos). Son la precarga del mapeo, nunca la única oportunidad: si el
   * archivo trae «Depto», la persona lo mapea a mano y el archivo entra igual.
   * Antes, un encabezado fuera de esta lista no tenía salida.
   */
  aliases: readonly string[];
  /** Valor de ejemplo para la plantilla descargable. */
  example: string;
  /**
   * Cuánto se espera que se repitan los valores de esta columna.
   *
   * **Es lo único que se puede juzgar de un campo de texto libre.** «Tipo» y
   * «estado» tienen un vocabulario cerrado y se reconocen por su contenido;
   * «nombre de la unidad» y «torre» aceptan cualquier cosa, así que mirar qué
   * dicen no sirve — pero **cuánto se repiten sí los distingue**: el
   * identificador de una unidad es casi siempre único, y la torre se repite en
   * decenas de unidades.
   *
   * Salió de un archivo real el 14 de agosto de 2026, donde «Nombre» quedó
   * apuntando a una columna que decía «Edificio A» tres veces y la revisión lo
   * dio por bueno: habrían entrado tres unidades con el mismo nombre.
   */
  cardinality?: "alta" | "baja";
  /**
   * Que la columna repita valores **no dice nada** de este campo, así que
   * `cardinality` solo sirve para SUGERIR y nunca para avisar.
   *
   * **`cardinality` hace dos trabajos a la vez y solo uno vale aquí.** Guía la
   * cuarta pasada del mapeo —la que rescata el texto libre— y además alimenta
   * los avisos de `mappingIssues`. En un campo que **señala a otra entidad** el
   * segundo trabajo es falso: la unidad de una persona la comparten los que
   * viven juntos, y un padrón viene **ordenado por unidad**, así que la muestra
   * de ocho filas puede caer entera dentro del mismo apartamento.
   *
   * Sin esto, declarar `cardinality: "alta"` en `person.unitLabel` **bloquea a
   * una familia**: tres personas de la 101 disparaban «repite el mismo valor en
   * todas las filas, así que no puede ser este dato», que para este campo es
   * simplemente falso. Medido el 1 de septiembre de 2026 al añadirla.
   */
  repeticionEsNormal?: boolean;
}

/**
 * Los alias son exactamente los que ya resolvían los dos asistentes antes de
 * centralizarlos. **No se añadió ni se quitó ninguno a propósito:** el objetivo
 * de este primer incremento es que el comportamiento observable no cambie
 * —`PRD-V-FEAT-002` §10, `CA-06`— y que lo único que cambie sea de dónde sale
 * la lista. Ampliarlos es otro incremento, con su propia comprobación.
 */
export const IMPORT_FIELDS: readonly ImportField[] = [
  // ── Unidades ──────────────────────────────────────────────────────────────
  {
    key: "unit.displayName",
    entity: "unit",
    label: "Nombre de la unidad",
    required: true,
    aliases: ["nombre", "name", "unidad", "unit", "displayname", "inmueble"],
    example: "T1-101",
    cardinality: "alta",
  },
  {
    key: "unit.tower",
    entity: "unit",
    label: "Torre o agrupación",
    required: false,
    // «bloque», «etapa», «manzana» y «edificio» son la misma idea con el nombre
    // de cada país, y aparecen en los padrones tal cual. Además de mapear mejor
    // una unidad, son lo que deja ver que la unidad de una PERSONA viene
    // partida en dos columnas — ver el aviso de `person.unitLabel`.
    // `escalera` entró el 1 de septiembre de 2026: es la palabra de Guayaquil
    // para un edificio sin torres, y **siempre agrupa** — al revés que
    // `interior`, que en Colombia es el bloque y en México el apartamento, y
    // por eso NO está aquí sino confiada a la detección por forma.
    aliases: ["torre", "tower", "bloque", "etapa", "manzana", "edificio", "escalera"],
    example: "T1",
    cardinality: "baja",
  },
  {
    key: "unit.type",
    entity: "unit",
    label: "Tipo de unidad",
    required: true,
    aliases: ["tipo", "type"],
    example: "apartment",
  },
  {
    key: "unit.status",
    entity: "unit",
    label: "Estado",
    required: true,
    aliases: ["estado", "status"],
    example: "active",
  },

  // ── Personas ──────────────────────────────────────────────────────────────
  {
    key: "person.fullName",
    entity: "person",
    label: "Nombre completo",
    required: true,
    aliases: ["nombre", "name", "fullname"],
    example: "Ana Pérez",
    cardinality: "alta",
  },
  {
    key: "person.email",
    entity: "person",
    label: "Correo electrónico",
    required: true,
    // «mail» a secas es lo que escriben media México y medio Chile. Estaba
    // saliendo bien **por suerte**: la pasada de variedad lo rescataba por ser
    // la primera columna única del archivo, y ese mismo empate elegía el RUT en
    // un padrón chileno. Un nombre se resuelve nombrándolo, no con estadística.
    aliases: ["email", "correo", "e-mail", "mail"],
    example: "ana@correo.com",
    cardinality: "alta",
  },
  {
    key: "person.phone",
    entity: "person",
    label: "Teléfono",
    required: false,
    aliases: ["telefono", "celular", "phone", "tel"],
    example: "3001234567",
  },
  {
    key: "person.documentNumber",
    entity: "person",
    label: "Documento",
    required: false,
    aliases: ["documento", "cedula", "documentnumber", "id"],
    example: "12345678",
  },
  {
    key: "person.unitLabel",
    entity: "person",
    label: "Unidad",
    required: true,
    aliases: ["unidad", "unit", "apartamento", "depto", "dpto", "departamento", "apto", "inmueble"],
    example: "T1-101",
    cardinality: "alta",
    repeticionEsNormal: true,
  },
  {
    key: "person.role",
    entity: "person",
    // La etiqueta dice «rol» y no «tipo» a propósito: es la palabra que
    // colisionaba con el tipo de unidad, y lo que ve la persona no debería
    // heredar esa ambigüedad aunque el alias siga aceptándose.
    label: "Rol",
    required: true,
    aliases: ["rol", "role", "tipo"],
    example: "propietario",
  },
];

/**
 * Minúsculas, sin acentos y sin espacios en los bordes.
 *
 * Estaba duplicada en los dos asistentes con el mismo cuerpo. Se comparte
 * porque el mapeo y la precarga tienen que normalizar **igual**: si un lado
 * quita acentos y el otro no, «Teléfono» se sugiere en una pantalla y no en la
 * otra, y el fallo se lee como «a veces funciona».
 */
export function normalizeHeader(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** Los campos de una entidad, en el orden en que se enseñan. */
export function fieldsFor(entity: ImportEntity): readonly ImportField[] {
  return IMPORT_FIELDS.filter((field) => field.entity === entity);
}

export function requiredFieldsFor(entity: ImportEntity): readonly ImportField[] {
  return fieldsFor(entity).filter((field) => field.required);
}

/**
 * Mapeo sugerido: para cada campo destino, qué encabezado del archivo lo
 * alimenta. `null` significa «no se supo, decídelo tú» — y esa es la diferencia
 * con el comportamiento anterior, donde «no se supo» era un campo vacío y una
 * fila con error sin explicación.
 *
 * **Un encabezado no se asigna dos veces.** `RN-02`: dos columnas al mismo campo
 * destino es ambigüedad, y aquí se resuelve por orden de declaración del
 * catálogo, que es estable. La persona puede corregirlo después.
 */
/**
 * Valores que un campo acepta, ya normalizados. Los ponen los asistentes desde
 * sus propias tablas de alias (`TYPE_ALIASES`, `ROLE_ALIASES`…), **no se
 * declaran aquí**: duplicar esa lista sería crear el segundo espejo que este
 * archivo existe para evitar.
 */
export type AcceptedValues = Record<string, readonly string[]>;

const MUESTRA = 8;

function muestraDe(rows: readonly Record<string, string>[], header: string): string[] {
  const out: string[] = [];
  for (const row of rows) {
    const v = (row[header] ?? "").trim();
    if (v) out.push(normalizeHeader(v));
    if (out.length === MUESTRA) break;
  }
  return out;
}

/**
 * Proporción de valores distintos en la columna. 1 = todos distintos, y cerca
 * de 0 = uno repetido. Es lo que separa un identificador de una agrupación sin
 * entender ni una palabra de lo que dicen.
 */
function variedad(rows: readonly Record<string, string>[], header: string): number | null {
  const muestra = muestraDe(rows, header);
  if (muestra.length < 2) return null;
  return new Set(muestra).size / muestra.length;
}

/** Proporción de la muestra que el campo acepta. Sin muestra, `null`. */
function encaje(
  rows: readonly Record<string, string>[],
  header: string,
  aceptados: readonly string[],
): number | null {
  const muestra = muestraDe(rows, header);
  if (muestra.length === 0) return null;
  return muestra.filter((v) => aceptados.includes(v)).length / muestra.length;
}

/**
 * Mapeo sugerido: para cada campo destino, qué encabezado del archivo lo
 * alimenta. `null` significa «no se supo, decídelo tú».
 *
 * **Tres pasadas, de más fiable a menos, y ese orden es el diseño:**
 *
 * 1. **Nombre exacto.** «torre» es la torre y no hay más que hablar.
 * 2. **Contenido**, solo en campos de valores cerrados. Una columna cuyos
 *    valores son `activo, activo` **es** el estado, se llame «Situación» o como
 *    se llame. Es la pasada que rescata los archivos de verdad, donde los
 *    encabezados no se parecen a los nuestros.
 * 3. **Nombre por contención.** «Correo electrónico» contiene «correo»;
 *    «NOMBRE DEL PROPIETARIO» contiene «nombre». Va la última porque es la que
 *    más se puede equivocar, y gana el alias más largo que encaje.
 *
 * **Por qué existen las pasadas 2 y 3:** con solo la primera, un archivo real
 * llegaba al paso de columnas con seis desplegables vacíos, y eso no es revisar
 * un mapeo: es un examen. Medido con dos archivos reales el 14 de agosto de
 * 2026, donde solo se reconoció «Celular».
 *
 * **Un encabezado no se asigna dos veces** (`RN-02`).
 */
export function suggestMapping(
  headers: readonly string[],
  entity: ImportEntity,
  opts?: { rows?: readonly Record<string, string>[]; accepted?: AcceptedValues },
): Record<string, string | null> {
  const normalizados = headers.map((h) => ({ original: h, key: normalizeHeader(h) }));
  const taken = new Set<string>();
  const mapping: Record<string, string | null> = {};
  const campos = fieldsFor(entity);
  for (const field of campos) mapping[field.key] = null;

  // 1 · nombre exacto
  for (const field of campos) {
    const hit = normalizados.find((h) => !taken.has(h.original) && field.aliases.includes(h.key));
    if (hit) {
      mapping[field.key] = hit.original;
      taken.add(hit.original);
    }
  }

  // 2 · contenido, solo donde el campo tiene un vocabulario cerrado
  const rows = opts?.rows ?? [];
  const accepted = opts?.accepted ?? {};
  if (rows.length > 0) {
    for (const field of campos) {
      if (mapping[field.key]) continue;
      const aceptados = accepted[field.key];
      if (!aceptados || aceptados.length === 0) continue;

      let mejor: { original: string; ratio: number } | null = null;
      for (const h of normalizados) {
        if (taken.has(h.original)) continue;
        const ratio = encaje(rows, h.original, aceptados);
        // Se exige mayoría clara: media columna que encaja es una casualidad.
        if (ratio !== null && ratio >= 0.8 && (!mejor || ratio > mejor.ratio)) {
          mejor = { original: h.original, ratio };
        }
      }
      if (mejor) {
        mapping[field.key] = mejor.original;
        taken.add(mejor.original);
      }
    }
  }

  // 3 · contención, con el alias más largo ganando
  for (const field of campos) {
    if (mapping[field.key]) continue;
    let mejor: { original: string; largo: number } | null = null;
    for (const h of normalizados) {
      if (taken.has(h.original)) continue;
      for (const alias of field.aliases) {
        // Se exige un alias de 4+ para no casar «id» dentro de «unidad».
        if (alias.length >= 4 && h.key.includes(alias) && (!mejor || alias.length > mejor.largo)) {
          mejor = { original: h.original, largo: alias.length };
        }
      }
    }
    if (mejor) {
      mapping[field.key] = mejor.original;
      taken.add(mejor.original);
    }
  }

  // 4 · variedad, el último recurso para el texto libre que nadie resolvió.
  // **Va DESPUÉS de la contención y eso no es un detalle:** puesta antes se
  // llevaba «No. Depto» al nombre de la persona solo porque no repetía
  // valores, y dejaba sin unidad un archivo que el nombre resolvía bien. La
  // evidencia del encabezado, aunque sea difusa, manda sobre la estadística.
  if (rows.length > 1) {
    for (const field of campos) {
      if (mapping[field.key] || !field.cardinality) continue;

      const candidatas: { original: string; ratio: number }[] = [];
      for (const h of normalizados) {
        if (taken.has(h.original)) continue;
        const ratio = variedad(rows, h.original);
        if (ratio === null) continue;
        if (field.cardinality === "alta" ? ratio >= 0.9 : ratio <= 0.5) {
          candidatas.push({ original: h.original, ratio });
        }
      }
      if (candidatas.length === 0) continue;

      const mejorRatio =
        field.cardinality === "alta"
          ? Math.max(...candidatas.map((c) => c.ratio))
          : Math.min(...candidatas.map((c) => c.ratio));
      const empatadas = candidatas.filter((c) => c.ratio === mejorRatio);

      // **EN EMPATE NO SE ADIVINA, y esto es lo que la pasada hacía mal.**
      // Se quedaba con la primera del archivo, así que **el orden de las
      // columnas decidía el mapeo**: medido el 1 de septiembre de 2026 con 36
      // archivos construidos, un mismo padrón bautizaba las unidades con el
      // nombre del dueño o con su cédula según cuál columna fuera antes, y
      // ninguna de las dos versiones avisaba de nada. En un padrón, el nombre,
      // el correo, el teléfono, la cédula y el número de casa **son todos
      // únicos**, así que el empate no es raro: es lo normal.
      //
      // Un empate significa que no hay evidencia para preferir una, y sin
      // evidencia el campo se queda sin mapear — que es lo que la persona ve y
      // puede corregir. `RN-07`: el mapeo por alias es sugerencia, y una
      // sugerencia sin fundamento es peor que ninguna.
      if (empatadas.length > 1) continue;

      mapping[field.key] = empatadas[0].original;
      taken.add(empatadas[0].original);
    }
  }

  return mapping;
}

/**
 * Cómo llama un archivo a una agrupación. **Sale del catálogo y no de una lista
 * nueva**: escribirla aparte sería el segundo espejo que este fichero existe
 * para evitar.
 */
const ALIAS_DE_AGRUPACION: readonly string[] =
  IMPORT_FIELDS.find((field) => field.key === "unit.tower")?.aliases ?? [];

/**
 * Cuántos grupos distintos puede tener una columna para seguir pareciendo una
 * agrupación. Un conjunto tiene dos o tres torres, no ochenta.
 */
const MAX_GRUPOS = 12;

/**
 * ¿Esta columna se COMPORTA como una agrupación, sin mirar cómo se llama?
 *
 * Pocos valores distintos y muy repetidos. Es lo que separa una torre de un
 * apellido **sin entender ninguna de las dos palabras**: en un padrón de 200
 * filas, las torres son tres y los apellidos ciento y pico.
 *
 * El tope absoluto hace el trabajo que la proporción sola no puede: en un
 * edificio con familias, la columna de apellidos ronda el 0,5 de variedad y
 * pasaría el filtro proporcional — pero son cien apellidos, no doce.
 */
function pareceAgrupacion(rows: readonly Record<string, string>[], header: string): boolean {
  const distintos = new Set<string>();
  let conValor = 0;
  for (const row of rows) {
    const v = normalizeHeader(row[header] ?? "");
    if (!v) continue;
    conValor += 1;
    distintos.add(v);
    if (distintos.size > MAX_GRUPOS) return false;
  }
  // Una columna constante no agrupa nada: no distingue dos unidades.
  if (conValor < 2 || distintos.size < 2) return false;
  // **La proporción se probó a quitar y hubo que reponerla.** Con solo el tope
  // de 12 el corpus no cambiaba —36 archivos, un único caso distinto— y parecía
  // que no protegía de nada; construir el caso que al corpus le faltaba lo
  // desmintió: un edificio con FAMILIAS y una columna de apellidos sin usar
  // —cuatro apellidos en seis filas— pasaba el tope y disparaba un aviso de
  // «unidad partida» que era falso. La ausencia en el corpus no era evidencia.
  return distintos.size / conValor <= 0.5;
}

/**
 * La columna sin usar que podría ser la otra mitad de la unidad.
 *
 * **Devuelve además CÓMO se reconoció, y de eso depende la respuesta.** Hasta el
 * 1 de septiembre de 2026 esto solo miraba la lista de alias de `unit.tower`, y
 * medido con 36 archivos construidos resultó que **la protección dependía de la
 * palabra y no del problema**: el mismo archivo bloqueaba con «Torre» y entraba
 * con «Interior» —Bogotá— o «Escalera» —Guayaquil—, fundiendo apartamentos en
 * silencio.
 *
 * Ahora hay dos caminos y no se mezclan: si el nombre lo dice, hay certeza; si
 * solo lo dice la forma, hay sospecha. **Y una sospecha no bloquea un archivo.**
 *
 * **Por qué `interior` NO se añadió a los alias de torre**, que sería lo obvio:
 * en Colombia es el bloque y en México es el apartamento —«#45 Interior 302»—.
 * La misma palabra es la agrupación en un país y la unidad en otro, así que
 * ponerla en la lista rompería México para arreglar Bogotá. **La forma sí lo
 * distingue**: tres valores repetidos en cuarenta filas es una agrupación, y uno
 * distinto por fila es la unidad.
 */
function candidataDeAgrupacion(
  rows: readonly Record<string, string>[],
  mapping: Record<string, string | null>,
): { header: string; porNombre: boolean } | null {
  const usados = new Set(Object.values(mapping).filter((h): h is string => Boolean(h)));
  const libres = Object.keys(rows[0] ?? {}).filter((h) => !usados.has(h));

  for (const header of libres) {
    const key = normalizeHeader(header);
    if (ALIAS_DE_AGRUPACION.some((alias) => key === alias || key.includes(alias))) {
      return { header, porNombre: true };
    }
  }
  for (const header of libres) {
    if (pareceAgrupacion(rows, header)) return { header, porNombre: false };
  }
  return null;
}

/**
 * ¿Hay dos filas con la MISMA etiqueta de unidad en agrupaciones distintas?
 *
 * Es la fusión, detectada y no sospechada: si el archivo trae `Torre 1 · 101` y
 * `Torre 2 · 101`, importar solo «101» mete a las dos personas en la misma
 * unidad. **Se recorren todas las filas y no la muestra de ocho**, porque un
 * padrón viene ordenado por torre y las ocho primeras caen dentro de la misma.
 */
function unidadesQueSeFunden(
  rows: readonly Record<string, string>[],
  headerUnidad: string,
  headerAgrupacion: string,
): boolean {
  const agrupacionDe = new Map<string, string>();
  for (const row of rows) {
    const etiqueta = normalizeHeader(row[headerUnidad] ?? "");
    const grupo = normalizeHeader(row[headerAgrupacion] ?? "");
    if (!etiqueta || !grupo) continue;
    const visto = agrupacionDe.get(etiqueta);
    if (visto === undefined) agrupacionDe.set(etiqueta, grupo);
    else if (visto !== grupo) return true;
  }
  return false;
}

/**
 * ¿El NOMBRE del encabezado dice algo a favor de este campo?
 *
 * Replica las pasadas 1 y 3 de `suggestMapping` para un solo par. No se
 * comparte código con ellas a propósito: allí el bucle va por campos buscando
 * columna libre, y aquí la pregunta es al revés y sobre un par ya decidido.
 */
function hayEvidenciaDeNombre(header: string, field: ImportField): boolean {
  const key = normalizeHeader(header);
  if (field.aliases.includes(key)) return true;
  return field.aliases.some((alias) => alias.length >= 4 && key.includes(alias));
}

export type NivelAviso = "bloquea" | "duda";

export interface AvisoMapeo {
  nivel: NivelAviso;
  mensaje: string;
}

/**
 * Avisos sobre un mapeo, **antes** de continuar.
 *
 * **Por qué existe.** El 14 de agosto un archivo real pasó el paso de columnas
 * con «Estado» apuntando a una columna que decía `apartamento, apartamento,
 * casa` — con la muestra a la vista— y el error solo apareció tres pantallas
 * después, como «Estado inválido». El sistema lo sabía desde el principio y lo
 * dijo tarde, culpando al archivo.
 *
 * **Bloquea solo cuando NINGÚN valor encaja**, que es cuando la columna es
 * inequívocamente otra cosa. Si encaja parte, se avisa y se deja seguir: un
 * archivo con algunas filas malas es un problema de filas, no de mapeo, y para
 * eso ya está el paso de revisión.
 */
export function mappingIssues(
  rows: readonly Record<string, string>[],
  entity: ImportEntity,
  mapping: Record<string, string | null>,
  accepted: AcceptedValues,
): Record<string, AvisoMapeo | undefined> {
  const avisos: Record<string, AvisoMapeo | undefined> = {};
  if (rows.length === 0) return avisos;

  for (const field of fieldsFor(entity)) {
    const header = mapping[field.key];
    if (!header) continue;

    // La unidad de una persona partida en DOS columnas. El catálogo mapea
    // «Apto» y **pierde «Torre» sin decir nada**, y cuando dos torres repiten
    // número de apartamento las dos unidades entran como una sola. Es propio de
    // `person`: una unidad sí tiene dónde guardar su torre, una persona no.
    if (field.key === "person.unitLabel") {
      const candidata = candidataDeAgrupacion(rows, mapping);
      if (candidata && unidadesQueSeFunden(rows, header, candidata.header)) {
        // **La respuesta se gradúa con la certeza, y esa es la decisión.** Si la
        // columna se llama como una agrupación, la fusión está probada y parar
        // es lo correcto. Si solo lo parece por su forma, la sospecha es fuerte
        // pero no es certeza — y un bloqueo equivocado deja a alguien sin
        // salida delante de un archivo que está bien.
        avisos[field.key] = candidata.porNombre
          ? {
              nivel: "bloquea",
              mensaje: `La unidad viene partida en dos columnas: «${candidata.header}» quedó sin usar y «${header}» repite el mismo valor en agrupaciones distintas, así que unidades diferentes entrarían como una sola. Únelas en una columna del archivo antes de importar.`,
            }
          : {
              nivel: "duda",
              mensaje: `«${candidata.header}» quedó sin usar y sus valores se repiten como los de una agrupación, y hay unidades con la misma etiqueta en grupos distintos. Puede que la unidad venga partida en dos columnas: si es así, «${header}» sola no las distingue y entrarían como una. Compruébalo.`,
            };
        continue;
      }
    }

    // Texto libre: lo único juzgable es cuánto se repite —salvo donde repetirse
    // es normal, que ahí no dice nada. Ver `repeticionEsNormal`.
    if (field.cardinality && !field.repeticionEsNormal) {
      const ratio = variedad(rows, header);
      const distintos = new Set(muestraDe(rows, header)).size;
      if (ratio !== null) {
        if (field.cardinality === "alta" && distintos === 1) {
          avisos[field.key] = {
            nivel: "bloquea",
            mensaje: `«${header}» repite el mismo valor en todas las filas, así que no puede ser este dato: entrarían filas idénticas.`,
          };
          continue;
        }
        if (field.cardinality === "baja" && ratio === 1) {
          avisos[field.key] = {
            nivel: "duda",
            mensaje: `«${header}» no repite ningún valor. Si de verdad cada unidad está en su propia agrupación está bien; si no, revisa la columna.`,
          };
          continue;
        }
      }
    }

    const aceptados = accepted[field.key];
    if (!aceptados || aceptados.length === 0) continue;

    const ratio = encaje(rows, header, aceptados);
    if (ratio === null) continue;

    if (ratio === 0) {
      const ejemplo = muestraDe(rows, header)[0] ?? "";
      avisos[field.key] = {
        nivel: "bloquea",
        mensaje: `«${header}» no parece este dato: dice «${ejemplo}», que no es un valor válido aquí.`,
      };
    } else if (ratio < 0.8) {
      avisos[field.key] = {
        nivel: "duda",
        mensaje: `Algunos valores de «${header}» no son válidos aquí; las filas afectadas saldrán marcadas en la revisión.`,
      };
    }
  }

  // **Y una segunda pasada: decir cuándo la columna se eligió SIN evidencia.**
  //
  // La cuarta pasada del mapeo rescata texto libre mirando solo si los valores
  // se repiten, y **su resultado era indistinguible de un acierto por nombre**.
  // Medido el 1 de septiembre de 2026 con 36 archivos: un padrón sin columna de
  // correo salía «entra limpio» con el correo apuntando a la columna de nombres,
  // el nombre a la del número de casa y la unidad a un teléfono fijo. Cero
  // avisos, porque ninguna de aquellas columnas repetía un valor.
  //
  // Esto no bloquea —puede estar bien, y a veces lo está— pero **deja de
  // callarse**. Vale igual para lo que eligió la persona a mano: si la columna
  // no se parece a este campo ni por nombre ni por contenido, decirlo es
  // exacto, lo haya decidido quien lo haya decidido.
  for (const field of fieldsFor(entity)) {
    const header = mapping[field.key];
    if (!header || avisos[field.key]) continue;
    // **Un campo de vocabulario cerrado ya lo juzgó el bloque de arriba**, que
    // mira lo que DICE la columna: si no encajaba nada bloqueó, si encajaba a
    // medias avisó, y si llegó hasta aquí sin aviso es porque encaja. Repetir
    // esa comprobación era un ayudante que ninguna falsación podía distinguir.
    if (accepted[field.key]?.length) continue;
    if (hayEvidenciaDeNombre(header, field)) continue;

    avisos[field.key] = {
      nivel: "duda",
      mensaje: `«${header}» no se parece a este campo ni por su nombre ni por lo que dice: está aquí solo porque sus valores no se repiten, que es la pista más débil que hay. Compruébalo antes de seguir.`,
    };
  }

  return avisos;
}

export function hayBloqueantes(avisos: Record<string, AvisoMapeo | undefined>): boolean {
  return Object.values(avisos).some((a) => a?.nivel === "bloquea");
}

/**
 * Lee el valor de un campo destino en una fila, según el mapeo.
 *
 * Sustituye al `getField(raw, ...alias)` que cada asistente tenía: aquel
 * buscaba alias en cada fila, este ya sabe qué columna es porque se decidió una
 * vez, arriba.
 */
export function valueFor(
  row: Record<string, string>,
  mapping: Record<string, string | null>,
  fieldKey: string,
): string {
  const header = mapping[fieldKey];
  if (!header) return "";
  return (row[header] ?? "").trim();
}

/** Los campos obligatorios que el mapeo todavía no resuelve. `RN-01`. */
export function missingRequired(
  mapping: Record<string, string | null>,
  entity: ImportEntity,
): readonly ImportField[] {
  return requiredFieldsFor(entity).filter((field) => !mapping[field.key]);
}

/**
 * De todas las hojas del libro, la que mejor encaja con lo que se está
 * importando.
 *
 * **POR QUÉ EXISTE.** Se abría siempre la primera, y en un libro real la
 * primera fue «Saldos» — una hoja que no tiene ni tipo ni estado, así que el
 * paso de columnas se abría a medias y con dos obligatorios en rojo. **Nadie
 * debería tener que saber cuál de tres hojas es la buena**, y el sistema puede
 * averiguarlo: probar el mapeo en todas y quedarse con la que resuelve más
 * campos obligatorios.
 *
 * En empate gana la primera del libro, que es el orden en que las puso quien
 * hizo el archivo y por tanto la mejor pista que queda.
 *
 * El selector de hoja **no desaparece**: esto acierta casi siempre, no siempre.
 */
export function pickBestSheet(
  sheets: readonly {
    name: string;
    headers: readonly string[];
    rows: readonly Record<string, string>[];
  }[],
  entity: ImportEntity,
  accepted?: AcceptedValues,
): string {
  if (sheets.length === 0) return "";

  let mejor = { name: sheets[0].name, faltan: Number.POSITIVE_INFINITY };
  for (const sheet of sheets) {
    const mapping = suggestMapping(sheet.headers, entity, { rows: sheet.rows, accepted });
    const faltan = missingRequired(mapping, entity).length;
    if (faltan < mejor.faltan) mejor = { name: sheet.name, faltan };
  }
  return mejor.name;
}

/**
 * Resumen de un mapeo, para la telemetría de `PRD-V-FEAT-002` (`CA-13`).
 *
 * Se calcula aquí y no en cada asistente porque los dos necesitan lo mismo y
 * porque **`encabezadosSinUsar` es el dato que después alimenta el mapeo
 * asistido**: la lista de columnas que el catálogo no supo reconocer es,
 * literalmente, su trabajo pendiente.
 *
 * `camposAMano` sale de comparar el mapeo final con el que se sugirió solo: es
 * la medida de cuánto trabajo le costó a la persona lo que el catálogo no
 * resolvió.
 */
export function summarizeMapping(
  headers: readonly string[],
  entity: ImportEntity,
  mapping: Record<string, string | null>,
): { camposPorAlias: number; camposAMano: number; encabezadosSinUsar: string[] } {
  const sugerido = suggestMapping(headers, entity);
  let camposPorAlias = 0;
  let camposAMano = 0;

  for (const field of fieldsFor(entity)) {
    const elegido = mapping[field.key];
    if (!elegido) continue;
    if (sugerido[field.key] === elegido) camposPorAlias += 1;
    else camposAMano += 1;
  }

  const usados = new Set(Object.values(mapping).filter((h): h is string => Boolean(h)));
  return {
    camposPorAlias,
    camposAMano,
    encabezadosSinUsar: headers.filter((h) => !usados.has(h)),
  };
}

/**
 * Cuántos valores distintos puede tener una columna para seguir pareciendo un
 * vocabulario, y qué proporción de las filas. Ver `formaDelArchivo`.
 */
const MAX_VALORES_DE_VOCABULARIO = 12;
const MAX_VARIEDAD_DE_VOCABULARIO = 0.5;
const MIN_FILAS_PARA_VOCABULARIO = 4;
const MAX_LARGO_DE_VALOR = 40;

/**
 * La FORMA del archivo, para la telemetría — nunca su contenido.
 *
 * **POR QUÉ EXISTE.** La ficha de `AI-ONB-001` no se puede escribir sin corpus,
 * y guardar copia de los archivos del cliente **contradice la decisión de
 * `PRD-V-FEAT-002` §7**, que es la razón de que el importador viva entero en el
 * navegador. Decisión de David el 1 de septiembre de 2026: se guarda la forma y
 * no el archivo. Esto es esa forma, junto a `encabezadosSinUsar`, que ya se
 * guardaba y es la lista de columnas que el catálogo no supo reconocer.
 *
 * **`valoresNoReconocidos` es la parte delicada, y por eso lleva puerta.** Sirve
 * para saber qué palabras usa la gente de verdad donde nosotros tenemos un
 * vocabulario cerrado —`parqueadero` y `bodega` costaron una decisión de
 * producto tomada a ciegas, sobre una sonda inventada—. Pero si el mapeo está
 * MAL, el campo de rol puede apuntar a una columna de nombres, y entonces
 * guardar «los valores que no reconozco» sería guardar los nombres de personas
 * reales. La puerta es que la columna se comporte como un vocabulario: pocos
 * valores distintos, repetidos entre las filas. Una columna de nombres tiene
 * tantos valores como filas y **no pasa nunca**.
 *
 * Se prefiere perder señal a capturar de más: un archivo corto no aporta
 * ninguna, y ahí no se mira.
 */
export function formaDelArchivo(
  rows: readonly Record<string, string>[],
  entity: ImportEntity,
  mapping: Record<string, string | null>,
  accepted: AcceptedValues,
): { valoresNoReconocidos: string[]; unidadPartida: boolean } {
  const valores: string[] = [];

  if (rows.length >= MIN_FILAS_PARA_VOCABULARIO) {
    for (const field of fieldsFor(entity)) {
      const header = mapping[field.key];
      const aceptados = accepted[field.key];
      if (!header || !aceptados || aceptados.length === 0) continue;

      const distintos = new Set<string>();
      for (const row of rows) {
        const v = normalizeHeader(row[header] ?? "");
        if (v) distintos.add(v);
        // Se corta en cuanto deja de parecer un vocabulario: sin esto, una
        // columna de nombres se recorrería entera para acabar descartándola.
        if (distintos.size > MAX_VALORES_DE_VOCABULARIO) break;
      }
      if (distintos.size === 0 || distintos.size > MAX_VALORES_DE_VOCABULARIO) continue;
      if (distintos.size / rows.length > MAX_VARIEDAD_DE_VOCABULARIO) continue;

      for (const v of distintos) {
        if (!aceptados.includes(v)) valores.push(v.slice(0, MAX_LARGO_DE_VALOR));
      }
    }
  }

  // La unidad de la persona repartida en dos columnas. Se mide más ancho que el
  // aviso que bloquea —aquel exige que dos unidades se FUNDAN—, porque para
  // saber cuántos archivos vienen así da igual si además colisionan.
  const etiqueta = mapping["person.unitLabel"];
  const unidadPartida =
    entity === "person" && Boolean(etiqueta) && candidataDeAgrupacion(rows, mapping) !== null;

  return { valoresNoReconocidos: [...new Set(valores)], unidadPartida };
}
