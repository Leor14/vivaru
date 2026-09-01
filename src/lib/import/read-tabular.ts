/**
 * Lectura de un archivo tabular — CSV o XLSX — con la misma forma de salida.
 *
 * **POR QUÉ EXISTE.** Los dos asistentes llamaban a `papaparse` directamente y
 * solo aceptaban CSV (`accept=".csv,text/csv"`), mientras `xlsx` llevaba tiempo
 * instalado sin usarse. Lo que exporta un sistema de administración suele ser
 * XLSX, así que el importador rechazaba el archivo que la gente tiene de verdad.
 *
 * **La forma de salida es la misma para los dos formatos** y esa es toda la
 * gracia: los asistentes no preguntan de qué tipo era el archivo. Un CSV es un
 * libro de una sola hoja, y así el selector de hoja no necesita un caso
 * especial — simplemente no se enseña cuando solo hay una.
 *
 * **Todo ocurre en el navegador.** El archivo no viaja a ningún servidor ni se
 * almacena, que es lo que evita guardar un fichero con datos personales
 * (`PRD-V-FEAT-002` §7).
 *
 * **Y los encabezados no se dan por hechos en la primera fila** — ver
 * `filaDeEncabezados`. Lo que exporta una administración suele traer un título
 * encima, y darlo por encabezado envenena todo lo que viene después.
 */

import Papa from "papaparse";
import * as XLSX from "xlsx";

export interface TabularSheet {
  /** Encabezados en su orden original. */
  headers: string[];
  rows: Record<string, string>[];
}

export interface TabularFile {
  /** Un CSV trae exactamente uno. Un XLSX, tantos como hojas con datos. */
  sheetNames: string[];
  sheets: Record<string, TabularSheet>;
}

/**
 * `RN-08`. El tope no es una limitación técnica —`writeBatch` va por lotes de
 * 450 y aguantaría más— sino de producto: por encima de esto, revisar el
 * resultado en pantalla deja de ser posible y la persona confirmaría a ciegas.
 */
export const MAX_ROWS = 5000;

export class TabularReadError extends Error {}

function esXlsx(nombre: string): boolean {
  return /\.xlsx?$/i.test(nombre);
}

/**
 * Encabezados únicos conservando el orden.
 *
 * Un archivo con dos columnas «Teléfono» es raro pero existe, y sin esto la
 * segunda pisaría a la primera y sus datos desaparecerían **sin aviso**. Se
 * distinguen por posición, que es lo único que las diferencia de verdad.
 */
function desambiguar(headers: string[]): string[] {
  const vistos = new Map<string, number>();
  return headers.map((h) => {
    const base = h.trim() || "(sin nombre)";
    const n = vistos.get(base) ?? 0;
    vistos.set(base, n + 1);
    return n === 0 ? base : `${base} (${n + 1})`;
  });
}

function comprobarTope(filas: unknown[], hoja?: string) {
  if (filas.length > MAX_ROWS) {
    throw new TabularReadError(
      `${hoja ? `La hoja «${hoja}» tiene` : "El archivo tiene"} ${filas.length.toLocaleString("es-CO")} filas y el máximo son ${MAX_ROWS.toLocaleString("es-CO")}. Pártelo en varios archivos e impórtalos uno a uno.`,
    );
  }
}

/**
 * Cuántas filas del principio se miran buscando los encabezados. Un preámbulo
 * de administración son una o dos líneas; diez es holgura, no una apuesta.
 */
const FILAS_DE_PREAMBULO = 10;

function celdasConTexto(fila: readonly unknown[] | undefined): number {
  if (!fila) return 0;
  return fila.filter((celda) => String(celda ?? "").trim() !== "").length;
}

/**
 * En qué fila empiezan los encabezados de verdad.
 *
 * **POR QUÉ EXISTE.** Se asumía la fila 0, y lo que exporta una administración
 * suele traer encima un título en celda combinada —«PADRÓN GENERAL DE
 * PROPIETARIOS — CONJUNTO LOS ROBLES»— y a veces una fila en blanco. Con esa
 * suposición **el título se convierte en encabezado y los encabezados reales
 * pasan a ser datos**: el asistente ofrece columnas llamadas «(sin nombre)» y
 * llega a proponer el título como correo electrónico, con cara de acierto.
 * Medido contra este mismo lector el 1 de septiembre de 2026.
 *
 * **La regla es deliberadamente corta: se salta lo que tiene menos de dos
 * celdas con texto.** Un título ocupa una, una fila en blanco ninguna, y una
 * fila de encabezados dos o más. No intenta adivinar más que eso — un título
 * repartido en dos celdas la engaña, y eso es sabido y aceptado: la mitad cara
 * de este problema es de la ficha de IA, no de aquí.
 *
 * **Si ninguna fila llega a dos, se devuelve la 0**, que es lo de siempre. Es
 * lo que mantiene funcionando un archivo de una sola columna.
 */
function filaDeEncabezados(matriz: readonly (readonly unknown[])[]): number {
  const hasta = Math.min(matriz.length, FILAS_DE_PREAMBULO);
  for (let i = 0; i < hasta; i += 1) {
    if (celdasConTexto(matriz[i]) >= 2) return i;
  }
  return 0;
}

/**
 * De una matriz de celdas a una hoja con encabezados y filas.
 *
 * **La usan los dos formatos**, y por eso está aquí: cuando CSV y XLSX armaban
 * su salida cada uno por su lado, el resultado se separaba en detalles —el
 * CSV no recortaba los espacios y el XLSX sí— y un fallo aparecía en un solo
 * formato, que se lee como «a veces no funciona». Devuelve `null` cuando no
 * queda ninguna fila de datos.
 */
function armarHoja(matriz: readonly (readonly unknown[])[], nombreHoja?: string): TabularSheet | null {
  const inicio = filaDeEncabezados(matriz);
  const headers = desambiguar((matriz[inicio] ?? []).map((celda) => String(celda ?? "")));
  if (headers.length === 0) return null;

  const cuerpo = matriz.slice(inicio + 1);
  if (cuerpo.length === 0) return null;
  comprobarTope(cuerpo, nombreHoja);

  return {
    headers,
    rows: cuerpo.map((fila) => {
      const salida: Record<string, string> = {};
      headers.forEach((h, i) => {
        salida[h] = String(fila[i] ?? "").trim();
      });
      return salida;
    }),
  };
}

function leerCsv(texto: string, nombreArchivo: string): TabularFile {
  // `header: false` a propósito: con el modo de encabezados de Papa la primera
  // fila ES la de encabezados por definición, y entonces un título encima no se
  // puede detectar. Se pide la matriz cruda y decide `armarHoja`, que es la
  // misma que usa el XLSX.
  const result = Papa.parse<string[]>(texto, {
    header: false,
    skipEmptyLines: true,
  });

  const hoja = armarHoja(result.data);
  if (!hoja) {
    throw new TabularReadError("El archivo no tiene una fila de encabezados.");
  }

  return { sheetNames: [nombreArchivo], sheets: { [nombreArchivo]: hoja } };
}

function leerXlsx(buffer: ArrayBuffer): TabularFile {
  const libro = XLSX.read(buffer, { type: "array" });
  const sheets: Record<string, TabularSheet> = {};
  const sheetNames: string[] = [];

  for (const nombre of libro.SheetNames) {
    const matriz = XLSX.utils.sheet_to_json<string[]>(libro.Sheets[nombre], {
      header: 1,
      defval: "",
      // `raw: false` devuelve lo que se VE en la celda. Sin él, una fecha llega
      // como número de serie de Excel y un código con ceros a la izquierda los
      // pierde — dos formas silenciosas de corromper el dato.
      raw: false,
      blankrows: false,
    });

    // Una hoja vacía o solo con encabezados no se ofrece: elegirla llevaría a
    // un paso de mapeo sin nada que mapear. Lo decide `armarHoja`, que es quien
    // sabe en qué fila empiezan de verdad los encabezados.
    const hoja = armarHoja(matriz, nombre);
    if (!hoja) continue;

    sheetNames.push(nombre);
    sheets[nombre] = hoja;
  }

  if (sheetNames.length === 0) {
    throw new TabularReadError("El libro no tiene ninguna hoja con datos.");
  }

  return { sheetNames, sheets };
}

/**
 * Lee el archivo y devuelve sus hojas. Lanza `TabularReadError` con un mensaje
 * ya escrito para la persona — nunca un error técnico en pantalla.
 */
export async function readTabularFile(file: File): Promise<TabularFile> {
  if (esXlsx(file.name)) {
    return leerXlsx(await file.arrayBuffer());
  }
  return leerCsv(await file.text(), file.name);
}
