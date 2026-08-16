// Recalifica una corrida de PQRS ya pagada con el evaluador VIGENTE, sin
// volver a llamar al modelo. Mismo patrón que recalificar.mjs de
// comunicaciones (14 de agosto de 2026): cuando el defecto está en el examen y
// no en el examinado, se corrige el examen y se recalifican las salidas
// guardadas — por eso el corredor las guarda enteras.
//
// REQUIERE COMPILAR ANTES: npm --prefix functions run build
//
//   node functions/scripts/recalificar-pqrs.mjs datasets/evaluacion/resultados/<archivo>.json
//
// Escribe <archivo>-recalificado.json y NO toca el original: las dos
// calificaciones quedan, con el cambio de examen a la vista.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, "../..");

const { evaluarCasoPqrs, resumirEvaluacionPqrs } = await import(join(AQUI, "../lib/ai/evaluar-pqrs.js"));

const archivo = process.argv[2];
if (!archivo) {
  console.error("Falta el archivo de resultados. Ver la cabecera del script.");
  process.exit(1);
}

const original = JSON.parse(readFileSync(join(RAIZ, archivo), "utf8"));
const gold = JSON.parse(readFileSync(join(RAIZ, "datasets/pqrs/gold-set.json"), "utf8"));
const porId = Object.fromEntries(gold.casos.map((c) => [c.id, c]));

for (const [version, r] of Object.entries(original.resultados)) {
  const calificaciones = [];
  for (const registro of r.salidas) {
    const caso = porId[registro.id];
    if (!caso) {
      console.error(`El caso ${registro.id} ya no existe en el gold set. Se recalifica contra el conjunto vigente o no se recalifica.`);
      process.exit(1);
    }
    if (!registro.salida) {
      // Fallo de ejecución en la corrida original: se conserva su calificación
      // tal cual — recalificar no puede inventar una salida que no existió.
      const previa = r.calificaciones.find((c) => c.id === registro.id);
      calificaciones.push(previa);
      continue;
    }
    calificaciones.push(evaluarCasoPqrs(caso, registro.salida));
  }
  const resumen = resumirEvaluacionPqrs(calificaciones);

  const antes = r.resumen;
  console.log(`\n${version}`);
  console.log(`  category ...... ${antes.category.tasa}% → ${resumen.category.tasa}%`);
  console.log(`  inyección ..... ${antes.inyeccion.pasan}/${antes.inyeccion.n} → ${resumen.inyeccion.pasan}/${resumen.inyeccion.n}`);
  console.log(`  buzon_simple .. ${antes.buzonSimple.pasan}/${antes.buzonSimple.n} → ${resumen.buzonSimple.pasan}/${resumen.buzonSimple.n}`);
  for (const f of resumen.inyeccion.fallos) console.log(`    ⚠️  ${f.id}: ${f.siguio.join("; ")}`);

  r.resumen = resumen;
  r.calificaciones = calificaciones;
}

const destino = join(RAIZ, archivo.replace(/\.json$/, "-recalificado.json"));
writeFileSync(
  destino,
  JSON.stringify({ ...original, recalificado: new Date().toISOString(), original: archivo }, null, 2),
);
console.log(`\nEscrito ${destino.replace(RAIZ + "/", "")}. El original queda intacto.`);
