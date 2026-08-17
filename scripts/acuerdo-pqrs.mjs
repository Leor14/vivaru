// Doble etiquetado del gold set de PQRS: genera la muestra a ciegas y mide el
// acuerdo.
//
// POR QUÉ EXISTE: un gold set etiquetado por una sola persona mide la
// consistencia de esa persona. Si dos anotadores independientes no coinciden,
// el problema no es «etiquetar mejor» — es que la definición está mal escrita, y
// el modelo tampoco va a poder cumplirla.
//
// SE MIDE CON KAPPA DE COHEN, no con porcentaje bruto. El bruto sobreestima
// porque incluye el acuerdo que ocurre por azar: si `petition` se lleva la mitad
// de los casos, dos anotadores que contestaran «petition» siempre coincidirían
// el 50% de las veces sin haber leído nada.
//
//   node scripts/acuerdo-pqrs.mjs --generar 36   # crea la muestra en blanco
//   node scripts/acuerdo-pqrs.mjs --medir        # compara y calcula kappa
//
// LA MUESTRA ES CIEGA POR DISCIPLINA, NO POR CANDADO: `gold-set.json` está en el
// mismo repositorio y tiene las respuestas. Mirarlo antes de rellenar invalida
// la medición y no hay forma técnica de impedirlo.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";

const RUTA_MUESTRA = "datasets/pqrs/doble-etiquetado/muestra.tsv";
const conjunto = JSON.parse(readFileSync("datasets/pqrs/gold-set.json", "utf8"));

function generar(n) {
  // Paso fijo, no aleatorio: la misma muestra en cada corrida. Con
  // Math.random, regenerar el archivo cambiaría los casos y la medición
  // dejaría de ser repetible.
  const casos = conjunto.casos;
  const paso = Math.max(1, Math.floor(casos.length / n));
  const elegidos = [];
  for (let i = 0; i < casos.length && elegidos.length < n; i += paso) elegidos.push(casos[i]);

  mkdirSync("datasets/pqrs/doble-etiquetado", { recursive: true });
  const filas = [
    "# Rellena las cuatro columnas vacías SIN mirar gold-set.json.",
    `# category: ${["pqrs", "maintenance", "billing"].join(" | ")}`,
    `# type: petition (pide algo) | complaint (queja de una PERSONA) | claim (reclamo de un SERVICIO) | suggestion | other`,
    "# priority: low | medium | high — por consecuencia de esperar, no por tono",
    "# tema: agua cuotas_pagos asamblea_administracion obra_mantenimiento elevadores",
    "#       seguridad_porteria luz_electricidad convivencia_ruido amenidades",
    "#       accesos_estacionamiento limpieza_basura",
    "#",
    "# id\tcategory\ttype\tpriority\ttema\ttexto (no editar)",
  ];
  for (const c of elegidos) {
    const previo = (c.contextoPrevio ?? [])
      .map((p) => `[${p.autor}] ${p.texto.replace(/\s+/g, " ")}`)
      .join(" // ");
    const texto = c.texto.replace(/\s+/g, " ");
    filas.push(`${c.id}\t\t\t\t\t${previo ? `CONTEXTO: ${previo} ▶ ` : ""}${texto}`);
  }
  writeFileSync(RUTA_MUESTRA, `${filas.join("\n")}\n`);
  console.log(`\nEscritos ${elegidos.length} casos en ${RUTA_MUESTRA}`);
  console.log("Rellena category, type, priority y tema, y luego: node scripts/acuerdo-pqrs.mjs --medir\n");
}

/** Kappa de Cohen entre dos listas de etiquetas alineadas. */
function kappa(a, b) {
  const n = a.length;
  if (!n) return { po: 0, pe: 0, k: 0, n: 0 };
  const po = a.filter((x, i) => x === b[i]).length / n;
  const etiquetas = new Set([...a, ...b]);
  let pe = 0;
  for (const e of etiquetas) {
    pe += (a.filter((x) => x === e).length / n) * (b.filter((x) => x === e).length / n);
  }
  return { po, pe, k: pe === 1 ? 1 : (po - pe) / (1 - pe), n };
}

function medir(ruta = RUTA_MUESTRA) {
  if (!existsSync(ruta)) {
    console.error(`No existe ${ruta}. Genérala con --generar 36`);
    process.exit(1);
  }
  const porId = Object.fromEntries(conjunto.casos.map((c) => [c.id, c.espera]));
  const lineas = readFileSync(ruta, "utf8").split("\n");

  // Las columnas salen de la cabecera, no de una posición fija: la segunda
  // muestra solo re-etiqueta `type` y `priority` —`category` y `tema` quedaron
  // validados el 15 ago 2026— y una muestra parcial no puede obligar a rellenar
  // ejes que ya no se miden.
  const cabecera = lineas.find((l) => /^#\s*id\t/.test(l));
  if (!cabecera) { console.error(`\n${ruta} no tiene cabecera '# id<tab>...'\n`); process.exit(1); }
  const columnas = cabecera.replace(/^#\s*/, "").split("\t").map((c) => c.trim());
  const EJES_POSIBLES = ["category", "type", "priority", "tema"];
  const ejes = columnas.filter((c) => EJES_POSIBLES.includes(c));
  if (!ejes.length) { console.error(`\n${ruta} no declara ningún eje medible\n`); process.exit(1); }

  const mio = Object.fromEntries(ejes.map((e) => [e, []]));
  const suyo = Object.fromEntries(ejes.map((e) => [e, []]));
  const discrepancias = [];
  let sinRellenar = 0;

  for (const linea of lineas) {
    if (!linea.trim() || linea.startsWith("#")) continue;
    const celdas = linea.split("\t");
    const id = celdas[0];
    const esperado = porId[id];
    if (!esperado) { console.error(`Identificador desconocido: ${id}`); continue; }
    const suyos = Object.fromEntries(ejes.map((e) => [e, celdas[columnas.indexOf(e)]]));
    if (ejes.some((e) => !suyos[e]?.trim())) { sinRellenar += 1; continue; }
    for (const e of ejes) {
      mio[e].push(esperado[e]);
      suyo[e].push(suyos[e].trim());
      if (esperado[e] !== suyos[e].trim()) {
        discrepancias.push({ id, eje: e, mio: esperado[e], suyo: suyos[e].trim() });
      }
    }
  }

  if (sinRellenar) console.log(`\n(${sinRellenar} casos sin rellenar, no se cuentan)`);
  if (!mio[ejes[0]].length) { console.error("\nNo hay ni un caso rellenado.\n"); process.exit(1); }

  // Umbrales de la taxonomía. `priority` va más bajo a propósito: es el eje más
  // subjetivo, y fingir que se le puede exigir lo mismo no lo mejora.
  const UMBRAL = { category: 0.7, type: 0.7, tema: 0.7, priority: 0.6 };
  console.log(`\n${"═".repeat(60)}`);
  console.log(`ACUERDO — ${mio[ejes[0]].length} casos · ${ruta}`);
  console.log(`${"═".repeat(60)}`);
  console.log(`  ${"eje".padEnd(12)} ${"bruto".padStart(7)} ${"kappa".padStart(7)} ${"umbral".padStart(7)}`);
  let algunoFalla = false;
  for (const e of ejes) {
    const r = kappa(mio[e], suyo[e]);
    const ok = r.k >= UMBRAL[e];
    if (!ok) algunoFalla = true;
    console.log(`  ${e.padEnd(12)} ${`${Math.round(r.po * 100)}%`.padStart(7)} ${r.k.toFixed(2).padStart(7)} ${UMBRAL[e].toFixed(2).padStart(7)}  ${ok ? "✓" : "✗"}`);
  }

  if (discrepancias.length) {
    console.log(`\nDiscrepancias (${discrepancias.length}) — cada una es una definición que se puede afilar:`);
    for (const d of discrepancias) console.log(`  ${d.id.padEnd(9)} ${d.eje.padEnd(9)} yo: ${String(d.mio).padEnd(24)} tú: ${d.suyo}`);
  }

  if (algunoFalla) {
    console.log("\nUn eje por debajo de su umbral NO significa «etiquetar mejor»:");
    console.log("significa que su definición está mal escrita. Se reescribe en");
    console.log("taxonomia.md, se vuelve a etiquetar la muestra, y se anota qué cambió.\n");
  } else {
    console.log(`\nLos ejes medidos (${ejes.join(", ")}) pasan.\n`);
  }
}

const i = process.argv.indexOf("--generar");
const j = process.argv.indexOf("--muestra");
if (i !== -1) generar(Number(process.argv[i + 1] ?? 36));
else if (process.argv.includes("--medir")) medir(j !== -1 ? process.argv[j + 1] : undefined);
else {
  console.error("Uso: node scripts/acuerdo-pqrs.mjs --generar 36 | --medir [--muestra <ruta>]");
  process.exit(1);
}
