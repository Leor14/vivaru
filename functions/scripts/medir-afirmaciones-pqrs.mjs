/**
 * medir-afirmaciones-pqrs.mjs
 *
 * Cuenta, sobre una corrida guardada, cuántos borradores **afirman acciones de
 * la administración que nadie tomó**. Es el contador de la regla dura que la v2
 * de `pqrs-asistir` añadió al prompt, y del criterio que el servidor comprueba
 * en `revisarSalida`.
 *
 * USO (requiere compilar antes: npm --prefix functions run build):
 *   node functions/scripts/medir-afirmaciones-pqrs.mjs <corrida.json> [--version p1-minima] [--listar]
 *
 * ── Por qué existe, y por qué no reproduce «44 de 152» ───────────────────────
 *
 * La Fase 2 contó 44 borradores a mano y lo dejó escrito como el hallazgo que
 * más valía. **Ese número no se puede reproducir**: el criterio nunca se
 * escribió, y los ejemplos que cita mezclan dos cosas distintas — «hemos
 * activado el protocolo» (una acción dada por hecha) y «procederemos a programar
 * la inspección», que en su borrador entero es condicional («una vez contemos
 * con esta información, procederemos a…»). Así que 44 queda como lo que fue: un
 * conteo a mano que señaló un problema real y no una línea base.
 *
 * Lo que sí hay aquí es un criterio escrito y congelado ANTES de correr la v2,
 * que es la única forma de que la comparación signifique algo (lección del
 * programa: relajar una afirmación después de ver el resultado no vale).
 *
 * ── Las dos familias, separadas a propósito ──────────────────────────────────
 *
 * **A — acción afirmada.** El borrador dice que la administración ya hizo algo,
 * lo está haciendo o lo inició. **Es la familia peligrosa** y la que la regla de
 * la v2 ataca: un administrador la publica y queda dicho que alguien verificó
 * algo que nadie verificó. Es lo que pasó en la sesión de F3 con `P010` y
 * `P009`.
 *
 * **B — compromiso operativo futuro.** «Procederemos a revisar su estado de
 * cuenta». Se cuenta aparte y **no es la puerta**: casi todos son condicionales
 * y prometer trabajo futuro es lo que hace una administración. Se mide para
 * saber si la regla de A lo mueve sin querer — y lo movió, de 45 a 59.
 *
 * ── Por qué el gold set permite medir A sin ambigüedad ───────────────────────
 *
 * **Los 152 casos tienen historial vacío** (comprobado). Sin historial no hay
 * acción de la administración que pueda constar, así que en este conjunto
 * cualquier afirmación de la familia A está sin sustento por construcción. No
 * hace falta juzgar caso por caso. Sobre tickets de producción CON historial
 * esto ya no vale, y el criterio lo dice en su propio archivo.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// ── El criterio: UNA sola copia ──────────────────────────────────────────────
//
// Se importa del compilado en vez de reescribirse aquí. Es exactamente el mismo
// que corre en el servidor dentro de `revisarSalida`, así que la cifra que mide
// este contador y lo que hace el producto no pueden separarse. Dos copias
// divergen: en este mismo repositorio los rótulos de `type` están duplicados en
// tres pantallas y ya no coinciden.

const AQUI = dirname(fileURLToPath(import.meta.url));
const { afirmaAccion, prometeFuturo, fallosDeAutoprueba, CASOS_AUTOPRUEBA } = await import(
  join(AQUI, "../lib/ai/afirmaciones.js")
);

/**
 * Corre SIEMPRE, antes de contar nada. Un contador que no demuestra que atrapa
 * es lo que ya falló cuatro veces en este programa: el tamiz que se creía sus
 * cifras, los checks de inyección que premiaban el rechazo, `npm test`
 * corriendo cero tests, y un campo que nadie renderizaba.
 */
function autoprueba() {
  const fallos = fallosDeAutoprueba();
  if (fallos.length) {
    console.error("\n✖ El criterio no pasa su propia autoprueba:\n  " + fallos.join("\n  ") + "\n");
    process.exit(1);
  }
  console.log(`✓ Autoprueba del criterio: ${CASOS_AUTOPRUEBA.length}/${CASOS_AUTOPRUEBA.length}`);
}

// ── Conteo ───────────────────────────────────────────────────────────────────

const ruta = process.argv[2];
if (!ruta) {
  console.error("\n✖ Falta la corrida: node functions/scripts/medir-afirmaciones-pqrs.mjs <corrida.json>\n");
  process.exit(1);
}
const iVersion = process.argv.indexOf("--version");
const version = iVersion >= 0 ? process.argv[iVersion + 1] : "p1-minima";
const listar = process.argv.includes("--listar");

autoprueba();

const corrida = JSON.parse(readFileSync(ruta, "utf8"));
const bloque = corrida.resultados?.[version];
if (!bloque) {
  console.error(
    `\n✖ La corrida no tiene la versión «${version}». Tiene: ${Object.keys(corrida.resultados ?? {}).join(", ")}\n`,
  );
  process.exit(1);
}

const salidas = bloque.salidas ?? [];
const marcados = { A: [], B: [] };
/** Cuántos de los marcados en A ya venían con `needsHumanReview`. El resto son
 *  los que la comprobación del servidor rescata: sin ella pasaban sin aviso. */
let yaRevisables = 0;

for (const { id, salida } of salidas) {
  const borrador = salida?.draftResponse ?? "";
  if (!borrador) continue;
  const a = afirmaAccion(borrador);
  const b = prometeFuturo(borrador);
  if (a) {
    marcados.A.push({ id, frag: a });
    if (salida?.needsHumanReview) yaRevisables += 1;
  }
  if (b) marcados.B.push({ id, frag: b });
}

const n = salidas.length;
const pct = (x) => `${((x / n) * 100).toFixed(1)}%`;

console.log(`\nCorrida: ${ruta}`);
console.log(`Versión de prompt: ${version}   ·   operationVersion: ${corrida.operationVersion ?? "?"}   ·   ${n} casos\n`);
console.log(`  A · acción afirmada (hecha o en curso) ... ${String(marcados.A.length).padStart(3)}/${n}  ${pct(marcados.A.length)}   <- la puerta`);
console.log(`  B · compromiso operativo futuro ......... ${String(marcados.B.length).padStart(3)}/${n}  ${pct(marcados.B.length)}   (se reporta, no bloquea)`);

if (marcados.A.length) {
  const rescatados = marcados.A.length - yaRevisables;
  console.log(
    `\n  De los ${marcados.A.length} marcados en A, ${yaRevisables} ya traían needsHumanReview del modelo.\n` +
      `  La comprobación del servidor fuerza la revisión en los ${rescatados} restantes,\n` +
      `  que sin ella habrían llegado al administrador sin ningún aviso.`,
  );
}

if (listar) {
  console.log("\n  Casos marcados en A:");
  for (const m of marcados.A) console.log(`    ${m.id.padEnd(9)} «${m.frag}»`);
}
console.log("");
