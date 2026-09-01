/**
 * Mete cada archivo construido por el camino REAL del importador y cuenta qué
 * ve el asistente.
 *
 * **Qué lo separa de las sondas de `AI-ONB-001`.** Aquellas parten de arreglos
 * de encabezados escritos a mano, así que **se saltan el lector entero** — y el
 * lector es justo donde muerden el título encima, el BOM, la hoja de saldos
 * delante y los encabezados repetidos. Esto empieza en los BYTES.
 *
 * **Dónde termina, y hay que decirlo:** llega hasta el mapeo y sus avisos. La
 * validación por fila —correo, rol, si la unidad existe— vive dentro de los
 * componentes y no se puede alcanzar sin arrastrar React, así que un ✔ de aquí
 * significa «el asistente sabría qué columna es cada cosa», no «entraría».
 *
 * Uso:
 *   npx tsx scripts/simulacion-de-cargas/construir.ts
 *   npx tsx scripts/simulacion-de-cargas/correr.ts
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  hayBloqueantes,
  mappingIssues,
  missingRequired,
  pickBestSheet,
  suggestMapping,
  summarizeMapping,
} from "../../src/lib/import/field-catalog";
import { readTabularFile, TabularReadError } from "../../src/lib/import/read-tabular";
import { ALIAS_DE_TIPO } from "../../src/lib/units/tipos";
import { leerCasos } from "./construir";

const AQUI = dirname(fileURLToPath(import.meta.url));

const ACEPTADOS_UNIDAD = {
  "unit.type": Object.keys(ALIAS_DE_TIPO),
  "unit.status": ["active", "activo", "activa", "inactive", "inactivo", "inactiva"],
};
// COPIA de `ROLE_ALIASES` del asistente de residentes, que vive dentro del
// componente y no se puede importar sin arrastrar React. **Es un espejo y hay
// que saberlo**: si allí se añade un rol y aquí no, esta sonda mide de menos.
const ACEPTADOS_PERSONA = {
  "person.role": ["owner_occupant", "propietario", "propietario residente", "dueno", "owner",
    "tenant", "inquilino", "arrendatario", "residente", "investor", "inversionista",
    "propietario no residente", "other", "otro", "otra"],
};

/**
 * **El veredicto tuvo que crecer, y la razón vale más que el arreglo.** Miraba
 * solo `hayBloqueantes`, así que un archivo con tres de seis roles que el
 * producto no reconoce salía **«✔ entra limpio»**: el aviso estaba impreso en el
 * detalle y el resumen —que es lo que la gente lee— decía lo contrario. Un
 * instrumento que resume mal es peor que no resumir.
 */
function veredicto(
  faltan: string[],
  bloquea: boolean,
  dudas: number,
  sinUsar: string[],
): string {
  const partes: string[] = [];
  if (bloquea) partes.push("⛔ BLOQUEA");
  if (faltan.length) partes.push(`✘ FALTAN: ${faltan.join(", ")}`);
  if (dudas) partes.push(`⚠ ${dudas} aviso(s) de duda`);
  if (sinUsar.length) partes.push(`⚠ ${sinUsar.length} columna(s) sin usar`);
  return partes.length ? partes.join(" · ") : "✔ entra limpio";
}

async function main() {
  const dir = process.argv[2] ?? join(AQUI, "generados");
  const casos = leerCasos();
  const resumen: string[] = [];

  for (const caso of casos) {
    const ruta = join(dir, `${caso.nombre}.${caso.formato}`);
    console.log(`\n══════ ${caso.nombre}  ·  ${caso.descripcion}`);
    console.log(`       esperado HOY: ${caso.queDeberiaPasar}`);
    if (caso.conFeat006) console.log(`       con FEAT-006:  ${caso.conFeat006}`);

    let leido;
    try {
      const bytes = readFileSync(ruta);
      leido = await readTabularFile(new File([new Uint8Array(bytes)], `${caso.nombre}.${caso.formato}`));
    } catch (e) {
      const linea = e instanceof TabularReadError
        ? `⛔ EL LECTOR LO RECHAZA: ${e.message}`
        : `💥 REVIENTA: ${e instanceof Error ? e.message : String(e)}`;
      console.log(`       ${linea}`);
      resumen.push(`${caso.nombre.padEnd(34)} ${linea}`);
      continue;
    }

    const accepted = caso.entidad === "unit" ? ACEPTADOS_UNIDAD : ACEPTADOS_PERSONA;
    const elegida = pickBestSheet(
      leido.sheetNames.map((n) => ({ name: n, ...leido.sheets[n] })),
      caso.entidad,
      accepted,
    );
    const hoja = leido.sheets[elegida];

    console.log(`       hojas: ${leido.sheetNames.length} [${leido.sheetNames.join(", ")}] → elige «${elegida}»`);
    console.log(`       preámbulo saltado: ${hoja.filasDePreambulo} · filas: ${hoja.rows.length}`);
    console.log(`       encabezados: ${JSON.stringify(hoja.headers)}`);

    const m = suggestMapping(hoja.headers, caso.entidad, { rows: hoja.rows, accepted });
    const avisos = mappingIssues(hoja.rows, caso.entidad, m, accepted);
    for (const [campo, header] of Object.entries(m)) {
      const a = avisos[campo];
      console.log(`         ${campo.padEnd(20)} ← ${header === null ? "∅" : `«${header}»`}${a ? `   ⚠ ${a.nivel}: ${a.mensaje}` : ""}`);
    }

    const faltan = missingRequired(m, caso.entidad).map((f) => f.label);
    const { encabezadosSinUsar } = summarizeMapping(hoja.headers, caso.entidad, m);
    if (encabezadosSinUsar.length) console.log(`       sin usar: ${JSON.stringify(encabezadosSinUsar)}`);

    const dudas = Object.values(avisos).filter((a) => a?.nivel === "duda").length;
    const v = veredicto(faltan, hayBloqueantes(avisos), dudas, encabezadosSinUsar);
    console.log(`       ${v}`);
    resumen.push(`${caso.nombre.padEnd(34)} ${v}`);
  }

  console.log("\n\n═══════════════ RESUMEN ═══════════════");
  for (const l of resumen) console.log(l);
}

void main();
