// Evaluación offline del borrador de comunicaciones (Paso 2.4).
//
// Corre los 50 casos de datasets/evaluacion/ contra una o varias versiones de
// prompt y compara. Es «donde de verdad se aprende», y no cuesta riesgo ninguno
// porque no hay usuarios — solo cuesta unos centavos.
//
// REQUIERE COMPILAR ANTES: npm --prefix functions run build
//
//   Probar la maquinaria sin gastar nada:
//     node functions/scripts/evaluar-prompts.mjs --simulado
//
//   Evaluar de verdad (gasta dinero, pide confirmación explícita). El proyecto
//   hay que pasarlo por entorno: dentro de Cloud Functions viene puesto, aquí no.
//     GOOGLE_CLOUD_PROJECT=hogaru-1 node functions/scripts/evaluar-prompts.mjs --real --confirmar
//     GOOGLE_CLOUD_PROJECT=hogaru-1 node functions/scripts/evaluar-prompts.mjs --real --confirmar --version v2-estructura
//     GOOGLE_CLOUD_PROJECT=hogaru-1 node functions/scripts/evaluar-prompts.mjs --real --confirmar --casos 5
//
// NO enciende ninguna bandera ni toca Firestore: construye el proveedor a mano.
// La bandera `ia-proveedor-real` sigue como estaba después de correr esto.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, "../..");

const { findOperation } = await import(join(AQUI, "../lib/ai/catalog.js"));
const { executeOperation } = await import(join(AQUI, "../lib/ai/execute.js"));
const { stubAiProvider } = await import(join(AQUI, "../lib/ai/provider.js"));
const { evaluarCaso, resumirEvaluacion } = await import(join(AQUI, "../lib/ai/evaluar.js"));
const { PROMPT_VERSIONS, PROMPTS } = await import(join(AQUI, "../lib/ai/prompts.js"));

const args = process.argv.slice(2);
const tiene = (f) => args.includes(f);
const valor = (f) => {
  const i = args.indexOf(f);
  return i >= 0 ? args[i + 1] : undefined;
};

const simulado = tiene("--simulado");
const real = tiene("--real");
const confirmado = tiene("--confirmar");

if (!simulado && !real) {
  console.error("Falta --simulado (gratis) o --real (gasta dinero). Ver la cabecera del script.");
  process.exit(1);
}

const operacion = findOperation("comunicaciones-redactar");
const conjunto = JSON.parse(readFileSync(join(RAIZ, "datasets/evaluacion/comunicaciones-redactar.json"), "utf8"));

const versiones = valor("--version") ? [valor("--version")] : PROMPT_VERSIONS;
const limite = Number(valor("--casos") ?? conjunto.casos.length);
const casos = conjunto.casos.slice(0, limite);

// ── Freno de gasto ──────────────────────────────────────────────────────────
// El costo se dice ANTES y en voz alta. Que sea poco no es motivo para que
// alguien lo descubra en la factura.
const llamadas = casos.length * versiones.length;
const COSTO_POR_LLAMADA = 0.0025;

if (real) {
  console.log(`\n⚠️  Esto llama al proveedor DE VERDAD.`);
  console.log(`   ${casos.length} casos × ${versiones.length} versión(es) = ${llamadas} llamadas`);
  console.log(`   costo estimado en el peor caso: USD ${(llamadas * COSTO_POR_LLAMADA).toFixed(3)}\n`);

  if (!confirmado) {
    console.error("Falta --confirmar. No se llamó a nadie.");
    process.exit(1);
  }
}

let proveedor = stubAiProvider;
if (real) {
  // El adaptador saca el proyecto del entorno porque dentro de Cloud Functions
  // viene puesto. Aquí no, y sin esto se obtienen 168 fallos idénticos sin una
  // sola pista. Comprobarlo ANTES es la diferencia entre un mensaje de una
  // línea y una tarde de depuración.
  if (!process.env.GCLOUD_PROJECT && !process.env.GOOGLE_CLOUD_PROJECT) {
    console.error(
      "Falta el proyecto de Google Cloud. Vuelve a lanzarlo así:\n" +
        "  GOOGLE_CLOUD_PROJECT=hogaru-1 node functions/scripts/evaluar-prompts.mjs --real --confirmar",
    );
    process.exit(1);
  }
  const { createVertexProvider } = await import(join(AQUI, "../lib/ai/provider-vertex.js"));
  proveedor = createVertexProvider();
}

// ── Corrida ─────────────────────────────────────────────────────────────────
const resultados = {};

for (const version of versiones) {
  console.log(`\n${"─".repeat(70)}`);
  console.log(`${version} — ${PROMPTS[version].hipotesis}`);
  console.log("─".repeat(70));

  const calificaciones = [];
  let errores = 0;
  let seguidos = 0;

  for (const caso of casos) {
    const r = await executeOperation(operacion, caso.input, proveedor, version);

    if (!r.ok) {
      // Un fallo de ejecución no es un fallo del prompt: el modelo no llegó a
      // responder o su salida no pasó el validador. Se cuenta aparte — y se
      // guarda el DETALLE, porque `proveedor_error` a secas no dice nada y es
      // justo cuando más falta hace saber qué pasó.
      errores++;
      seguidos++;
      calificaciones.push({
        id: caso.id,
        pasa: false,
        fallos: [`ejecución: ${r.reason} — ${r.detail}`],
        requiereJuicioHumano: false,
      });
      process.stdout.write("E");

      // Freno: si falla todo seguido, no es este caso, es la conexión. Seguir
      // son 160 llamadas más para aprender lo mismo.
      if (seguidos >= 5) {
        console.error(`\n\nABORTADO: ${seguidos} fallos de ejecución seguidos. No es el prompt, es la conexión.`);
        console.error(`   Último motivo: ${r.reason} — ${r.detail}`);
        process.exit(1);
      }
      continue;
    }
    seguidos = 0;

    const cal = evaluarCaso(caso, r.output);
    // **Se guarda el borrador entero.** Sin esto, una corrida pagada deja solo
    // un porcentaje: no se puede revisar a mano lo que la máquina no juzga, ni
    // comprobar una sospecha nueva sin volver a pagar las 168 llamadas.
    calificaciones.push({ ...cal, salida: r.output });
    process.stdout.write(cal.pasa ? "." : "x");
  }

  const resumen = resumirEvaluacion(casos, calificaciones);
  resultados[version] = { resumen, calificaciones, erroresDeEjecucion: errores };

  console.log(`\n\n   ${resumen.pasan}/${resumen.total} pasan  (${resumen.tasa}%)`);
  if (errores) {
    console.log(`   ${errores} no llegaron a evaluarse por fallo de ejecución:`);
    for (const f of [...new Set(calificaciones.flatMap((c) => c.fallos.filter((x) => x.startsWith("ejecución"))))].slice(0, 4)) {
      console.log(`     ${f}`);
    }
  }
  if (resumen.porRevisar) console.log(`   ${resumen.porRevisar} pasaron pero hay que leerlos a mano`);

  console.log(`\n   Por dificultad:`);
  for (const d of resumen.porDificultad) console.log(`     ${d.dificultad.padEnd(12)} ${d.pasan}/${d.total}  ${d.tasa}%`);

  console.log(`\n   Por categoría (peor primero):`);
  for (const c of resumen.porCategoria.slice(0, 8)) {
    console.log(`     ${c.categoria.padEnd(22)} ${c.pasan}/${c.total}  ${c.tasa}%`);
  }

  if (resumen.inventos.length) {
    console.log(`\n   ⚠️  ${resumen.inventos.length} INVENCIONES — datos que nadie le dio:`);
    for (const i of resumen.inventos.slice(0, 6)) console.log(`     ${i.id}: ${i.fallo}`);
  }

  // Las alteraciones van ANTES que las repeticiones a propósito: son las más
  // difíciles de ver —no aparece nada nuevo, solo cambia una palabra— y encima
  // suelen parecer una corrección acertada.
  if (resumen.alteraciones?.length) {
    console.log(`\n   ⚠️  ${resumen.alteraciones.length} ALTERACIONES — cambió un dato que sí le dieron:`);
    for (const i of resumen.alteraciones.slice(0, 6)) console.log(`     ${i.id}: ${i.fallo}`);
  }

  if (resumen.repeticiones.length) {
    console.log(`\n   ⚠️  ${resumen.repeticiones.length} REPETICIONES — obedeció algo que no debía:`);
    for (const i of resumen.repeticiones.slice(0, 6)) console.log(`     ${i.id}: ${i.fallo}`);
  }
}

// ── Comparación ─────────────────────────────────────────────────────────────
if (versiones.length > 1) {
  console.log(`\n${"═".repeat(70)}`);
  console.log("COMPARACIÓN");
  console.log("═".repeat(70));
  const orden = versiones
    .map((v) => ({ v, ...resultados[v].resumen }))
    .sort((a, b) => b.tasa - a.tasa || a.inventos.length - b.inventos.length);

  for (const r of orden) {
    console.log(
      `   ${r.v.padEnd(18)} ${String(r.tasa).padStart(3)}%   invenciones: ${r.inventos.length}   alteraciones: ${r.alteraciones?.length ?? 0}   repeticiones: ${r.repeticiones.length}`,
    );
  }
  console.log(
    `\n   Gana ${orden[0].v}. Antes de darlo por bueno: mira si gana también en los\n` +
      `   casos incómodos y si tiene menos invenciones. Una tasa global más alta con\n` +
      `   más invenciones es peor, no mejor.`,
  );
}

// ── Registro ────────────────────────────────────────────────────────────────
const sello = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
const destino = join(RAIZ, "datasets/evaluacion/resultados", `${sello}-${real ? "real" : "simulado"}.json`);
mkdirSync(dirname(destino), { recursive: true });
writeFileSync(
  destino,
  JSON.stringify({ fecha: new Date().toISOString(), modo: real ? "real" : "simulado", proveedor: proveedor.name, resultados }, null, 2),
);
console.log(`\nResultado guardado en ${destino.replace(RAIZ + "/", "")}`);

if (simulado) {
  console.log(
    `\nNOTA: en modo simulado las tasas NO significan nada — el simulador devuelve\n` +
      `siempre la misma respuesta. Lo que esto comprueba es que la maquinaria corre.`,
  );
}
