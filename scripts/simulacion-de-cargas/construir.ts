/**
 * Construye archivos de prueba a partir de una ESPECIFICACIÓN declarativa.
 *
 * **POR QUÉ ASÍ, y no dejando que cada quien escriba su xlsx.** Lo que se quiere
 * variar es el CONTENIDO y las rarezas del archivo —el título encima, el BOM, el
 * fin de línea, la hoja de saldos delante, la fila de totales al final—, no la
 * mecánica de escribir un libro de Excel. Con una especificación, quien inventa
 * casos escribe un JSON pequeño y revisable, y la conversión a bytes ocurre en
 * un solo sitio: si mañana el constructor mejora, todos los casos mejoran.
 *
 * **Y hace falta decir qué NO es esto: NO ES CORPUS.** Son archivos inventados.
 * Sirven para encontrar lo que se ROMPE —eso es correctitud y se contesta con
 * casos construidos— y **no sirven para estimar CON QUÉ FRECUENCIA** pasa cada
 * cosa ahí fuera, que es la pregunta que sigue esperando archivos de un cliente
 * (`docs/exploracion-ai-onb-001.md`).
 *
 * Uso:
 *   npx tsx scripts/simulacion-de-cargas/construir.ts [directorio-de-salida]
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as XLSX from "xlsx";

const AQUI = dirname(fileURLToPath(import.meta.url));
const CASOS = join(AQUI, "casos");

export interface Caso {
  /** Nombre del archivo, sin extensión. */
  nombre: string;
  /** Qué formato de padrón imita, en una línea. */
  descripcion: string;
  /** Qué se está importando. */
  entidad: "person" | "unit";
  formato: "csv" | "xlsx";
  /** Lo que quien lo inventó espera que pase. Se compara a ojo con lo medido. */
  queDeberiaPasar: string;
  /** Nombre de hoja → matriz de celdas. Un CSV usa la primera. */
  hojas: Record<string, string[][]>;
  /** Rarezas del CSV. Se ignoran en XLSX. */
  csv?: { bom?: boolean; eol?: "\n" | "\r\n"; separador?: string };
}

function construirCsv(caso: Caso): Buffer {
  const matriz = Object.values(caso.hojas)[0] ?? [];
  const sep = caso.csv?.separador ?? ",";
  const eol = caso.csv?.eol ?? "\n";
  const texto = matriz
    .map((fila) =>
      fila
        .map((c) => {
          const v = String(c ?? "");
          // Se entrecomilla lo que lo necesita, como haría cualquier exportador.
          return /["\n\r]|,/.test(v) || v.includes(sep) ? `"${v.replace(/"/g, '""')}"` : v;
        })
        .join(sep),
    )
    .join(eol);
  // El BOM es lo que pone Excel al «Guardar como CSV UTF-8», y es justo el que
  // se cuela dentro del primer encabezado si nadie lo quita.
  return Buffer.from((caso.csv?.bom ? "﻿" : "") + texto, "utf8");
}

function construirXlsx(caso: Caso): Buffer {
  const libro = XLSX.utils.book_new();
  for (const [nombre, matriz] of Object.entries(caso.hojas)) {
    XLSX.utils.book_append_sheet(libro, XLSX.utils.aoa_to_sheet(matriz), nombre.slice(0, 31));
  }
  return XLSX.write(libro, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export function leerCasos(): Caso[] {
  return readdirSync(CASOS)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(CASOS, f), "utf8")) as Caso);
}

function main() {
  const salida = process.argv[2] ?? join(AQUI, "generados");
  mkdirSync(salida, { recursive: true });
  const casos = leerCasos();
  for (const caso of casos) {
    const bytes = caso.formato === "csv" ? construirCsv(caso) : construirXlsx(caso);
    const ruta = join(salida, `${caso.nombre}.${caso.formato}`);
    writeFileSync(ruta, bytes);
    console.log(`✔ ${caso.nombre}.${caso.formato}  (${bytes.length} bytes) — ${caso.descripcion}`);
  }
  console.log(`\n${casos.length} archivos en ${salida}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
