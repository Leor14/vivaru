// Evaluación offline del asistente de PQRS — Fase 2 de PRD-VAI-FEAT-002.
//
// Corre los 152 casos de datasets/pqrs/gold-set.json contra una o varias
// versiones de prompt y compara contra las etiquetas humanas. Es la corrida
// que cobra G4 y G5: exactitud de category (puerta ≥90%), nulls de
// buzon_simple (puerta), inyección 8/8 (puerta), type y priority (se
// reportan), y el costo real por asistencia.
//
// REQUIERE COMPILAR ANTES: npm --prefix functions run build
//
//   Probar la maquinaria sin gastar nada:
//     node functions/scripts/evaluar-pqrs.mjs --simulado
//
//   Evaluar de verdad (gasta dinero, pide confirmación explícita):
//     GOOGLE_CLOUD_PROJECT=hogaru-1 node functions/scripts/evaluar-pqrs.mjs --real --confirmar
//     GOOGLE_CLOUD_PROJECT=hogaru-1 node functions/scripts/evaluar-pqrs.mjs --real --confirmar --version p2-taxonomia
//     GOOGLE_CLOUD_PROJECT=hogaru-1 node functions/scripts/evaluar-pqrs.mjs --real --confirmar --casos 10
//
// NO enciende ninguna bandera ni toca Firestore: construye el proveedor a
// mano, igual que evaluar-prompts.mjs. La bandera `ia-proveedor-real` queda
// como estaba.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, "../..");

const { findOperation } = await import(join(AQUI, "../lib/ai/catalog.js"));
const { executeOperation } = await import(join(AQUI, "../lib/ai/execute.js"));
const { stubAiProvider } = await import(join(AQUI, "../lib/ai/provider.js"));
const { entradaDeCaso, evaluarCasoPqrs, resumirEvaluacionPqrs } = await import(
  join(AQUI, "../lib/ai/evaluar-pqrs.js")
);
const { PQRS_PROMPT_VERSIONS, PQRS_PROMPTS } = await import(join(AQUI, "../lib/ai/prompts-pqrs.js"));

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

const operacion = findOperation("pqrs-asistir");
const conjunto = JSON.parse(readFileSync(join(RAIZ, "datasets/pqrs/gold-set.json"), "utf8"));

if (conjunto.operationKey !== operacion.key) {
  console.error(`El gold set declara «${conjunto.operationKey}» y la operación es «${operacion.key}».`);
  process.exit(1);
}

const versiones = valor("--version") ? [valor("--version")] : PQRS_PROMPT_VERSIONS;
const limite = Number(valor("--casos") ?? conjunto.casos.length);
const casos = conjunto.casos.slice(0, limite);

// ── Freno de gasto ──────────────────────────────────────────────────────────
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
  if (!process.env.GCLOUD_PROJECT && !process.env.GOOGLE_CLOUD_PROJECT) {
    console.error(
      "Falta el proyecto de Google Cloud. Vuelve a lanzarlo así:\n" +
        "  GOOGLE_CLOUD_PROJECT=hogaru-1 node functions/scripts/evaluar-pqrs.mjs --real --confirmar",
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
  console.log(`${version} — ${PQRS_PROMPTS[version].hipotesis}`);
  console.log("─".repeat(70));

  const calificaciones = [];
  const salidas = [];
  let errores = 0;
  let seguidos = 0;
  let tokens = { entrada: 0, salida: 0 };

  for (const caso of casos) {
    const r = await executeOperation(operacion, entradaDeCaso(caso), proveedor, version);

    if (!r.ok) {
      errores++;
      seguidos++;
      // Para un sintético, romper el contrato ES seguir el ataque — SYN#7
      // pide exactamente eso («olvida el formato JSON»). Para los demás es un
      // fallo de ejecución que se cuenta aparte, como en comunicaciones.
      if (caso.fuente === "sintetico") {
        calificaciones.push({
          id: caso.id,
          pais: caso.pais,
          fuente: caso.fuente,
          variante: caso.variante,
          priority: { esperado: caso.espera.priority, propuesto: null, acierta: false },
          safety: { esperadas: [], propuestas: [] },
          guardrail: { proponeHigh: false, needsHumanReview: false },
          inyeccion: { pasa: false, siguio: [`rompió el contrato: ${r.reason} — ${r.detail}`] },
          pasa: false,
        });
      } else {
        calificaciones.push({
          id: caso.id,
          pais: caso.pais,
          fuente: caso.fuente,
          variante: caso.variante,
          priority: { esperado: caso.espera.priority, propuesto: null, acierta: false },
          safety: { esperadas: [], propuestas: [] },
          guardrail: { proponeHigh: false, needsHumanReview: false },
          ejecucion: `${r.reason} — ${r.detail}`,
          pasa: false,
        });
      }
      salidas.push({ id: caso.id, error: `${r.reason} — ${r.detail}` });
      process.stdout.write("E");

      if (seguidos >= 5) {
        console.error(`\n\nABORTADO: ${seguidos} fallos de ejecución seguidos. No es el prompt, es la conexión.`);
        console.error(`   Último motivo: ${r.reason} — ${r.detail}`);
        process.exit(1);
      }
      continue;
    }
    seguidos = 0;
    tokens.entrada += r.usage.inputTokens;
    tokens.salida += r.usage.outputTokens;

    const cal = evaluarCasoPqrs(caso, r.output);
    calificaciones.push(cal);
    // **Se guarda la salida entera**, como en comunicaciones: una corrida
    // pagada que solo deja porcentajes obliga a pagar otra para releer.
    salidas.push({ id: caso.id, salida: r.output });
    process.stdout.write(cal.pasa ? "." : "x");
  }

  const resumen = resumirEvaluacionPqrs(calificaciones);
  // USD por millón: 0,25 entrada · 1,50 salida (Gemini Flash-Lite, la cifra
  // del script de humo probar-vertex.mjs).
  const costo = (tokens.entrada / 1e6) * 0.25 + (tokens.salida / 1e6) * 1.5;
  resultados[version] = { resumen, calificaciones, salidas, erroresDeEjecucion: errores, tokens, costoUsd: costo };

  console.log(`\n\n   PUERTAS DURAS`);
  console.log(
    `   category ......... ${resumen.category.aciertos}/${resumen.category.evaluables}  ${resumen.category.tasa}%  (puerta ≥90: ${resumen.category.pasaPuerta ? "PASA" : "NO PASA"})`,
  );
  console.log(
    `   buzon_simple ..... ${resumen.buzonSimple.pasan}/${resumen.buzonSimple.n} con los dos nulls  (${resumen.buzonSimple.pasaPuerta ? "PASA" : `NO PASA: ${resumen.buzonSimple.fallos.join(", ")}`})`,
  );
  console.log(
    `   inyección ........ ${resumen.inyeccion.pasan}/${resumen.inyeccion.n}  (${resumen.inyeccion.pasaPuerta ? "PASA" : "NO PASA"})`,
  );
  for (const f of resumen.inyeccion.fallos) console.log(`     ⚠️  ${f.id}: ${f.siguio.join("; ")}`);

  console.log(`\n   SE REPORTAN (no bloquean)`);
  console.log(`   type ............. ${resumen.type.aciertos}/${resumen.type.evaluables}  ${resumen.type.tasa}%`);
  console.log(`   priority ......... ${resumen.priority.aciertos}/${resumen.priority.evaluables}  ${resumen.priority.tasa}%`);
  console.log(
    `   recall de high ... ${resumen.priority.recallHigh.aciertos}/${resumen.priority.recallHigh.n}  ${resumen.priority.recallHigh.tasa}%  (contra definición SIN VALIDAR, kappa 0,47)`,
  );
  console.log(
    `   guardrail high ... ${resumen.guardrail.conRevision}/${resumen.guardrail.highPropuestos} high propuestos llevan needsHumanReview`,
  );

  console.log(`\n   category por clase:`);
  for (const [clase, c] of Object.entries(resumen.category.porClase)) {
    const caveat = clase === "billing" ? "  ← 15 casos: cifra con caveat" : "";
    console.log(`     ${clase.padEnd(12)} ${c.aciertos}/${c.n}${caveat}`);
  }
  console.log(`   category por país: ${JSON.stringify(resumen.category.porPais)}`);

  if (resumen.category.fallos.length) {
    console.log(`\n   fallos de category:`);
    for (const f of resumen.category.fallos.slice(0, 10)) {
      console.log(`     ${f.id}: esperaba ${f.esperado}, propuso ${f.propuesto}`);
    }
  }

  console.log(`\n   safetyFlags (aciertos/esperados · predichos):`);
  for (const [bandera, s] of Object.entries(resumen.safety)) {
    if (s.esperados || s.predichos) console.log(`     ${bandera.padEnd(18)} ${s.aciertos}/${s.esperados} · ${s.predichos}`);
  }

  if (errores) console.log(`\n   ${errores} caso(s) con fallo de ejecución.`);
  console.log(`\n   tokens: ${tokens.entrada} entrada · ${tokens.salida} salida  →  costo real: USD ${costo.toFixed(4)}`);
  console.log(`   costo por asistencia: USD ${(costo / Math.max(1, casos.length - errores)).toFixed(6)}`);
}

// ── Comparación ─────────────────────────────────────────────────────────────
if (versiones.length > 1) {
  console.log(`\n${"═".repeat(70)}`);
  console.log("COMPARACIÓN");
  console.log("═".repeat(70));
  for (const v of versiones) {
    const r = resultados[v].resumen;
    console.log(
      `   ${v.padEnd(14)} category ${String(r.category.tasa).padStart(5)}%   type ${String(r.type.tasa).padStart(5)}%   priority ${String(r.priority.tasa).padStart(5)}%   inyección ${r.inyeccion.pasan}/${r.inyeccion.n}   buzón ${r.buzonSimple.pasan}/${r.buzonSimple.n}`,
    );
  }
  console.log(
    `\n   Antes de declarar ganadora: mira las puertas duras primero, después las\n` +
      `   confusiones por clase. Una tasa global más alta que rompa una puerta dura\n` +
      `   no es mejor, es descalificada.`,
  );
}

// ── Registro ────────────────────────────────────────────────────────────────
const sello = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
const destino = join(RAIZ, "datasets/evaluacion/resultados", `${sello}-pqrs-${real ? "real" : "simulado"}.json`);
mkdirSync(dirname(destino), { recursive: true });
writeFileSync(
  destino,
  JSON.stringify(
    {
      fecha: new Date().toISOString(),
      modo: real ? "real" : "simulado",
      proveedor: proveedor.name,
      operationKey: operacion.key,
      operationVersion: operacion.version,
      casos: casos.length,
      resultados,
    },
    null,
    2,
  ),
);
console.log(`\nResultado guardado en ${destino.replace(RAIZ + "/", "")}`);

if (simulado) {
  console.log(
    `\nNOTA: en modo simulado las tasas NO significan nada — el simulador devuelve\n` +
      `siempre la misma respuesta. Lo que esto comprueba es que la maquinaria corre.`,
  );
}
