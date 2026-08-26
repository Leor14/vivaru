// La migración de `PRD-V-FIX-002` — **conjunto a conjunto, en seco por defecto**.
//
// QUÉ HACE. Lleva todo documento que nombre una unidad con la convención vieja
// —el campo `unitId` de la unidad, que es un slug— a la ganadora: **el id del
// documento** (D1, cerrada el 25 de agosto de 2026). Recorre las DIECIOCHO
// colecciones con clave de unidad, y `tenantUsers` va **en la misma pasada** (R8):
// migrarla aparte es exactamente el error que dejó la migración anterior peor que
// antes, con el dato apuntando a un lado y el permiso al otro.
//
// QUÉ NO HACE. **No crea, no borra y no mueve documentos** (R7): solo reescribe la
// clave y deja constancia. **No adivina** (R2): un documento cuya clave no casa con
// ninguna unidad solo se reasigna si EXACTAMENTE UNA unidad del conjunto lleva su
// etiqueta; con cero o con varias se lista y se queda como está. Y **no toca
// `unitLabel`** ni el campo `unitId` del documento de la unidad.
//
// LO QUE HACE QUE ESTO SE PUEDA DESHACER. Cada documento tocado guarda
// `unitIdPrevio` con su valor anterior y `unitIdMigradoEn` con la fecha (R3). **Sin
// `unitIdPrevio` no hay vuelta atrás**: el valor viejo y el nuevo son los dos
// plausibles y la convención anterior no se puede reconstruir. Por eso no es una
// comodidad, es la condición que hace ejecutable la ficha — y por eso existe
// `--revertir`, que es la operación simétrica.
//
// Uso:
//   node functions/scripts/migrar-claves-de-unidad.mjs <projectId> <tenantId>
//     ... sin más                      SECO: enseña qué escribiría, documento a documento
//     ... --informe <ruta> --escribir  aplica
//     ... --si-produccion              obligatorio junto a --escribir en `hogaru-1`
//     ... --revertir                   deshace, leyendo `unitIdPrevio` (seco por defecto)
//
// El informe lo produce `informe-claves-de-unidad.mjs --json <ruta>`. **Escribir sin
// él está prohibido** (CF4), y si el dato se movió entre uno y otro la huella no
// casa y esto se planta: un plan que ya no describe la realidad no se aplica.

import { readFileSync } from "node:fs";

import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

import {
  CAMPO_MIGRADO_EN,
  CAMPO_PREVIO,
  camposDeLaEscritura,
} from "../lib/clave-de-unidad.js";
import { dinero, huellaDe, radiografiarConjunto } from "./lib/claves-de-unidad.mjs";

const [, , projectId, ...resto] = process.argv;

/** `--informe <ruta>` consume el siguiente argumento; el suelto que quede es el conjunto. */
function leerArgumentos(args) {
  const banderas = new Set();
  const sueltos = [];
  let rutaInforme = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--informe") {
      rutaInforme = args[++i] ?? null;
    } else if (args[i].startsWith("--")) {
      banderas.add(args[i]);
    } else {
      sueltos.push(args[i]);
    }
  }
  return { banderas, sueltos, rutaInforme };
}

const { banderas, sueltos, rutaInforme } = leerArgumentos(resto);
const tenantId = sueltos[0];

const escribir = banderas.has("--escribir");
const revertir = banderas.has("--revertir");
const siProduccion = banderas.has("--si-produccion");
const ES_PRODUCCION = projectId === "hogaru-1";

if (!projectId || !tenantId) {
  console.error("Uso: node migrar-claves-de-unidad.mjs <projectId> <tenantId> [--informe <ruta>] [--escribir] [--si-produccion] [--revertir]");
  process.exit(1);
}
// CF3 · contra producción, sin la bandera explícita, no se escribe.
if (ES_PRODUCCION && escribir && !siProduccion) {
  console.error("Esto es PRODUCCIÓN. Añade --si-produccion si de verdad es lo que quieres.");
  process.exit(1);
}
// CF4 · escribir sin haber corrido el informe, rechazado.
if (escribir && !revertir && !rutaInforme) {
  console.error(
    "Falta --informe <ruta>. Primero se mira y después se toca:\n" +
      `  node functions/scripts/informe-claves-de-unidad.mjs ${projectId} ${tenantId} --json informe.json`,
  );
  process.exit(1);
}

initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();

// **Un conjunto que no existe no es un conjunto vacío.** Sin esto, un tenantId mal
// escrito respondía «no tiene unidades, se salta» y salía con éxito: se leería como
// «ya estaba migrado» cuando no se miró nada.
const conjunto = await db.collection("tenants").doc(tenantId).get();
if (!conjunto.exists) {
  console.error(`No existe el conjunto «${tenantId}» en ${projectId}. ¿Un dedo de más?`);
  process.exit(1);
}

// ── Revertir ──────────────────────────────────────────────────────────────────
// La operación simétrica: donde hay `unitIdPrevio`, se devuelve el valor y se
// borran las dos marcas. Un documento sin `unitIdPrevio` no se ha migrado y no se
// toca — es la misma frontera que hace que la migración sea reversible.
if (revertir) {
  const { COLECCIONES_CON_CLAVE_DE_UNIDAD } = await import("./lib/claves-de-unidad.mjs");
  let vistos = 0;
  let batch = db.batch();
  let ops = 0;
  for (const coleccion of [...COLECCIONES_CON_CLAVE_DE_UNIDAD].reverse()) {
    const snap = await db.collection(coleccion.nombre).where("tenantId", "==", tenantId).get();
    for (const d of snap.docs) {
      const previo = d.data()[CAMPO_PREVIO];
      if (typeof previo !== "string" || !previo) continue;
      vistos += 1;
      console.log(`  ← ${coleccion.nombre}/${d.id}  ${d.data()[coleccion.campoClave]} → ${previo}`);
      if (!escribir) continue;
      batch.update(d.ref, {
        [coleccion.campoClave]: previo,
        [CAMPO_PREVIO]: FieldValue.delete(),
        [CAMPO_MIGRADO_EN]: FieldValue.delete(),
      });
      if ((ops += 1) >= 400) {
        await batch.commit();
        batch = db.batch();
        ops = 0;
      }
    }
  }
  if (escribir && ops > 0) await batch.commit();
  console.log(`\n${vistos} documento(s) con \`${CAMPO_PREVIO}\`. ${escribir ? "REVERTIDOS." : "SECO: no se escribió nada."}`);
  process.exit(0);
}

// ── Migrar ────────────────────────────────────────────────────────────────────
console.log(`\nMIGRACIÓN DE CLAVES DE UNIDAD · ${projectId} · ${tenantId}`);
console.log(escribir ? "MODO: ESCRIBIENDO\n" : "MODO: SECO — no se escribe nada (CA3)\n");

const r = await radiografiarConjunto(db, tenantId);

if (r.unidades === 0) {
  console.log("El conjunto no tiene unidades. Se salta, y queda dicho (§5.2).");
  process.exit(0);
}

if (escribir) {
  // «¿El resultado cuadra con el informe?» (§5.1). Si el dato se movió entre que
  // se miró y que se escribe, el plan describe otra realidad y no se aplica.
  const informe = JSON.parse(readFileSync(rutaInforme, "utf8"));
  const delConjunto = (informe.conjuntos ?? []).find((c) => c.tenantId === tenantId);
  if (!delConjunto) {
    console.error(`El informe ${rutaInforme} no contiene a ${tenantId}. Córrelo para este conjunto.`);
    process.exit(1);
  }
  if (delConjunto.huella !== r.huella) {
    console.error(
      "EL DATO SE MOVIÓ desde que se corrió el informe.\n" +
        `  informe: ${delConjunto.huella}\n  ahora:   ${r.huella}\n` +
        "Vuelve a correr el informe, míralo, y repite.",
    );
    process.exit(1);
  }
  console.log(`Informe ${rutaInforme} verificado: la huella coincide (${r.huella.slice(0, 12)}…).\n`);
}

const porColeccion = new Map();
for (const e of r.escrituras) porColeccion.set(e.coleccion, [...(porColeccion.get(e.coleccion) ?? []), e]);

console.log(`${r.escrituras.length} documento(s) a reescribir · ${r.huerfanos.length} huérfano(s) y ${r.ambiguos.length} ambiguo(s) que NO se tocan\n`);

let batch = db.batch();
let ops = 0;
let escritos = 0;
const flush = async () => {
  if (ops > 0) {
    await batch.commit();
    batch = db.batch();
    ops = 0;
  }
};

// El orden es el del inventario, y `tenantUsers` es la última (R8).
const { COLECCIONES_CON_CLAVE_DE_UNIDAD } = await import("./lib/claves-de-unidad.mjs");
for (const coleccion of COLECCIONES_CON_CLAVE_DE_UNIDAD) {
  const acciones = porColeccion.get(coleccion.nombre) ?? [];
  if (acciones.length === 0) continue;

  // La raíz del permiso se escribe en su propio lote, después de todo el dato: si
  // algo se tuerce, el residente sigue viendo lo que veía y no menos.
  if (coleccion.raizDelPermiso) await flush();

  console.log(`── ${coleccion.nombre} (${acciones.length})${coleccion.raizDelPermiso ? "  ← la raíz del permiso, la última (R8)" : ""}`);
  for (const a of acciones) {
    console.log(`   ${a.docId}  ${a.de} → ${a.a}  [por ${a.via}${a.etiqueta ? ` «${a.etiqueta}»` : ""}]`);
    if (!escribir) continue;
    const ref = db.collection(a.coleccion).doc(a.docId);
    const actual = await ref.get();
    if (!actual.exists) {
      console.log(`   ⚠ ${a.docId} ya no existe; se salta.`);
      continue;
    }
    batch.update(ref, camposDeLaEscritura(a, actual.data(), FieldValue.serverTimestamp()));
    escritos += 1;
    if ((ops += 1) >= 400) await flush();
  }
}
await flush();

// El dinero que se vuelve visible. §9: no se notifica al residente, pero el
// administrador tiene que saberlo ANTES de que le llamen.
const suben = r.porUnidad.filter((u) => u.deudaDespues > u.deudaAntes);
if (suben.length) {
  console.log("\nDEUDA QUE SE VUELVE VISIBLE (§9 — para el administrador, no para el residente):");
  for (const u of suben) {
    console.log(`   ${u.etiqueta ?? u.unidad}: ${dinero(u.deudaAntes)} → ${dinero(u.deudaDespues)} (+${dinero(u.deudaDespues - u.deudaAntes)})`);
  }
}

if (!escribir) {
  console.log(`\nSECO: no se escribió nada. ${r.escrituras.length} documento(s) quedarían migrados.`);
  process.exit(0);
}

// R5/CA4 · el informe posterior debe dar CERO. Si no, la migración no terminó.
const despues = await radiografiarConjunto(db, tenantId);
const fuera = despues.porUnidad.reduce((a, u) => a + u.fueraDeConvencion, 0);
console.log(`\n${escritos} documento(s) migrados.`);
console.log(`Informe posterior: ${fuera} documento(s) fuera de convención · ${despues.huerfanos.length} huérfano(s) · ${despues.ambiguos.length} ambiguo(s)`);
if (fuera === 0) {
  console.log("CERO fuera de convención. La migración de este conjunto terminó (R5).");
  process.exit(0);
}
console.error("NO DIO CERO: la migración no terminó. Vuelve a correr el informe y mira qué quedó.");
process.exit(2);
