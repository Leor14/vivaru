// Retira las DOS marcas temporales que dejó la migración de `PRD-V-FIX-002`:
// `unitIdPrevio` y `unitIdMigradoEn`.
//
// ESTO DESTRUYE LA VUELTA ATRÁS DE LA MIGRACIÓN, Y ESE ES EXACTAMENTE SU OBJETO.
// `clave-de-unidad.ts` lo dice: «sin `unitIdPrevio` no hay rollback — el valor
// viejo y el nuevo son los dos plausibles y no hay forma de reconstruir cuál era».
// Después de correr esto con `--escribir`, `migrar-claves-de-unidad.mjs --revertir`
// deja de poder deshacer nada. Por eso la ficha lo llama «una decisión aparte con
// su propia fecha» (§7.2) y no un paso más de la migración.
//
// LO QUE NO TOCA, Y NO ES PRECAUCIÓN SINO SIGNIFICADO:
//   · `unitIdHuerfanoArchivadoEn` y `unitIdHuerfanoMotivo` — no son rollback, son
//     la decisión D2 escrita en el documento. Borrarlas reabriría la pregunta
//     entera dentro de un año, que es justo lo que el motivo obligatorio evita.
//   · `unitLabelPrevio` y `unitLabelCorregidoEn` — son de otra corrección, más
//     reciente, y su vuelta atrás sigue viva.
//
// LA GUARDA. Antes de escribir comprueba que **cada documento marcado apunta hoy a
// una unidad que existe**. Volver irreversible una migración que dejó algo
// colgando sería encerrar el error: si aparece uno solo, esto se planta y lo
// lista. Un criterio sobre el paso —«la migración terminó»— no valdría; el
// criterio va sobre el dato.
//
// Uso:
//   node functions/scripts/retirar-marcas-de-migracion.mjs <projectId>
//     ... sin más            SECO: cuenta las marcas por colección y corre la guarda
//     ... --escribir         retira
//     ... --si-produccion    obligatorio junto a --escribir en `hogaru-1`

import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

import {
  COLECCIONES_CON_CLAVE_DE_UNIDAD,
  CAMPO_PREVIO,
  CAMPO_MIGRADO_EN,
} from "../lib/clave-de-unidad.js";

const [, , projectId, ...resto] = process.argv;
const banderas = new Set(resto.filter((a) => a.startsWith("--")));
const escribir = banderas.has("--escribir");

if (!projectId) {
  console.error("Uso: node retirar-marcas-de-migracion.mjs <projectId> [--escribir] [--si-produccion]");
  process.exit(1);
}
if (escribir && projectId === "hogaru-1" && !banderas.has("--si-produccion")) {
  console.error("Escribir en hogaru-1 exige --si-produccion.");
  process.exit(1);
}

initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();

console.log(`\n${projectId} · ${COLECCIONES_CON_CLAVE_DE_UNIDAD.length} colecciones con clave de unidad\n`);

// El catálogo de unidades vivas, para la guarda. `units` es una colección RAÍZ:
// el id de documento es global, así que se compara además el conjunto.
const unidades = new Map();
const snapUnidades = await db.collection("units").get();
for (const u of snapUnidades.docs) unidades.set(u.id, u.data().tenantId ?? null);
console.log(`  catálogo: ${unidades.size} unidades leídas\n`);

const marcados = [];
const colgando = [];
const sueltas = [];
let leidos = 0;

for (const col of COLECCIONES_CON_CLAVE_DE_UNIDAD) {
  const snap = await db.collection(col.nombre).get();
  leidos += snap.size;
  let n = 0;
  for (const doc of snap.docs) {
    const d = doc.data();
    const tienePrevio = typeof d[CAMPO_PREVIO] === "string";
    const tieneFecha = d[CAMPO_MIGRADO_EN] !== undefined;
    if (!tienePrevio && !tieneFecha) continue;
    n++;
    if (tienePrevio !== tieneFecha) sueltas.push([col.nombre, doc.id, tienePrevio ? CAMPO_PREVIO : CAMPO_MIGRADO_EN]);

    const clave = d[col.campoClave];
    const dueño = unidades.get(clave);
    if (dueño === undefined) colgando.push([col.nombre, doc.id, clave, "la unidad no existe"]);
    else if (d.tenantId && dueño && d.tenantId !== dueño) colgando.push([col.nombre, doc.id, clave, `la unidad es de ${dueño}, no de ${d.tenantId}`]);
    else marcados.push({ ref: doc.ref, coleccion: col.nombre, id: doc.id });
  }
  console.log(`  ${col.nombre.padEnd(34)} ${String(snap.size).padStart(5)} leídos · ${String(n).padStart(4)} con marca`);
}

console.log(`\n  ${leidos} documentos leídos en total · ${marcados.length + colgando.length} con marca`);
if (sueltas.length) {
  console.log(`\n  MARCA SUELTA (${sueltas.length}) — tienen una de las dos y no la otra:`);
  for (const [c, id, campo] of sueltas) console.log(`      ${c}/${id} — solo ${campo}`);
}

if (colgando.length) {
  console.log(`\n  LA GUARDA SE PLANTA: ${colgando.length} documento(s) marcados NO apuntan a una unidad válida.`);
  for (const [c, id, clave, por] of colgando) console.log(`      ${c}/${id} → ${clave} — ${por}`);
  console.log(`\n  No se retira nada. Volver irreversible esto encerraría el error.\n`);
  process.exit(1);
}

// Una guarda que se declara «en verde» sobre CERO documentos no ha verificado
// nada: es la puerta que se abre sobre un conjunto vacío. Se dice cuántos casos
// cruzó antes de llamarla verde, y con cero se dice que no hay nada que hacer.
if (marcados.length === 0) {
  console.log(`\n  No hay marcas que retirar. La guarda no llegó a evaluarse — cero casos.`);
  process.exit(0);
}
console.log(`\n  Guarda EN VERDE sobre ${marcados.length} casos: todos apuntan a una unidad viva de su conjunto.`);

if (!escribir) {
  console.log(`\n  En seco. Añade --escribir para retirar las marcas.`);
  console.log(`  OJO: después de retirarlas, --revertir de la migración ya no puede deshacer nada.\n`);
  process.exit(0);
}

let batch = db.batch();
let ops = 0;
for (const m of marcados) {
  batch.update(m.ref, { [CAMPO_PREVIO]: FieldValue.delete(), [CAMPO_MIGRADO_EN]: FieldValue.delete() });
  if (++ops % 400 === 0) {
    await batch.commit();
    batch = db.batch();
  }
}
if (ops % 400 !== 0) await batch.commit();
console.log(`\n  ${ops} documentos escritos.`);

// Releer: el commit sin error no prueba que quedara.
let quedan = 0;
for (const m of marcados) {
  const d = (await m.ref.get()).data();
  if (typeof d[CAMPO_PREVIO] === "string" || d[CAMPO_MIGRADO_EN] !== undefined) {
    quedan++;
    console.log(`  TODAVÍA MARCADO: ${m.coleccion}/${m.id}`);
  }
}
console.log(`  ${marcados.length - quedan}/${marcados.length} releídos y sin marca.\n`);
