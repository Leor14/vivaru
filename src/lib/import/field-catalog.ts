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
  },
  {
    key: "unit.tower",
    entity: "unit",
    label: "Torre o agrupación",
    required: false,
    aliases: ["torre", "tower"],
    example: "T1",
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
  },
  {
    key: "person.email",
    entity: "person",
    label: "Correo electrónico",
    required: true,
    aliases: ["email", "correo", "e-mail"],
    example: "ana@correo.com",
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
    aliases: ["unidad", "unit", "apartamento"],
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
export function suggestMapping(
  headers: readonly string[],
  entity: ImportEntity,
): Record<string, string | null> {
  const normalized = headers.map((h) => ({ original: h, key: normalizeHeader(h) }));
  const taken = new Set<string>();
  const mapping: Record<string, string | null> = {};

  for (const field of fieldsFor(entity)) {
    const hit = normalized.find((h) => !taken.has(h.original) && field.aliases.includes(h.key));
    mapping[field.key] = hit?.original ?? null;
    if (hit) taken.add(hit.original);
  }

  return mapping;
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
