/**
 * **`L-07` — el dueño de varias unidades. Función pura y de lectura: no escribe nada.**
 *
 * Lote «Análisis de la plataforma», pág. 3: «Un propietario puede tener varias unidades (apto +
 * parqueadero + local). Debería poder verlas juntas».
 *
 * **El modelo del producto no tiene dueños: tiene registros de persona, y cada uno guarda UNA
 * unidad** (`PersonItem.unitId`). Así que un propietario de tres unidades ya está en el padrón
 * **tres veces**, y esta pantalla no inventa nada: solo junta lo que el dato ya dice.
 *
 * ⚠️ **Y de ahí sale el aviso que esta pantalla tiene que dar: el panel de duplicados propondrá
 * fusionar esos tres registros, y fusionarlos le quitaría al dueño dos unidades.** Por eso aquí
 * **no hay ninguna acción**: es una lista para mirar. Cuando el modelo tenga dueño de verdad, esto
 * se convierte en su pantalla; hasta entonces, avisar es lo único honesto.
 *
 * **Cómo se agrupa:** con documento, por documento; sin él, por nombre normalizado. Medido en
 * producción el 17 de septiembre de 2026: de **202 personas, solo 47 traen documento**, así que la
 * mayoría cae al nombre, y **dos homónimos de unidades distintas se verán como un dueño con dos
 * unidades**. Es exactamente por eso que la lista es de revisión y no de acción: en Santa María hubo
 * **siete** «David Carmona» que no eran la misma persona. Una persona con documento y su homónimo
 * sin documento caen en grupos distintos, a propósito.
 *
 * 🔴 **Y un documento que coincide NO basta: los nombres también tienen que coincidir.** La primera
 * versión suponía que el documento identifica a una persona, y **el único grupo que enseñó en
 * producción era falso**: «David Cancelo, 2 unidades» eran David Cancelo y **Luis Otero**, que
 * comparten el documento de relleno `65465465` —el mismo caso que `duplicados.ts` ya documentaba—.
 * Visto en pantalla el 17 sep 2026, con 17 pruebas en verde. Desde entonces, un documento con
 * nombres distintos **no es un dueño**: sale aparte, en `mismoDocumentoNombresDistintos`, como un
 * dato que revisar. El precio es que un dueño escrito de dos formas («María G.» y «María Gómez»)
 * también cae ahí y no como un solo dueño; es el lado bueno del error, porque la pantalla pasa a
 * decir «revisa esto» en vez de afirmar algo de una persona.
 */

import { normalizarTexto } from "./duplicados";

export type PersonaDelPadron = {
  id: string;
  fullName?: string | null;
  documentNumber?: string | null;
  /** Id del documento de la unidad. Sin unidad, la persona no entra. */
  unitId?: string | null;
  /** Etiqueta de la unidad, ya resuelta contra el catálogo del conjunto. */
  unitLabel?: string | null;
  /** Marca de fusión previa: un registro archivado no cuenta como unidad de nadie. */
  fusionadaEn?: unknown;
};

export type DuenoConVariasUnidades = {
  /** `documento:<valor>` o `nombre:<valor>`. Estable entre corridas. */
  clave: string;
  por: "documento" | "nombre";
  /** El nombre más largo del grupo: es el que suele venir completo. */
  nombre: string;
  /** Un registro por unidad, con el id de la persona para poder abrirlo. */
  registros: { personaId: string; unidad: string }[];
};

type Entrada = { personaId: string; unidad: string };
type Grupo = {
  por: "documento" | "nombre";
  valor: string;
  nombres: string[];
  /** Los nombres ya normalizados: si hay más de uno, el documento no es de UNA persona. */
  nombresNormalizados: Set<string>;
  porUnidad: Map<string, Entrada>;
};

/**
 * Agrupa y se queda con los grupos de **dos unidades distintas o más**. Dos registros de la misma
 * persona en la MISMA unidad no son esto —son un duplicado, y de eso se ocupa `duplicados.ts`—, así
 * que cuentan como una.
 */
function agruparPorUnidades(personas: readonly PersonaDelPadron[]): Map<string, Grupo> {
  const grupos = new Map<string, Grupo>();

  for (const persona of personas) {
    if (persona.fusionadaEn) continue;
    const unidadId = String(persona.unitId ?? "").trim();
    if (!unidadId) continue;

    const documento = normalizarTexto(persona.documentNumber);
    const nombre = normalizarTexto(persona.fullName);
    const por: "documento" | "nombre" = documento ? "documento" : "nombre";
    const valor = documento || nombre;
    if (!valor) continue;

    const clave = `${por}:${valor}`;
    const grupo =
      grupos.get(clave) ??
      { por, valor, nombres: [], nombresNormalizados: new Set<string>(), porUnidad: new Map<string, Entrada>() };
    if (nombre) grupo.nombresNormalizados.add(nombre);
    const etiqueta = String(persona.unitLabel ?? "").trim() || unidadId;
    // La primera aparición de una unidad se queda: dos registros en la misma unidad son una unidad.
    if (!grupo.porUnidad.has(unidadId)) grupo.porUnidad.set(unidadId, { personaId: persona.id, unidad: etiqueta });
    const nombreCrudo = String(persona.fullName ?? "").trim();
    if (nombreCrudo) grupo.nombres.push(nombreCrudo);
    grupos.set(clave, grupo);
  }

  for (const [clave, grupo] of grupos) {
    if (grupo.porUnidad.size < 2) grupos.delete(clave);
  }
  return grupos;
}

function registrosOrdenados(grupo: Grupo): Entrada[] {
  return Array.from(grupo.porUnidad.values()).sort((a, b) =>
    a.unidad.localeCompare(b.unidad, "es-CO", { numeric: true }),
  );
}

/**
 * Los dueños con **dos unidades distintas o más**, de más unidades a menos y luego por nombre. Un
 * grupo por documento solo entra si **todos sus nombres coinciden** normalizados; los demás van a
 * `mismoDocumentoNombresDistintos`.
 */
export function duenosConVariasUnidades(
  personas: readonly PersonaDelPadron[],
): DuenoConVariasUnidades[] {
  const resultado: DuenoConVariasUnidades[] = [];
  for (const [clave, grupo] of agruparPorUnidades(personas)) {
    if (grupo.nombresNormalizados.size > 1) continue;
    const nombre = grupo.nombres.reduce((mejor, actual) => (actual.length > mejor.length ? actual : mejor), "");
    resultado.push({ clave, por: grupo.por, nombre: nombre || "Sin nombre", registros: registrosOrdenados(grupo) });
  }

  return resultado.sort(
    (a, b) => b.registros.length - a.registros.length || a.nombre.localeCompare(b.nombre, "es-CO"),
  );
}

export type DocumentoConNombresDistintos = {
  clave: string;
  documento: string;
  /** Los nombres tal como están escritos, sin repetir y ordenados. */
  nombres: string[];
  registros: Entrada[];
};

/**
 * Los documentos que aparecen en unidades distintas **con nombres distintos**. No es un dueño: es un
 * documento de relleno, un error de digitación o un nombre escrito de dos formas, y quien lo sabe es
 * la administración. En Santa María, el 17 sep 2026, era `65465465` en David Cancelo y Luis Otero.
 */
export function mismoDocumentoNombresDistintos(
  personas: readonly PersonaDelPadron[],
): DocumentoConNombresDistintos[] {
  const resultado: DocumentoConNombresDistintos[] = [];
  for (const [clave, grupo] of agruparPorUnidades(personas)) {
    if (grupo.por !== "documento" || grupo.nombresNormalizados.size < 2) continue;
    const nombres = [...new Set(grupo.nombres)].sort((a, b) => a.localeCompare(b, "es-CO"));
    resultado.push({ clave, documento: grupo.valor, nombres, registros: registrosOrdenados(grupo) });
  }
  return resultado.sort((a, b) => a.documento.localeCompare(b.documento, "es-CO", { numeric: true }));
}
