/**
 * measure-load-test.mjs
 *
 * Mide el lado-lectura de la prueba de carga: cuánto tarda y cuántos documentos
 * (= lecturas Firestore facturadas) implica cargar las colecciones COMPLETAS de un
 * tenant, que es exactamente lo que hoy hace el front (useBillingStatements,
 * useCommitteeReport cargan todo el histórico). Cuantifica el riesgo R1/R2 sin navegador.
 *
 * USO:
 *   node functions/scripts/measure-load-test.mjs --tenant=loadtest-1000u-36m
 *
 * REQUISITOS: gcloud auth application-default login ; Node 18+.
 */

import admin from "firebase-admin";

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "hogaru-1";
const args = process.argv.slice(2);
const getArg = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.split("=")[1] : def;
};
const TENANT = getArg("tenant", null);
if (!TENANT) {
  console.error("Falta --tenant=loadtest-...");
  process.exit(1);
}

if (!admin.apps.length) admin.initializeApp({ projectId: PROJECT_ID });
const db = admin.firestore();

// Carga la colección completa filtrada por tenant (como el front) y mide.
async function measureFull(coll) {
  const t0 = Date.now();
  const snap = await db.collection(coll).where("tenantId", "==", TENANT).get();
  const ms = Date.now() - t0;
  // bytes aproximados (tamaño del JSON de cada doc).
  let bytes = 0;
  for (const d of snap.docs) bytes += Buffer.byteLength(JSON.stringify(d.data()));
  return { coll, docs: snap.size, ms, bytes };
}

function fmt(n) { return n.toLocaleString("es-CO"); }
function mb(b) { return (b / 1024 / 1024).toFixed(1); }

async function run() {
  console.log(`\n📏 Medición de carga — tenant ${TENANT}\n`);
  const results = [];
  // Mismas colecciones que cargan los caminos críticos del front.
  for (const coll of ["billingStatements", "ledgerEntries", "units"]) {
    const r = await measureFull(coll);
    results.push(r);
    console.log(`  ${coll.padEnd(20)} ${fmt(r.docs).padStart(8)} docs · ${fmt(r.ms).padStart(6)} ms · ${mb(r.bytes).padStart(6)} MB`);
  }

  // La página de Cartera carga billingStatements; el Reporte de Comité carga
  // billingStatements + ledgerEntries (+ otras acotadas por rango).
  const billing = results.find((r) => r.coll === "billingStatements");
  const ledger = results.find((r) => r.coll === "ledgerEntries");
  const carteraDocs = billing.docs;
  const reporteDocs = billing.docs + ledger.docs;
  const carteraMs = billing.ms;
  const reporteMs = billing.ms + ledger.ms;
  const carteraMB = +mb(billing.bytes);
  const reporteMB = +mb(billing.bytes + ledger.bytes);

  console.log(`\n  ── Caminos críticos (aprox. lo que paga/transfiere el front) ──`);
  console.log(`  /admin/billing   → ${fmt(carteraDocs)} lecturas · ${fmt(carteraMs)} ms · ~${carteraMB} MB`);
  console.log(`  /admin/reports   → ${fmt(reporteDocs)} lecturas · ${fmt(reporteMs)} ms · ~${reporteMB} MB`);

  console.log(`\n  ── Costo de lectura por sesión (Firestore ~US$0.03 / 100k lecturas) ──`);
  const cost = (docs) => `US$${((docs / 100000) * 0.03).toFixed(4)}`;
  console.log(`  Cartera: ${cost(carteraDocs)} · Reporte: ${cost(reporteDocs)} por cada carga.`);

  console.log(`\n  Criterios (plan): interactivo < 3000 ms, payload manejable en navegador.`);
  console.log(`  Veredicto de lectura: ${carteraMs < 3000 && reporteMs < 3000 ? "✓ dentro" : "✗ excede"} del umbral de latencia de consulta.`);
  console.log(`  (Latencia de query ≠ tiempo a interactivo; el render/parse en el navegador suma.)\n`);
}

run().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
