import type { Firestore } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";

/**
 * Telemetría de la importación tabular — `PRD-V-FEAT-002`, `CA-13`.
 *
 * **POR QUÉ EXISTE.** La PRD no puede cerrar su puerta `G1` sin baseline:
 * cuántas importaciones se intentan y cuántas terminan, por pista. Hoy no se
 * sabe, así que tampoco se podría decir si el paso de mapeo mejoró algo. Y la
 * lección de la sesión del 14 de agosto fue exactamente esa: **la hoja de papel
 * se queda vacía; la instrumentación no.**
 *
 * **POR QUÉ LO ESCRIBE EL SERVIDOR Y NO EL NAVEGADOR.** Es la misma regla que
 * ya está escrita en `firestore.rules` para `aiFeedback`: si el cliente pudiera
 * escribir aquí, cualquiera podría fabricar la evidencia con la que se decide
 * si la funcionalidad sigue. Cuesta una callable; la alternativa cuesta la
 * credibilidad del número.
 *
 * **QUÉ NO SE GUARDA, Y ES DELIBERADO: ni una celda del archivo.** Se registran
 * los NOMBRES de las columnas y cuántas filas hubo, nunca su contenido. Un
 * padrón lleva nombres, correos y documentos de personas reales; medir no puede
 * convertirse en una segunda copia de esos datos. Es la misma decisión que tomó
 * `aiUsage`, cuya fila no contiene nada de lo que escribió el administrador.
 *
 * **Y hay un segundo uso, que es el que la hace valiosa dentro de un año:**
 * `encabezadosSinUsar` es la lista de columnas que el catálogo no supo
 * reconocer. Esa lista **es** el trabajo pendiente del mapeo asistido de
 * `PRD-VAI-FEAT-001`: con datos reales de qué trae la gente, en vez de suponerlo.
 */

export const COLECCION = "importRuns";

/** Tope defensivo: una lista de encabezados no debería crecer sin fin. */
const MAX_ENCABEZADOS = 40;
const MAX_LARGO_ENCABEZADO = 80;

export type EntidadImportada = "unit" | "person";
export type FaseImportacion = "inicio" | "fin";

export interface RegistroImportacion {
  /** Une el inicio y el fin de un mismo intento. Lo genera el navegador. */
  runId: string;
  fase: FaseImportacion;
  entidad: EntidadImportada;
  /** `trial` | `cliente`, o ausente si el conjunto no lo declara. */
  pista?: string;
  formato: "csv" | "xlsx";
  hojas: number;
  filas: number;
  /** Campos destino que el catálogo resolvió solo, y los que hubo que asignar. */
  camposPorAlias: number;
  camposAMano: number;
  /** Columnas del archivo que no alimentaron ningún campo. Solo nombres. */
  encabezadosSinUsar: string[];
  /** Solo en `fin`. */
  importadas?: number;
  omitidas?: number;
}

export class RegistroInvalido extends Error {}

function texto(valor: unknown, campo: string): string {
  if (typeof valor !== "string" || !valor.trim()) {
    throw new RegistroInvalido(`Falta ${campo}.`);
  }
  return valor.trim();
}

function entero(valor: unknown, campo: string): number {
  if (typeof valor !== "number" || !Number.isFinite(valor) || valor < 0) {
    throw new RegistroInvalido(`${campo} debe ser un número no negativo.`);
  }
  return Math.floor(valor);
}

/**
 * Valida y normaliza lo que llega del navegador.
 *
 * **Recorta en vez de rechazar** en lo accesorio —una lista de encabezados
 * larguísima o un nombre de columna kilométrico— porque perder la medición
 * entera por un archivo raro sería el peor resultado posible: nos quedaríamos
 * sin el dato justo en el caso interesante.
 */
export function normalizarRegistro(data: unknown): RegistroImportacion {
  if (!data || typeof data !== "object") throw new RegistroInvalido("Cuerpo vacío.");
  const d = data as Record<string, unknown>;

  const fase = d.fase === "inicio" || d.fase === "fin" ? d.fase : null;
  if (!fase) throw new RegistroInvalido("Fase desconocida.");

  const entidad = d.entidad === "unit" || d.entidad === "person" ? d.entidad : null;
  if (!entidad) throw new RegistroInvalido("Entidad desconocida.");

  const formato = d.formato === "csv" || d.formato === "xlsx" ? d.formato : null;
  if (!formato) throw new RegistroInvalido("Formato desconocido.");

  const encabezados = Array.isArray(d.encabezadosSinUsar) ? d.encabezadosSinUsar : [];

  const registro: RegistroImportacion = {
    runId: texto(d.runId, "runId"),
    fase,
    entidad,
    formato,
    hojas: entero(d.hojas, "hojas"),
    filas: entero(d.filas, "filas"),
    camposPorAlias: entero(d.camposPorAlias, "camposPorAlias"),
    camposAMano: entero(d.camposAMano, "camposAMano"),
    encabezadosSinUsar: encabezados
      .filter((h): h is string => typeof h === "string")
      .slice(0, MAX_ENCABEZADOS)
      .map((h) => h.trim().slice(0, MAX_LARGO_ENCABEZADO))
      .filter(Boolean),
  };

  if (typeof d.pista === "string" && d.pista.trim()) registro.pista = d.pista.trim();
  if (fase === "fin") {
    registro.importadas = entero(d.importadas, "importadas");
    registro.omitidas = entero(d.omitidas, "omitidas");
  }

  return registro;
}

/**
 * Escribe la fila. Una por fase, no un documento mutado: el par
 * inicio/fin **contado** es la métrica, y un documento que se actualiza no deja
 * ver cuántos empezaron y nunca acabaron — que es justo lo que se quiere medir.
 */
export async function registrarImportacionEn(
  db: Firestore,
  tenantId: string,
  uid: string,
  registro: RegistroImportacion,
): Promise<void> {
  await db.collection(COLECCION).add({
    ...registro,
    tenantId,
    uid,
    createdAt: FieldValue.serverTimestamp(),
  });
}
