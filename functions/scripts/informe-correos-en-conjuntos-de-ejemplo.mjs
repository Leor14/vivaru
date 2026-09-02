// Cuenta, en SECO, qué direcciones de correo viven dentro de los conjuntos de
// ejemplo y de qué dominio son. Es el barrido que midió `PRD-V-PLAT-006` el 2 de
// septiembre de 2026, dejado en el repositorio para volver a contar en cualquier
// sesión sin rehacerlo.
//
// POR QUÉ EXISTE: `DATO-001` limpió siete direcciones por su FORMA (nombre de pila
// suelto en gmail) y dejó once que el patrón no cazaba. Un barrido por DOMINIO no
// decide de quién es un buzón —la forma no lo dice; ver
// `docs/hallazgo-direcciones-de-correo.md`— pero sí separa lo inerte de lo que
// podría llegar a alguien, y eso es lo que hay que mirar antes de abrir un canal.
//
// QUÉ MIRA: `people`, `tenantUsers` y `users` de los conjuntos con `isExample`, y
// los dominios de TODAS las cuentas de Auth. Las direcciones no inertes se
// imprimen ENMASCARADAS (`me***@gmail.com`) salvo con `--sin-mascara`.
//
// NO ESCRIBE NADA. Nunca. Para cambiar direcciones está `sanear-correos-de-prueba.mjs`.
//
// Uso:
//   node functions/scripts/informe-correos-en-conjuntos-de-ejemplo.mjs <projectId> [--sin-mascara] [--json <ruta>]

import { writeFileSync } from "node:fs";

import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

/** Dominios que no alcanzan a nadie: los de las semillas y el de las cuentas de prueba. */
export const DOMINIOS_INERTES = ["ejemplo.vivaru.app", "demo.grupovivaru.com", "hogaru.test", "demo.co", "example.com"];

const [, , projectId, ...resto] = process.argv;
if (!projectId) {
  console.error("Uso: node informe-correos-en-conjuntos-de-ejemplo.mjs <projectId> [--sin-mascara] [--json <ruta>]");
  process.exit(1);
}
const sinMascara = resto.includes("--sin-mascara");
const rutaJson = resto.includes("--json") ? resto[resto.indexOf("--json") + 1] : null;

initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();

const dominioDe = (e) => (typeof e === "string" && e.includes("@") ? e.split("@")[1].toLowerCase() : null);
const esInerte = (dominio) => DOMINIOS_INERTES.some((d) => dominio === d || dominio.endsWith(`.${d}`));
const enmascarar = (e) => {
  if (sinMascara) return e;
  const [local, dominio] = e.split("@");
  return `${local.slice(0, 2)}***@${dominio}`;
};

const conjuntos = await db.collection("tenants").get();
const ejemplo = new Map();
for (const t of conjuntos.docs) {
  const x = t.data();
  if (x.isExample) ejemplo.set(t.id, { status: x.status ?? null, trial: Boolean(x.trialEndsAt) });
}

const informe = { projectId, medidoEn: new Date().toISOString(), conjuntosDeEjemplo: Object.fromEntries(ejemplo), colecciones: {} };

// **Un registro FUSIONADO no es una dirección viva, y contarlo infla el informe.** `ONB-002`
// fusionó siete altas del mismo residente el 31 ago 2026, y la fusión deja la decisión escrita en
// el documento (`fusionadaEn`, `fusionadaHaciaId`) **sin tocar `status`**: los seis absorbidos
// siguen en `active`, que es lo correcto —archivar no es esconder— pero hace que un barrido que
// solo mire `status` cuente seis veces el mismo buzón. Se separan, no se ocultan.
const estaFusionado = (x) => Boolean(x.fusionadaEn || x.fusionadaHaciaId);

for (const coleccion of ["people", "tenantUsers", "users"]) {
  const snap = await db.collection(coleccion).get();
  const r = { total: snap.size, enConjuntosDeEjemplo: 0, fusionados: 0, porDominio: {}, noInertes: [], noInertesFusionados: [] };
  for (const d of snap.docs) {
    const x = d.data();
    if (!ejemplo.has(x.tenantId)) continue;
    const fusionado = estaFusionado(x);
    if (fusionado) r.fusionados += 1;
    else r.enConjuntosDeEjemplo += 1;
    const dominio = dominioDe(x.email);
    const clave = dominio ?? "(sin correo)";
    if (!fusionado) r.porDominio[clave] = (r.porDominio[clave] ?? 0) + 1;
    if (dominio && !esInerte(dominio)) {
      const fila = { doc: `${coleccion}/${d.id}`, correo: enmascarar(x.email), tenantId: x.tenantId, status: x.status ?? null };
      (fusionado ? r.noInertesFusionados : r.noInertes).push(fila);
    }
  }
  informe.colecciones[coleccion] = r;
}

const auth = getAuth();
const porDominioAuth = {};
let totalAuth = 0;
let pagina;
do {
  const lote = await auth.listUsers(1000, pagina);
  for (const u of lote.users) {
    totalAuth += 1;
    const clave = dominioDe(u.email) ?? "(sin correo)";
    porDominioAuth[clave] = (porDominioAuth[clave] ?? 0) + 1;
  }
  pagina = lote.pageToken;
} while (pagina);
informe.auth = { total: totalAuth, porDominio: porDominioAuth };

console.log(`CORREOS EN CONJUNTOS DE EJEMPLO · ${projectId} · seco\n`);
console.log(`${ejemplo.size} conjunto(s) de ejemplo, ${[...ejemplo.values()].filter((c) => c.trial).length} de trial.`);
for (const [nombre, r] of Object.entries(informe.colecciones)) {
  console.log(`\n${nombre}: ${r.enConjuntosDeEjemplo} de ${r.total} en conjuntos de ejemplo · ${r.noInertes.length} con dominio NO inerte`);
  if (r.fusionados) {
    console.log(
      `     (+${r.fusionados} fusionado(s) por ONB-002, ${r.noInertesFusionados.length} de ellos no inertes — NO se cuentan: son el mismo buzón repetido)`,
    );
  }
  for (const [dominio, n] of Object.entries(r.porDominio).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(4)}  ${dominio}${esInerte(dominio) ? "  (inerte)" : ""}`);
  }
  for (const e of r.noInertes) console.log(`     · ${e.doc}  ${e.correo}  ${e.tenantId}  ${e.status ?? ""}`);
}
console.log(`\nAuth: ${totalAuth} cuenta(s)`);
for (const [dominio, n] of Object.entries(porDominioAuth).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(4)}  ${dominio}${esInerte(dominio) ? "  (inerte)" : ""}`);
}
console.log("\nNo se escribió nada.");

if (rutaJson) {
  writeFileSync(rutaJson, JSON.stringify(informe, null, 2));
  console.log(`Informe guardado en ${rutaJson}`);
}
