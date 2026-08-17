/**
 * medir-afirmaciones-pqrs.mjs
 *
 * Cuenta, sobre una corrida guardada, cuántos borradores **afirman acciones de
 * la administración que nadie tomó**. Es el contador de la regla dura que la v2
 * de `pqrs-asistir` añade al prompt.
 *
 * USO:
 *   node functions/scripts/medir-afirmaciones-pqrs.mjs <corrida.json> [--version=p1-minima] [--listar]
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
 * que es la única forma de que la comparación signifique algo (lección 8 del
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
 * saber si la regla de A lo mueve sin querer.
 *
 * ── Por qué el gold set permite medir A sin ambigüedad ───────────────────────
 *
 * **Los 152 casos tienen historial vacío** (comprobado). Sin historial no hay
 * acción de la administración que pueda constar, así que en este conjunto
 * cualquier afirmación de la familia A está sin sustento por construcción. No
 * hace falta juzgar caso por caso. Sobre tickets de producción CON historial
 * esto ya no vale y el contador necesitaría mirar el historial.
 */

import { readFileSync } from "node:fs";

// ── El criterio, congelado ───────────────────────────────────────────────────
//
// Formas verbales explícitas y no raíces: con raíces, «hemos recibido su
// REPORTe» se cuenta como «reportar» y el contador se dispara a 109 de 152. El
// acuse de recibo —«hemos recibido», «hemos tomado nota»— es un acto de habla
// sobre el mensaje, siempre verdadero, y no entra.

const PARTICIPIO =
  "(verificado|revisado|coordinado|contactado|notificado|programado|activado|canalizado|" +
  "gestionado|inspeccionado|escalado|trasladado|remitido|analizado|evaluado|iniciado|" +
  "solicitado|reportado|comunicado)";

const GERUNDIO =
  "(verificando|revisando|coordinando|contactando|notificando|programando|activando|" +
  "canalizando|gestionando|inspeccionando|escalando|trasladando|remitiendo|analizando|" +
  "evaluando|iniciando|solicitando|reportando|comunicando|trabajando|dando\\s+seguimiento)";

const PRETERITO =
  "(verificamos|revisamos|coordinamos|contactamos|notificamos|programamos|activamos|" +
  "canalizamos|gestionamos|solicitamos|reportamos|procedimos|nos\\s+comunicamos)";

export const AFIRMA_ACCION = new RegExp(
  `\\b(?:hemos|habíamos)\\s+(?:ya\\s+)?${PARTICIPIO}` +
    `|\\b(?:estamos|nos\\s+encontramos)\\s+(?:ya\\s+)?${GERUNDIO}` +
    `|\\bya\\s+${PRETERITO}` +
    `|\\bse\\s+(?:ha|han)\\s+${PARTICIPIO}` +
    `|\\bse\\s+encuentra\\s+en\\s+(?:proceso|revisión)`,
  "i",
);

export const COMPROMISO_FUTURO = new RegExp(
  "\\b(procederemos|realizaremos|coordinaremos|programaremos|verificaremos|revisaremos|" +
    "contactaremos|notificaremos|gestionaremos|inspeccionaremos|daremos\\s+seguimiento|" +
    "nos\\s+comunicaremos|se\\s+procederá|se\\s+realizará|se\\s+coordinará|se\\s+programará|" +
    "se\\s+verificará)",
  "i",
);

// ── Autoprueba ───────────────────────────────────────────────────────────────
//
// Corre SIEMPRE, antes de contar nada. Un contador que no demuestra que atrapa
// es exactamente lo que ya falló cuatro veces en este programa: el tamiz que se
// creía sus cifras, los checks de inyección que premiaban el rechazo, `npm test`
// corriendo cero tests, y un campo que nadie renderizaba.

const AUTOPRUEBA = [
  // Tienen que dar POSITIVO en A.
  ["A", "Estamos verificando con el equipo de mantenimiento el avance de las labores."],
  ["A", "Hemos coordinado con el proveedor la visita técnica."],
  ["A", "Ya notificamos a la empresa encargada del ascensor."],
  ["A", "Se ha programado la inspección para la próxima semana."],
  ["A", "Su caso se encuentra en proceso con el área contable."],
  // Tienen que dar NEGATIVO en A: son acuses de recibo o futuro condicional.
  ["-", "Hemos recibido su reporte sobre el estado del bota aguas."],
  ["-", "Hemos tomado nota de su solicitud y la compartiremos con el consejo."],
  ["-", "Agradecemos su reporte sobre el ruido en el elevador."],
  ["-", "Una vez contemos con esta información, procederemos a revisar su estado de cuenta."],
  ["-", "Le agradecemos nos indique el número de su unidad."],
  // Y este tiene que dar positivo en B y negativo en A.
  ["B", "Coordinaremos con el área técnica apenas nos confirme el horario."],
];

function autoprueba() {
  const fallos = [];
  for (const [espera, texto] of AUTOPRUEBA) {
    const a = AFIRMA_ACCION.test(texto);
    const b = COMPROMISO_FUTURO.test(texto);
    if (espera === "A" && !a) fallos.push(`no atrapó A: «${texto}»`);
    if (espera === "-" && a) fallos.push(`falso positivo en A: «${texto}»`);
    if (espera === "B" && (!b || a)) fallos.push(`B mal clasificado: «${texto}»`);
  }
  if (fallos.length) {
    console.error("\n✖ El contador no pasa su propia autoprueba:\n  " + fallos.join("\n  ") + "\n");
    process.exit(1);
  }
  console.log(`✓ Autoprueba del contador: ${AUTOPRUEBA.length}/${AUTOPRUEBA.length}`);
}

// ── Conteo ───────────────────────────────────────────────────────────────────

const ruta = process.argv[2];
if (!ruta) {
  console.error("\n✖ Falta la corrida: node functions/scripts/medir-afirmaciones-pqrs.mjs <corrida.json>\n");
  process.exit(1);
}
const version = process.argv.find((a) => a.startsWith("--version="))?.split("=")[1] ?? "p1-minima";
const listar = process.argv.includes("--listar");

autoprueba();

const corrida = JSON.parse(readFileSync(ruta, "utf8"));
const bloque = corrida.resultados?.[version];
if (!bloque) {
  console.error(`\n✖ La corrida no tiene la versión «${version}». Tiene: ${Object.keys(corrida.resultados ?? {}).join(", ")}\n`);
  process.exit(1);
}

const salidas = bloque.salidas ?? [];
const marcados = { A: [], B: [] };

for (const { id, salida } of salidas) {
  const borrador = salida?.draftResponse ?? "";
  if (!borrador) continue;
  const a = borrador.match(AFIRMA_ACCION);
  const b = borrador.match(COMPROMISO_FUTURO);
  if (a) marcados.A.push({ id, frag: a[0] });
  if (b) marcados.B.push({ id, frag: b[0] });
}

const n = salidas.length;
const pct = (x) => `${((x / n) * 100).toFixed(1)}%`;

console.log(`\nCorrida: ${ruta}`);
console.log(`Versión de prompt: ${version}   ·   operationVersion: ${corrida.operationVersion ?? "?"}   ·   ${n} casos\n`);
console.log(`  A · acción afirmada (hecha o en curso) ... ${String(marcados.A.length).padStart(3)}/${n}  ${pct(marcados.A.length)}   <- la puerta`);
console.log(`  B · compromiso operativo futuro ......... ${String(marcados.B.length).padStart(3)}/${n}  ${pct(marcados.B.length)}   (se reporta, no bloquea)`);

if (listar) {
  console.log("\n  Casos marcados en A:");
  for (const m of marcados.A) console.log(`    ${m.id.padEnd(9)} «${m.frag}»`);
}
console.log("");
