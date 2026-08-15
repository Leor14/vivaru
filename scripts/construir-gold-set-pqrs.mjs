// Construye `datasets/pqrs/gold-set.json` a partir de las etiquetas y los
// corpus.
//
// POR QUÉ NO SE ESCRIBE EL JSON A MANO: el texto de cada caso tiene que ser el
// del corpus, palabra por palabra. Tecleándolo se cuela una corrección
// ortográfica sin querer —y la mala ortografía es justo lo que hace útil el
// material— o se cita un mensaje que no dice exactamente eso. Aquí las
// etiquetas viven en un TSV que una persona puede revisar, y **el texto lo pone
// el corpus**.
//
// Uso:
//   node scripts/construir-gold-set-pqrs.mjs            # escribe el JSON
//   node scripts/construir-gold-set-pqrs.mjs --revisar  # solo comprueba
//
// Falla si un identificador no existe, si está repetido, o si una etiqueta no
// pertenece a su catálogo. Un caso mal formado tiene que romper aquí y no el
// día de la evaluación.

import { readFileSync, writeFileSync } from "node:fs";
import { parsear, norm } from "./lib/whatsapp.mjs";
import { TEMAS, esAdmin } from "./lib/temas-pqrs.mjs";

const CATEGORIAS = ["pqrs", "maintenance", "billing"];
const TIPOS = ["petition", "complaint", "claim", "suggestion", "other"];
const PRIORIDADES = ["low", "medium", "high"];
// Las cuatro primeras son `safetyFlags` de la PRD —salida del modelo—; las
// cuatro últimas son metadatos de muestreo. Ver la taxonomía: mezclarlas
// contamina la métrica.
const BANDERAS = [
  "amenaza", "dato_sensible", "lenguaje_ofensivo", "posible_urgencia",
  "sin_contexto", "multi_tema", "dato_faltante", "prompt_injection", "enfado",
];

const CORPUS = {
  MX: "datasets/chat-vecinal/chat-anonimizado.txt",
  EC: "datasets/chat-vecinal-ecuador/chat-anonimizado.txt",
};

const mensajes = Object.fromEntries(
  Object.entries(CORPUS).map(([pais, ruta]) => [pais, parsear(readFileSync(ruta, "utf8"))]),
);

const errores = [];
const vistos = new Set();
const casos = [];

const lineas = readFileSync("datasets/pqrs/etiquetas.tsv", "utf8").split("\n");
for (const [n, linea] of lineas.entries()) {
  if (!linea.trim() || linea.startsWith("«")) continue;
  const [id, category, type, priority, tema, secundarios, banderas, porQue] = linea.split("\t");
  const donde = `etiquetas.tsv:${n + 1} (${id})`;

  if (vistos.has(id)) errores.push(`${donde}: identificador repetido`);
  vistos.add(id);

  const [pais, indice] = (id ?? "").split("#");
  const mensaje = mensajes[pais]?.[Number(indice)];
  if (!mensaje) {
    errores.push(`${donde}: no existe ese mensaje en el corpus`);
    continue;
  }
  // Un caso etiquetado como voz de residente que en realidad escribió la
  // administración mediría el género equivocado. Ver ANUNCIA en lib/.
  if (esAdmin(mensaje.autor, norm)) errores.push(`${donde}: lo escribió la administración`);

  if (!CATEGORIAS.includes(category)) errores.push(`${donde}: category «${category}»`);
  if (!TIPOS.includes(type)) errores.push(`${donde}: type «${type}»`);
  if (!PRIORIDADES.includes(priority)) errores.push(`${donde}: priority «${priority}»`);
  if (!TEMAS[tema]) errores.push(`${donde}: tema «${tema}»`);

  const secundariosLista = (secundarios ?? "").trim() ? secundarios.trim().split(/\s+/) : [];
  for (const s of secundariosLista) if (!TEMAS[s]) errores.push(`${donde}: tema secundario «${s}»`);
  const banderasLista = (banderas ?? "").trim() ? banderas.trim().split(/\s+/) : [];
  for (const b of banderasLista) if (!BANDERAS.includes(b)) errores.push(`${donde}: bandera «${b}»`);
  if (!porQue?.trim()) errores.push(`${donde}: falta el porQue`);

  // Los casos marcados `sin_contexto` llevan el hilo previo: solos son
  // inclasificables, y esa es toda la razón de que estén en el conjunto.
  const contextoPrevio = banderasLista.includes("sin_contexto")
    ? mensajes[pais]
        .slice(Math.max(0, Number(indice) - 3), Number(indice))
        .map((m) => ({ autor: esAdmin(m.autor, norm) ? "administracion" : "residente", texto: m.texto }))
    : undefined;

  casos.push({
    id,
    fuente: pais === "MX" ? "chat-vecinal" : "chat-vecinal-ecuador",
    pais,
    fecha: mensaje.fecha,
    texto: mensaje.texto,
    ...(contextoPrevio ? { contextoPrevio } : {}),
    // `con_sla` es el valor por defecto del producto; los casos de la otra
    // variante se declaran a mano cuando se añadan. Ver la taxonomía.
    variante: "con_sla",
    espera: {
      category,
      type,
      priority,
      tema,
      ...(secundariosLista.length ? { temasSecundarios: secundariosLista } : {}),
      ...(banderasLista.length ? { banderas: banderasLista } : {}),
    },
    porQue: porQue.trim(),
  });
}

const sinteticos = JSON.parse(readFileSync("datasets/pqrs/sinteticos.json", "utf8"));
for (const s of sinteticos.casos) {
  if (vistos.has(s.id)) errores.push(`sinteticos.json (${s.id}): identificador repetido`);
  vistos.add(s.id);
  if (!CATEGORIAS.includes(s.category)) errores.push(`sinteticos.json (${s.id}): category`);
  if (!TIPOS.includes(s.type)) errores.push(`sinteticos.json (${s.id}): type`);
  if (!PRIORIDADES.includes(s.priority)) errores.push(`sinteticos.json (${s.id}): priority`);
  if (!TEMAS[s.tema]) errores.push(`sinteticos.json (${s.id}): tema`);
  for (const b of s.banderas ?? []) if (!BANDERAS.includes(b)) errores.push(`sinteticos.json (${s.id}): bandera «${b}»`);

  casos.push({
    id: s.id,
    fuente: "sintetico",
    pais: null,
    texto: s.texto,
    variante: "con_sla",
    espera: { category: s.category, type: s.type, priority: s.priority, tema: s.tema, banderas: s.banderas },
    porQue: s.porQue,
  });
}

if (errores.length) {
  console.error(`\n${errores.length} problema(s):\n`);
  for (const e of errores) console.error(`  · ${e}`);
  process.exit(1);
}

const cuenta = (f) => casos.reduce((a, c) => { const k = f(c); a[k] = (a[k] ?? 0) + 1; return a; }, {});
const porBandera = {};
for (const c of casos) for (const b of c.espera.banderas ?? []) porBandera[b] = (porBandera[b] ?? 0) + 1;

console.log(`\ncasos ............ ${casos.length}`);
console.log(`por país ......... ${JSON.stringify(cuenta((c) => c.pais ?? "sintetico"))}`);
console.log(`por category ..... ${JSON.stringify(cuenta((c) => c.espera.category))}`);
console.log(`por type ......... ${JSON.stringify(cuenta((c) => c.espera.type))}`);
console.log(`por priority ..... ${JSON.stringify(cuenta((c) => c.espera.priority))}`);
console.log(`banderas ......... ${JSON.stringify(porBandera)}`);
const temas = cuenta((c) => c.espera.tema);
console.log(`temas ............ ${JSON.stringify(temas)}`);
const flojos = Object.entries(temas).filter(([, n]) => n < 3).map(([t]) => t);
if (flojos.length) console.log(`\nAVISO — temas con menos de 3 casos: ${flojos.join(", ")}`);
const faltan = Object.keys(TEMAS).filter((t) => !temas[t]);
if (faltan.length) console.log(`AVISO — temas sin ningún caso: ${faltan.join(", ")}`);

if (process.argv.includes("--revisar")) {
  console.log("\nSolo revisión: no se escribió nada.\n");
  process.exit(0);
}

const salida = {
  operationKey: "pqrs-clasificar",
  version: 1,
  creado: "2026-08-15",
  nota: "Ver taxonomia.md. Las etiquetas viven en etiquetas.tsv y el texto lo pone el corpus: este archivo se GENERA con scripts/construir-gold-set-pqrs.mjs y no se edita a mano. Los tres primeros ejes son el contrato de PRD-VAI-FEAT-002; el tema es el aporte de los dos corpus. Dos edificios no son dos mercados: las frecuencias no son las del mercado y Colombia sigue sin corpus.",
  casos,
};
writeFileSync("datasets/pqrs/gold-set.json", `${JSON.stringify(salida, null, 2)}\n`);
console.log(`\nEscrito datasets/pqrs/gold-set.json con ${casos.length} casos.\n`);
