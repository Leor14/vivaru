// Recalificar una corrida ya pagada, sin volver a llamar al modelo (Paso 2.4).
//
// El corredor guarda el borrador ENTERO de cada caso, no solo si pasó. Este
// script existe para que eso sirva de algo: cuando una afirmación estaba mal
// escrita —o aparece una sospecha nueva— se vuelve a calificar sobre las
// mismas salidas y se sabe el número corregido **gratis y sin ruido**.
//
// Y no es solo el ahorro: repetir la llamada con el modelo a temperatura 0,2
// devolvería otras salidas, así que la corrida nueva mezclaría el efecto de la
// afirmación con el del azar. Recalificar deja fija la única variable que se
// quería cambiar.
//
// REQUIERE COMPILAR ANTES: npm --prefix functions run build
//
//   node functions/scripts/recalificar.mjs datasets/evaluacion/resultados/<archivo>.json
//   node functions/scripts/recalificar.mjs <archivo>.json --escribir
//
// Sin `--escribir` no toca nada: enseña el antes y el después por pantalla.
// Con `--escribir` guarda las calificaciones nuevas en el mismo archivo,
// dejando constancia de que se recalificó y con qué conjunto.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, "../..");

const { evaluarCaso, resumirEvaluacion } = await import(join(AQUI, "../lib/ai/evaluar.js"));

const args = process.argv.slice(2);
const ruta = args.find((a) => !a.startsWith("--"));
const escribir = args.includes("--escribir");

if (!ruta) {
  console.error("Falta el archivo de resultados. Ver la cabecera del script.");
  process.exit(1);
}

const destino = resolve(ruta);
const corrida = JSON.parse(readFileSync(destino, "utf8"));
const conjunto = JSON.parse(readFileSync(join(RAIZ, "datasets/evaluacion/comunicaciones-redactar.json"), "utf8"));
const porId = new Map(conjunto.casos.map((c) => [c.id, c]));

console.log(`\nCorrida ${corrida.fecha} · modo ${corrida.modo} · contexto ${corrida.contexto ?? "(no registrado)"}`);

for (const [version, bloque] of Object.entries(corrida.resultados)) {
  const antes = bloque.resumen.tasa;

  // Sin la salida guardada no se puede recalificar: se respeta la calificación
  // vieja y se dice en voz alta cuántas. Un recuento que mezcla casos
  // recalificados con casos heredados y no lo avisa es peor que no recalificar.
  let heredadas = 0;
  const calificaciones = bloque.calificaciones.map((c) => {
    const caso = porId.get(c.id);
    if (!caso || !c.salida) {
      heredadas++;
      return c;
    }
    return { ...evaluarCaso(caso, c.salida), salida: c.salida };
  });

  const casos = calificaciones.map((c) => porId.get(c.id)).filter(Boolean);
  const resumen = resumirEvaluacion(casos, calificaciones);

  console.log(`\n${version}`);
  console.log(`   antes: ${bloque.resumen.pasan}/${bloque.resumen.total} (${antes}%)`);
  console.log(`   ahora: ${resumen.pasan}/${resumen.total} (${resumen.tasa}%)`);
  if (heredadas) console.log(`   ⚠️  ${heredadas} sin salida guardada: se respetó su calificación anterior`);

  const antesPorId = new Map(bloque.calificaciones.map((c) => [c.id, c.pasa]));
  const movidos = calificaciones.filter((c) => antesPorId.get(c.id) !== c.pasa);
  if (movidos.length) {
    console.log(`   ${movidos.length} caso(s) cambiaron de veredicto:`);
    for (const c of movidos) {
      console.log(`     ${antesPorId.get(c.id) ? "✓→✗" : "✗→✓"}  ${c.id}`);
      for (const f of c.fallos) console.log(`            ${f.slice(0, 150)}`);
    }
  } else {
    console.log("   ningún caso cambió de veredicto");
  }

  if (escribir) {
    bloque.calificaciones = calificaciones;
    bloque.resumen = resumen;
  }
}

if (escribir) {
  // Queda escrito en el propio archivo: una corrida recalificada que no lo diga
  // se lee como si el modelo hubiera dado esos números.
  corrida.recalificaciones = [
    ...(corrida.recalificaciones ?? []),
    { conjuntoVersion: conjunto.version, casos: conjunto.casos.length, motivo: "recalificado sin volver a llamar al modelo" },
  ];
  writeFileSync(destino, JSON.stringify(corrida, null, 2));
  console.log(`\nGuardado en ${destino.replace(RAIZ + "/", "")}`);
} else {
  console.log("\n(No se escribió nada. Añade --escribir para guardar.)");
}
