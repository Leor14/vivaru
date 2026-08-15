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
    aliases: ["nombre", "name", "unidad", "unit", "displayname"],
    example: "T1-101",
    cardinality: "alta",
  },
  {
    key: "unit.tower",
    entity: "unit",
    label: "Torre o agrupación",
    required: false,
    aliases: ["torre", "tower"],
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
    aliases: ["email", "correo", "e-mail"],
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
    aliases: ["unidad", "unit", "apartamento", "depto", "dpto", "departamento"],
    example: "T1-101",
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

      let mejor: { original: string; ratio: number } | null = null;
      for (const h of normalizados) {
        if (taken.has(h.original)) continue;
        const ratio = variedad(rows, h.original);
        if (ratio === null) continue;

        if (field.cardinality === "alta" && ratio >= 0.9) {
          if (!mejor || ratio > mejor.ratio) mejor = { original: h.original, ratio };
        } else if (field.cardinality === "baja" && ratio <= 0.5) {
          if (!mejor || ratio < mejor.ratio) mejor = { original: h.original, ratio };
        }
      }
      if (mejor) {
        mapping[field.key] = mejor.original;
        taken.add(mejor.original);
      }
    }
  }

  return mapping;
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

    // Texto libre: lo único juzgable es cuánto se repite.
    if (field.cardinality) {
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
