// SOLO LECTURA: volumetría de los procesos que el programa de IA quiere asistir.
//
// Contesta la puerta G1 de las cinco PRD-VAI de una sola pasada: cuánto se hace
// hoy, en cuántos conjuntos, y si alcanza para los gold sets que piden
// (FEAT-002: 150-250 tickets · DOC-001: 100-200 comprobantes ·
//  FEAT-003: 50-100 comunicaciones · FEAT-001: 15-25 archivos).
//
// NO imprime contenido de ningún documento: solo conteos, fechas y tenantId.
//
// Lo sembrado se descuenta por DOS caminos, y hacen falta los dos:
//   · `isExample: true` en el propio documento — lo pone `trial-seed.ts`, y
//     sirve para un conjunto REAL con algunas filas de ejemplo dentro.
//   · `isExample: true` en el CONJUNTO — lo ponen los seeds de demo, y
//     descuenta todo lo suyo sin que cada colección tenga que acordarse.
//
// Sin el segundo el baseline nace inflado y ya mintió dos veces: la volumetría
// daba 20 tickets hasta que se separó a mano por tenant y quedaron 0, y el 14
// de agosto de 2026 daba 26 comunicaciones cuando las reales eran 2.
//
// Uso: node functions/scripts/audit-volumen-ia.mjs <projectId>
//      node functions/scripts/audit-volumen-ia.mjs hogaru-1

import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const projectId = process.argv[2];
if (!projectId) {
  console.error("Uso: node audit-volumen-ia.mjs <projectId>");
  process.exit(1);
}

initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();

const NOW = Date.now();
const DAY = 86_400_000;

/** Timestamp de Firestore, ISO string o Date → ms. `null` si no se puede leer. */
function toMs(value) {
  if (!value) return null;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string") {
    const ms = Date.parse(value);
    return Number.isNaN(ms) ? null : ms;
  }
  if (typeof value === "number") return value;
  return null;
}

/**
 * Conjuntos marcados como de demostración. Se resuelve UNA vez y se usa en
 * todas las colecciones: es lo que evita tener que saberse de memoria cuáles
 * son los de demo, que es como se leía esto hasta el 14 de agosto de 2026.
 */
async function conjuntosDeEjemplo() {
  const snap = await db.collection("tenants").where("isExample", "==", true).select().get();
  return new Set(snap.docs.map((d) => d.id));
}

async function countOf(query) {
  const snap = await query.count().get();
  return snap.data().count;
}

/**
 * Total y sembrados de una colección.
 *
 * Cuando hay conjuntos de demo hay que leer los `tenantId`, porque el marcador
 * está en el conjunto y no en cada fila. Se piden SOLO ese campo y el marcador:
 * ni títulos, ni montos, ni nada de nadie.
 */
async function totals(name, ejemplos) {
  const col = db.collection(name);
  if (ejemplos.size === 0) {
    const [total, examples] = await Promise.all([countOf(col), countOf(col.where("isExample", "==", true))]);
    return { total, examples, real: total - examples };
  }

  const snap = await col.select("tenantId", "isExample").get();
  let examples = 0;
  for (const doc of snap.docs) {
    const raw = doc.data();
    if (raw.isExample === true || ejemplos.has(raw.tenantId)) examples += 1;
  }
  return { total: snap.size, examples, real: snap.size - examples };
}

/**
 * Reparte por tenant y por ventana temporal. Trae SOLO los campos pedidos —
 * ni títulos, ni cuerpos, ni montos, ni nada que identifique a una persona.
 */
async function breakdown(name, dateFields, extraFields = [], ejemplos = new Set()) {
  const fields = [...dateFields, ...extraFields, "tenantId", "isExample"];
  const snap = await db.collection(name).select(...fields).get();

  const perTenant = new Map();
  const perExtra = new Map();
  let real = 0;
  let d30 = 0;
  let d90 = 0;
  let d365 = 0;
  let sinFecha = 0;
  let oldest = null;
  let newest = null;

  for (const doc of snap.docs) {
    const raw = doc.data();
    // Las dos formas de estar sembrado: la fila, o el conjunto entero.
    if (raw.isExample === true || ejemplos.has(raw.tenantId)) continue;
    real += 1;

    const tenantId = raw.tenantId ?? "(sin tenantId)";
    perTenant.set(tenantId, (perTenant.get(tenantId) ?? 0) + 1);

    for (const field of extraFields) {
      const key = `${field}=${raw[field] ?? "(vacío)"}`;
      perExtra.set(key, (perExtra.get(key) ?? 0) + 1);
    }

    let ms = null;
    for (const field of dateFields) {
      ms = toMs(raw[field]);
      if (ms !== null) break;
    }
    if (ms === null) {
      sinFecha += 1;
      continue;
    }
    if (oldest === null || ms < oldest) oldest = ms;
    if (newest === null || ms > newest) newest = ms;
    const age = NOW - ms;
    if (age <= 30 * DAY) d30 += 1;
    if (age <= 90 * DAY) d90 += 1;
    if (age <= 365 * DAY) d365 += 1;
  }

  return { real, d30, d90, d365, sinFecha, oldest, newest, perTenant, perExtra };
}

const fecha = (ms) => (ms === null ? "—" : new Date(ms).toISOString().slice(0, 10));

function tabla(perTenant) {
  const filas = [...perTenant.entries()].sort((a, b) => b[1] - a[1]);
  const activos = filas.filter(([, n]) => n > 0).length;
  const top = filas.slice(0, 5).map(([t, n]) => `${t.slice(0, 12)}:${n}`).join("  ");
  return { activos, top: top || "—" };
}

async function main() {
  console.log(`\nVolumetría de IA — proyecto ${projectId} — ${new Date().toISOString().slice(0, 10)}`);
  console.log("Solo conteos. Se descuenta lo sembrado: por documento y por conjunto.\n");

  // --- Conjuntos -----------------------------------------------------------
  const ejemplos = await conjuntosDeEjemplo();

  // Se dicen por su nombre, y no es adorno: un descuento que no se ve se lee
  // como que no hubo descuento, y el número queda sin auditar. Si esta lista
  // sale vacía cuando debería tener conjuntos, el resto del informe miente.
  if (ejemplos.size) {
    console.log(`   descontados por ser de demostración: ${[...ejemplos].join(", ")}`);
  } else {
    console.log("   ⚠️  ningún conjunto marcado como de demostración.");
    console.log("      Si este proyecto tiene datos sembrados, los números de abajo salen INFLADOS.");
    console.log("      Se arregla con: node functions/scripts/marcar-conjuntos-de-ejemplo.mjs <projectId>");
  }
  console.log();

  const tenants = await totals("tenants", ejemplos);
  const estados = {};
  for (const estado of ["active", "trial", "suspended"]) {
    estados[estado] = await countOf(db.collection("tenants").where("status", "==", estado));
  }
  console.log("## Conjuntos");
  console.log(`   tenants: ${tenants.total} (sembrados: ${tenants.examples} · reales: ${tenants.real})`);
  console.log(`   por estado: active=${estados.active}  trial=${estados.trial}  suspended=${estados.suspended}\n`);

  // --- Escala --------------------------------------------------------------
  console.log("## Escala instalada");
  for (const nombre of ["units", "people", "billingStatements"]) {
    const t = await totals(nombre, ejemplos);
    console.log(`   ${nombre.padEnd(20)} ${String(t.real).padStart(6)} reales  (${t.examples} sembrados)`);
  }
  console.log();

  // --- Los cuatro procesos -------------------------------------------------
  const procesos = [
    { col: "tickets", fechas: ["radicationDate", "createdAt"], extra: ["type"], prd: "FEAT-002", goldSet: "150-250" },
    { col: "paymentReceipts", fechas: ["uploadedAt"], extra: ["status"], prd: "DOC-001", goldSet: "100-200" },
    { col: "communications", fechas: ["publishedAt", "createdAt"], extra: [], prd: "FEAT-003", goldSet: "50-100" },
  ];

  console.log("## Volumen por proceso\n");
  for (const { col, fechas, extra, prd, goldSet } of procesos) {
    let b;
    try {
      b = await breakdown(col, fechas, extra, ejemplos);
    } catch (error) {
      console.log(`   ${col}: no se pudo leer — ${error.message}\n`);
      continue;
    }
    const { activos, top } = tabla(b.perTenant);
    const alcanza = b.real >= Number(goldSet.split("-")[0]);
    console.log(`   ${col}  →  ${prd}   gold set pedido: ${goldSet}`);
    console.log(`      histórico real ....... ${b.real}   ${alcanza ? "ALCANZA el piso" : "NO alcanza el piso"}`);
    console.log(`      últimos 30 / 90 / 365  ${b.d30} / ${b.d90} / ${b.d365}`);
    console.log(`      rango .................. ${fecha(b.oldest)} → ${fecha(b.newest)}${b.sinFecha ? `  (${b.sinFecha} sin fecha legible)` : ""}`);
    console.log(`      conjuntos con actividad  ${activos}`);
    console.log(`      mayores .................. ${top}`);
    if (b.perExtra.size) {
      console.log(`      reparto .................. ${[...b.perExtra.entries()].map(([k, v]) => `${k}:${v}`).join("  ")}`);
    }
    console.log();
  }

  console.log("Recordatorio: el histórico sirve para el gold set; la ventana de 30 días");
  console.log("es la que manda para el costo mensual por conjunto y para las cuotas.\n");
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error("Falló:", error.message);
    process.exit(1);
  },
);
