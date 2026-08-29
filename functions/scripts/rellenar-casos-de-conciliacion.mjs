/**
 * rellenar-casos-de-conciliacion.mjs
 *
 * `PRD-V-FLOW-004` §11.5 — crea el expediente de las líneas de extracto que ya
 * existían antes de que el expediente existiera.
 *
 * POR QUÉ EXISTE
 * --------------
 * Las líneas de producción son anteriores a esta ficha, así que ninguna tiene
 * caso. Sin relleno, la bandeja arrancaría vacía sobre 27 líneas reales y las 19
 * conciliaciones ya hechas no tendrían dónde constar.
 *
 * **§5.4 — lo que ya está escrito NO se reescribe, se nombra.** Una línea
 * conciliada nace `aplicado`, porque eso es lo que pasó; si el par incumple las
 * reglas, se le anotan las `incoherencias` y sale en la bandeja como «a
 * revisar». **No toca ni la línea ni el asiento.** El criterio de no corregir el
 * dato histórico de conjuntos de ejemplo estaba escrito antes que esta ficha
 * (`roadmap-finance` §9), y David lo confirmó el 29 de agosto de 2026.
 *
 * QUÉ ESCRIBE — y nada más
 * ------------------------
 * Documentos NUEVOS en `reconciliationCases`, con el id de su línea. No hace
 * `update` de nada: si el caso ya existe, lo deja como está.
 *
 * SEGURIDAD
 * ---------
 * - Por defecto NO escribe: enseña lo que haría y sale (ensayo).
 * - Solo escribe con `--escribir`.
 * - **Comprueba la huella antes de cada escritura**: que la línea siga existiendo
 *   con el mismo importe y fecha, y que su asiento emparejado exista y sea del
 *   mismo conjunto. Si algo no cuadra, esa línea se salta **nombrándola**.
 * - Es idempotente: un caso que ya existe no se vuelve a escribir.
 * - No escribe `updatedAt` ni `updatedBy`: no lo hizo la aplicación.
 *
 *   node functions/scripts/rellenar-casos-de-conciliacion.mjs hogaru-1
 *   node functions/scripts/rellenar-casos-de-conciliacion.mjs hogaru-1 --escribir
 */
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";

import { casoDeRelleno } from "../lib/conciliacion-casos.js";

const [projectId, ...resto] = process.argv.slice(2);
const escribir = resto.includes("--escribir");
if (!projectId) {
  console.error("Falta el proyecto. Ej: node functions/scripts/rellenar-casos-de-conciliacion.mjs hogaru-1");
  process.exit(1);
}

initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();

console.log(`Proyecto: ${projectId}${projectId === "hogaru-1" ? " (PRODUCCIÓN)" : ""}`);
console.log(escribir ? "MODO: ESCRITURA\n" : "MODO: ENSAYO — no se escribe nada\n");

const lineas = (await db.collection("bankStatementLines").get()).docs.map((d) => ({ id: d.id, ...d.data() }));
const asientos = (await db.collection("ledgerEntries").get()).docs.map((d) => ({ id: d.id, ...d.data() }));
const casos = new Set((await db.collection("reconciliationCases").get()).docs.map((d) => d.id));

const asientoPorId = new Map(asientos.map((a) => [a.id, a]));
const porTenant = new Map();
for (const a of asientos) {
  if (!porTenant.has(a.tenantId)) porTenant.set(a.tenantId, []);
  porTenant.get(a.tenantId).push(a);
}

console.log(`Líneas: ${lineas.length} · Asientos: ${asientos.length} · Casos ya existentes: ${casos.size}\n`);

const resumen = {};
const aRevisar = [];
const pendientes = [];
const saltadas = [];
let escritos = 0;

for (const linea of [...lineas].sort((a, b) => String(a.date).localeCompare(String(b.date)))) {
  if (casos.has(linea.id)) {
    resumen["(ya existía)"] = (resumen["(ya existía)"] ?? 0) + 1;
    continue;
  }

  // ── Huella: se comprueba lo que se va a describir, no se supone ───────────
  if (typeof linea.amount !== "number" || !linea.date || !linea.tenantId || !linea.bankAccountId) {
    saltadas.push(`${linea.id.slice(0, 8)} — le falta algún campo básico (importe, fecha, conjunto o cuenta)`);
    continue;
  }
  let emparejado = null;
  if (linea.reconciled || linea.matchedLedgerEntryId) {
    emparejado = asientoPorId.get(linea.matchedLedgerEntryId) ?? null;
    if (!emparejado) {
      saltadas.push(`${linea.id.slice(0, 8)} — dice estar conciliada con un asiento que no existe (${linea.matchedLedgerEntryId})`);
      continue;
    }
    if (emparejado.tenantId !== linea.tenantId) {
      saltadas.push(`${linea.id.slice(0, 8)} — su asiento es de OTRO conjunto. No se toca: hay que mirarlo a mano`);
      continue;
    }
  }

  const caso = casoDeRelleno(linea, porTenant.get(linea.tenantId) ?? [], emparejado);
  const etiqueta = caso.status === "detectado" ? `detectado · ${caso.excepcion}` : caso.status;
  resumen[etiqueta] = (resumen[etiqueta] ?? 0) + 1;
  if (caso.status === "detectado") {
    pendientes.push(
      `${linea.id.slice(0, 8)} ${linea.date} ${String(linea.amount).padStart(10)}  ${String(caso.candidateLedgerEntryIds.length).padStart(2)} candidato(s)  ${JSON.stringify(String(linea.description ?? "").slice(0, 46))}`,
    );
  }
  if (caso.incoherencias.length > 0) {
    aRevisar.push(`${linea.id.slice(0, 8)} ${linea.date} ${String(linea.amount).padStart(10)} → ${emparejado.id.slice(0, 8)} ${emparejado.type} ${emparejado.amount}  [${caso.incoherencias.join(", ")}]`);
  }

  if (!escribir) continue;

  await db.collection("reconciliationCases").doc(linea.id).create({
    ...caso,
    history: [
      {
        // No venía de ningún estado: el caso no existía. Ponerle `de: aplicado`
        // haría leer «aplicado → aplicado», que no dice nada.
        de: "sin_expediente",
        a: caso.status,
        cuando: Timestamp.now(),
        quien: "relleno-flow-004",
        motivoCodigo: null,
        mecanismo: "relleno",
      },
    ],
    createdAt: FieldValue.serverTimestamp(),
    createdBy: "relleno-flow-004",
  });
  escritos += 1;
}

console.log("Cómo quedarían los casos:");
for (const [estado, n] of Object.entries(resumen).sort()) console.log(`  ${estado.padEnd(16)} ${n}`);

if (pendientes.length > 0) {
  console.log(`\nLas pendientes, con sus candidatos (${pendientes.length}):`);
  pendientes.forEach((l) => console.log("  " + l));
}

if (aRevisar.length > 0) {
  console.log(`\nConciliaciones que NO cuadran (${aRevisar.length}) — se nombran, no se corrigen:`);
  aRevisar.forEach((l) => console.log("  " + l));
}
if (saltadas.length > 0) {
  console.log(`\nSaltadas (${saltadas.length}):`);
  saltadas.forEach((l) => console.log("  " + l));
}

console.log(escribir ? `\nEscritos: ${escritos}` : "\nEnsayo: no se escribió nada. Repite con --escribir.");
