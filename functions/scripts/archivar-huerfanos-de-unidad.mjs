// Archiva los huérfanos de clave de unidad de un conjunto (`PRD-V-FIX-002`, D2).
//
// QUÉ ES ARCHIVAR AQUÍ. **Registrar una decisión, no esconder un documento.** Un
// huérfano es un documento cuya clave no casa con ninguna unidad y que R2 no puede
// reasignar sin adivinar. La ficha los deja listados y dice que qué hacer con ellos
// es decisión de negocio. Cuando esa decisión es «archivar», lo único que cambia es
// que **queda escrita en el propio documento**: el informe deja de contarlo como
// pendiente y quien lo encuentre dentro de un año sabe por qué sigue ahí.
//
// LO QUE NO TOCA. Ni la clave —que es la única pista de a dónde apuntaba—, ni el
// estado, ni el contenido. **No borra, no mueve y no crea nada.** Los 31 de
// `tenant-santa-maria` son documentos ya cerrados —el paquete está `delivered`
// desde marzo, las invitaciones están canceladas— y **no inflan ningún número**:
// el resumen de firmas cuenta UNIDADES que firmaron, no firmas. Archivarlos no
// cambia una sola pantalla; cambia que dejan de ser una pregunta abierta.
//
// LO QUE SE NIEGA A ARCHIVAR, y no es precaución sino significado:
//
//   - **`tenantUsers` y `users`.** Un huérfano ahí es **alguien que hoy no ve nada
//     de lo suyo**. Archivarlo no cierra la pregunta: la tapa, y deja a esa persona
//     fuera para siempre con la decisión marcada como tomada. Hay que asignarle
//     una unidad.
//   - **Cualquier documento con dinero vivo** (un cargo con saldo, un anticipo con
//     remanente). Es plata de alguien; sin dueño hace daño donde está y una marca
//     no la devuelve.
//
// Uso:
//   node functions/scripts/archivar-huerfanos-de-unidad.mjs <projectId> <tenantId> --motivo "..."
//     ... sin más            SECO: enseña qué archivaría
//     ... --escribir         aplica
//     ... --si-produccion    obligatorio junto a --escribir en `hogaru-1`
//     ... --desarchivar      quita la marca (la operación simétrica)
//     ... --clave <valor>    solo los huérfanos que lleven ESA clave

import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

import {
  CAMPO_ARCHIVADO_EN,
  CAMPO_ARCHIVADO_MOTIVO,
  NO_ARCHIVABLES,
  llevaDineroVivo,
} from "../lib/clave-de-unidad.js";
import { radiografiarConjunto } from "./lib/claves-de-unidad.mjs";

const [, , projectId, ...resto] = process.argv;

const banderas = new Set();
const sueltos = [];
let motivo = null;
let claveFiltro = null;
for (let i = 0; i < resto.length; i++) {
  if (resto[i] === "--motivo") motivo = resto[++i] ?? null;
  else if (resto[i] === "--clave") claveFiltro = resto[++i] ?? null;
  else if (resto[i].startsWith("--")) banderas.add(resto[i]);
  else sueltos.push(resto[i]);
}
const tenantId = sueltos[0];
const escribir = banderas.has("--escribir");
const desarchivar = banderas.has("--desarchivar");
const siProduccion = banderas.has("--si-produccion");

if (!projectId || !tenantId) {
  console.error('Uso: node archivar-huerfanos-de-unidad.mjs <projectId> <tenantId> --motivo "..." [--escribir] [--si-produccion] [--desarchivar] [--clave <valor>]');
  process.exit(1);
}
if (projectId === "hogaru-1" && escribir && !siProduccion) {
  console.error("Esto es PRODUCCIÓN. Añade --si-produccion si de verdad es lo que quieres.");
  process.exit(1);
}
// **El motivo es obligatorio para escribir, y no por burocracia.** Sin él, dentro
// de un año la marca dirá «alguien decidió algo» y habrá que reabrir la pregunta
// entera. Es el único campo que convierte una marca en una decisión.
if (escribir && !desarchivar && !(motivo ?? "").trim()) {
  console.error('Falta --motivo "...". Una marca sin porqué obliga a reabrir la pregunta entera.');
  process.exit(1);
}

initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();

const conjunto = await db.collection("tenants").doc(tenantId).get();
if (!conjunto.exists) {
  console.error(`No existe el conjunto «${tenantId}» en ${projectId}.`);
  process.exit(1);
}

console.log(`\n${desarchivar ? "DESARCHIVAR" : "ARCHIVAR"} HUÉRFANOS DE CLAVE DE UNIDAD · ${projectId} · ${tenantId}`);
console.log(escribir ? "MODO: ESCRIBIENDO\n" : "MODO: SECO — no se escribe nada\n");

const r = await radiografiarConjunto(db, tenantId);
const candidatos = (desarchivar ? r.archivados : r.huerfanos).filter(
  (h) => !claveFiltro || h.valor === claveFiltro,
);

if (candidatos.length === 0) {
  console.log(desarchivar ? "No hay huérfanos archivados que devolver." : "No hay huérfanos sin decidir.");
  process.exit(0);
}

const aTocar = [];
const rechazados = [];
for (const h of candidatos) {
  const doc = await db.collection(h.coleccion).doc(h.docId).get();
  if (!doc.exists) {
    rechazados.push({ ...h, porque: "ya no existe" });
    continue;
  }
  if (!desarchivar && NO_ARCHIVABLES.has(h.coleccion)) {
    rechazados.push({ ...h, porque: "es una membresía: hay que ASIGNARLE una unidad, no taparla" });
    continue;
  }
  if (!desarchivar && llevaDineroVivo(h.coleccion, doc.data())) {
    rechazados.push({ ...h, porque: "lleva dinero vivo: es plata de alguien" });
    continue;
  }
  aTocar.push({ ...h, ref: doc.ref });
}

const porColeccion = new Map();
for (const a of aTocar) porColeccion.set(a.coleccion, (porColeccion.get(a.coleccion) ?? 0) + 1);
console.log(
  `${aTocar.length} documento(s) a ${desarchivar ? "desarchivar" : "archivar"}: ` +
    [...porColeccion.entries()].map(([c, n]) => `${c}=${n}`).join(" · "),
);
for (const a of aTocar) console.log(`   ${a.coleccion}/${a.docId}  clave huérfana «${a.valor}»`);

if (rechazados.length) {
  console.log(`\n${rechazados.length} NO se tocan, y cada uno dice por qué:`);
  for (const x of rechazados) console.log(`   ${x.coleccion}/${x.docId} «${x.valor}» — ${x.porque}`);
}

if (!escribir) {
  console.log("\nSECO: no se escribió nada.");
  process.exit(0);
}

let batch = db.batch();
let ops = 0;
for (const a of aTocar) {
  batch.update(
    a.ref,
    desarchivar
      ? { [CAMPO_ARCHIVADO_EN]: FieldValue.delete(), [CAMPO_ARCHIVADO_MOTIVO]: FieldValue.delete() }
      : { [CAMPO_ARCHIVADO_EN]: FieldValue.serverTimestamp(), [CAMPO_ARCHIVADO_MOTIVO]: motivo.trim() },
  );
  if ((ops += 1) >= 400) {
    await batch.commit();
    batch = db.batch();
    ops = 0;
  }
}
if (ops > 0) await batch.commit();

const despues = await radiografiarConjunto(db, tenantId);
console.log(`\n${aTocar.length} documento(s) ${desarchivar ? "desarchivados" : "archivados"}.`);
console.log(
  `Informe posterior: ${despues.huerfanos.length} huérfano(s) sin decidir · ` +
    `${despues.archivados.length} archivado(s) · estado ${despues.estado.toUpperCase()}`,
);
process.exit(0);
