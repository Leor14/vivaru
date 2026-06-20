// Valida que las consultas por rango sobre `eventDate` no omitan documentos:
// 1) ningún doc sin eventDate (si falta, el rango lo excluiría → subconteo),
// 2) una consulta por rango "todo el tiempo" devuelve el 100% de los docs.
// Solo lectura. Requiere ADC (igual que los demás scripts).
//
// Uso:
//   node functions/scripts/validate-event-date-range.mjs
//   node functions/scripts/validate-event-date-range.mjs --tenant=<id>

import admin from "firebase-admin";

const projectId = process.env.FIREBASE_PROJECT_ID || "hogaru-1";
const tenantArg = process.argv.slice(2).find((a) => a.startsWith("--tenant="))?.split("=")[1];

const ALL_START = "0000-01-01";
const ALL_END = "9999-12-31";

function init() {
  if (!admin.apps.length) admin.initializeApp({ projectId });
}

async function validate(collectionName) {
  const db = admin.firestore();
  let base = db.collection(collectionName);
  if (tenantArg) base = base.where("tenantId", "==", tenantArg);

  const fullSnap = await base.get();
  const total = fullSnap.size;
  const missing = fullSnap.docs.filter((d) => !d.data().eventDate).length;

  let ranged = base.where("eventDate", ">=", ALL_START).where("eventDate", "<=", ALL_END);
  const rangeSnap = await ranged.get();
  const rangeReturned = rangeSnap.size;

  const ok = missing === 0 && rangeReturned === total;
  console.log(`\n${collectionName}`);
  console.log(`  total:                 ${total}`);
  console.log(`  sin eventDate:         ${missing}`);
  console.log(`  devueltos por rango:   ${rangeReturned}`);
  console.log(`  ${ok ? "✔ OK (el rango cubre el 100%)" : "✗ DIFERENCIA — revisar"}`);
  return ok;
}

async function run() {
  init();
  if (tenantArg) console.log(`Tenant: ${tenantArg}`);
  const a = await validate("visitorPasses");
  const b = await validate("tickets");
  console.log(`\n${a && b ? "✔ Validación OK" : "✗ Validación con diferencias"}`);
  process.exit(a && b ? 0 : 1);
}

run().catch((e) => {
  console.error("Error:", e?.message || e);
  process.exit(1);
});
