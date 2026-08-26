// Corrige la ETIQUETA de unidad de una membresía cuando lleva dentro un id de
// documento — el compuesto histórico `${tower}-${docId}` que fabricaba el fallback
// del alta de residente antes de que se arreglara.
//
// POR QUÉ EXISTE, Y POR QUÉ NO ES UN PARCHE. `functions/src/index.ts` ya no lo
// produce, y su comentario lo dice con nombre y apellidos: «el fallback NUNCA debe
// incrustar el docId (antes era `${tower}-${unitId}`…)». Staging está limpio —cero
// de veintitrés—, así que lo que queda en producción es residuo escrito ANTES de
// aquel arreglo. No hay nada vivo fabricándolo; solo se puede quitar del dato.
//
// POR QUÉ NO BASTA EL RESOLVEDOR DEL FRONT. `src/utils/unitLabel.ts` recupera el
// compuesto extrayendo el docId final, y así salva casi todos. NO salva el caso que
// importa: cuando el id incrustado es de una unidad que **ya no existe**, cae a
// «Unidad no vinculada». Y además solo lo usan cuatro pantallas de administrador —
// ninguna del residente, que es justo donde la cadena se ve.
//
// QUÉ HACE. Reescribe `unitLabel` con el `displayName` del documento de unidad al
// que apunta `unitId`. Nada más.
//
// QUÉ NO HACE. **No toca `unitId`**: esa clave la fijó `FIX-002` y esto no la
// discute. No crea ni borra documentos. Y **no adivina** — si la unidad no existe,
// si su `tenantId` no concuerda con el de la membresía, o si no tiene
// `displayName`, el documento se LISTA y se queda como está. Un nombre inventado
// para enseñar es peor que un nombre feo: el feo se nota.
//
// LA VUELTA ATRÁS. Cada documento tocado guarda `unitLabelPrevio` con su valor
// anterior y `unitLabelCorregidoEn` con la fecha. `--revertir` es la simétrica.
//
// Uso:
//   node functions/scripts/corregir-etiqueta-de-unidad.mjs <projectId>
//     ... sin más            SECO: enseña qué escribiría, documento a documento
//     ... --escribir         aplica
//     ... --si-produccion    obligatorio junto a --escribir en `hogaru-1`
//     ... --revertir         deshace leyendo `unitLabelPrevio` (seco por defecto)

import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const [, , projectId, ...resto] = process.argv;
const banderas = new Set(resto.filter((a) => a.startsWith("--")));
const escribir = banderas.has("--escribir");
const revertir = banderas.has("--revertir");

if (!projectId) {
  console.error("Uso: node corregir-etiqueta-de-unidad.mjs <projectId> [--escribir] [--si-produccion] [--revertir]");
  process.exit(1);
}

// El proyecto activo de gcloud es producción. Que haya que escribirlo entero, y
// además confirmarlo, es a propósito.
if (escribir && projectId === "hogaru-1" && !banderas.has("--si-produccion")) {
  console.error("Escribir en hogaru-1 exige --si-produccion.");
  process.exit(1);
}

const CAMPO_PREVIO = "unitLabelPrevio";
const CAMPO_FECHA = "unitLabelCorregidoEn";

/** Un id autogenerado de Firestore son 20 chars alfanuméricos contiguos.
 *  Misma regla que `src/utils/unitLabel.ts`, a propósito: si el front lo lee como
 *  «esto parece un ID», esto tiene que verlo igual. */
const ID_FIRESTORE = /[A-Za-z0-9]{20}/;

initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();

const membresias = await db.collection("tenantUsers").get();
console.log(`\n${projectId} · ${membresias.size} documentos en tenantUsers\n`);

const unidades = new Map();
async function unidad(id) {
  if (!unidades.has(id)) unidades.set(id, await db.collection("units").doc(id).get());
  return unidades.get(id);
}

const plan = [];
const rechazados = [];

for (const doc of membresias.docs) {
  const d = doc.data();

  if (revertir) {
    if (typeof d[CAMPO_PREVIO] === "string") {
      plan.push({ ref: doc.ref, id: doc.id, de: d.unitLabel, a: d[CAMPO_PREVIO], nombre: d.fullName });
    }
    continue;
  }

  const { unitId, unitLabel, tenantId } = d;
  if (typeof unitId !== "string" || typeof unitLabel !== "string" || !unitId || !unitLabel) continue;

  const rota = ID_FIRESTORE.test(unitLabel) || unitLabel.includes(unitId);
  if (!rota) continue;

  const u = await unidad(unitId);
  if (!u.exists) {
    rechazados.push([doc.id, unitLabel, `la unidad ${unitId} no existe`]);
    continue;
  }
  // Un id de documento es GLOBAL: que exista no prueba que sea de este conjunto.
  if (u.data().tenantId !== tenantId) {
    rechazados.push([doc.id, unitLabel, `la unidad ${unitId} es de ${u.data().tenantId}, no de ${tenantId}`]);
    continue;
  }
  const displayName = (u.data().displayName ?? "").trim();
  if (!displayName) {
    rechazados.push([doc.id, unitLabel, `la unidad ${unitId} no tiene displayName`]);
    continue;
  }
  if (displayName === unitLabel) continue;

  plan.push({ ref: doc.ref, id: doc.id, de: unitLabel, a: displayName, nombre: d.fullName, tenantId });
}

const verbo = revertir ? "REVERTIRÍA" : "ESCRIBIRÍA";
console.log(`${escribir ? (revertir ? "REVIRTIENDO" : "ESCRIBIENDO") : `EN SECO — ${verbo}`}: ${plan.length} documentos\n`);

for (const p of plan) {
  console.log(`  ${p.nombre ?? "(sin nombre)"}`);
  console.log(`      de:  ${p.de}`);
  console.log(`      a:   ${p.a}`);
}

if (rechazados.length) {
  console.log(`\n  NO SE TOCAN (${rechazados.length}) — se listan y se quedan como están:`);
  for (const [id, lab, por] of rechazados) console.log(`      ${id}\n          ${lab}  →  ${por}`);
}

if (!escribir) {
  console.log(`\n  En seco. Añade --escribir para aplicar.\n`);
  process.exit(0);
}

let batch = db.batch();
let ops = 0;
for (const p of plan) {
  batch.update(
    p.ref,
    revertir
      ? { unitLabel: p.a, [CAMPO_PREVIO]: FieldValue.delete(), [CAMPO_FECHA]: FieldValue.delete() }
      : { unitLabel: p.a, [CAMPO_PREVIO]: p.de, [CAMPO_FECHA]: FieldValue.serverTimestamp() },
  );
  if (++ops % 400 === 0) {
    await batch.commit();
    batch = db.batch();
  }
}
if (ops % 400 !== 0) await batch.commit();

console.log(`\n  ${ops} documentos escritos.`);

// Releer es la única forma de saber que quedó. El commit sin error no lo prueba.
let confirmados = 0;
for (const p of plan) {
  const ahora = (await p.ref.get()).data();
  if (ahora.unitLabel === p.a) confirmados++;
  else console.log(`  NO CUADRA: ${p.id} dice ${ahora.unitLabel}, se esperaba ${p.a}`);
}
console.log(`  ${confirmados}/${plan.length} releídos y confirmados.\n`);
