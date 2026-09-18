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
 * **Cómo se agrupa, y por qué el documento manda:** con documento, agrupa por documento —identifica—;
 * sin él, por nombre normalizado. Medido en producción el 17 de septiembre de 2026: de **202
 * personas, solo 47 traen documento**, así que la mayoría cae al nombre, y **dos homónimos de
 * unidades distintas se verán como un dueño con dos unidades**. Es exactamente por eso que la lista
 * es de revisión y no de acción: en Santa María hubo **siete** «David Carmona» que no eran la misma
 * persona. Una persona con documento y su homónimo sin documento caen en grupos distintos, a
 * propósito: el documento es la evidencia y no se descarta por un nombre que coincide.
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

/**
 * Los grupos con **dos unidades distintas o más**, de más unidades a menos y luego por nombre.
 * Dos registros de la misma persona en la MISMA unidad no son esto —son un duplicado, y de eso se
 * ocupa `duplicados.ts`—, así que cuentan como una.
 */
export function duenosConVariasUnidades(
  personas: readonly PersonaDelPadron[],
): DuenoConVariasUnidades[] {
  type Entrada = { personaId: string; unidad: string };
  const grupos = new Map<string, { por: "documento" | "nombre"; nombres: string[]; porUnidad: Map<string, Entrada> }>();

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
    const grupo = grupos.get(clave) ?? { por, nombres: [], porUnidad: new Map<string, Entrada>() };
    const etiqueta = String(persona.unitLabel ?? "").trim() || unidadId;
    // La primera aparición de una unidad se queda: dos registros en la misma unidad son una unidad.
    if (!grupo.porUnidad.has(unidadId)) grupo.porUnidad.set(unidadId, { personaId: persona.id, unidad: etiqueta });
    const nombreCrudo = String(persona.fullName ?? "").trim();
    if (nombreCrudo) grupo.nombres.push(nombreCrudo);
    grupos.set(clave, grupo);
  }

  const resultado: DuenoConVariasUnidades[] = [];
  for (const [clave, grupo] of grupos) {
    if (grupo.porUnidad.size < 2) continue;
    const nombre = grupo.nombres.reduce((mejor, actual) => (actual.length > mejor.length ? actual : mejor), "");
    const registros = Array.from(grupo.porUnidad.values()).sort((a, b) =>
      a.unidad.localeCompare(b.unidad, "es-CO", { numeric: true }),
    );
    resultado.push({ clave, por: grupo.por, nombre: nombre || "Sin nombre", registros });
  }

  return resultado.sort(
    (a, b) => b.registros.length - a.registros.length || a.nombre.localeCompare(b.nombre, "es-CO"),
  );
}
