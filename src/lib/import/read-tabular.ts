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

function leerCsv(texto: string, nombreArchivo: string): TabularFile {
  const result = Papa.parse<Record<string, string>>(texto, {
    header: true,
    skipEmptyLines: true,
  });

  const headers = desambiguar(result.meta.fields ?? []);
  if (headers.length === 0) {
    throw new TabularReadError("El archivo no tiene una fila de encabezados.");
  }
  comprobarTope(result.data);

  // Papa ya devuelve objetos con los encabezados originales como clave; se
  // reconstruyen contra los desambiguados para que ambos caminos —CSV y XLSX—
  // entreguen exactamente las mismas claves.
  const originales = result.meta.fields ?? [];
  const rows = result.data.map((fila) => {
    const salida: Record<string, string> = {};
    originales.forEach((original, i) => {
      salida[headers[i]] = String(fila[original] ?? "");
    });
    return salida;
  });

  return { sheetNames: [nombreArchivo], sheets: { [nombreArchivo]: { headers, rows } } };
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
    // un paso de mapeo sin nada que mapear.
    if (matriz.length < 2) continue;

    const headers = desambiguar((matriz[0] ?? []).map((c) => String(c ?? "")));
    const cuerpo = matriz.slice(1);
    comprobarTope(cuerpo, nombre);

    sheetNames.push(nombre);
    sheets[nombre] = {
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
