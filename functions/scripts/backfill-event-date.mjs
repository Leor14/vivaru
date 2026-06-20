// Backfill del campo canónico `eventDate` (YYYY-MM-DD) en docs existentes de
// visitorPasses y tickets. Los docs NUEVOS ya lo traen (write-path, fase 1);
// esto cubre los históricos para habilitar consultas por rango (fase 3-4).
//
// Replica la lógica de src/utils/event-date.ts (no se puede importar src/ desde
// un script .mjs). Mantener ambos en sync si cambia la prioridad de campos.
//
// Uso:
//   node functions/scripts/backfill-event-date.mjs                 # dry-run (no escribe)
//   node functions/scripts/backfill-event-date.mjs --apply         # escribe
//   node functions/scripts/backfill-event-date.mjs --tenant=<id>   # acota a un conjunto
//
// Es idempotente (omite docs que ya tienen eventDate) y no es destructivo
// (solo agrega un campo). Requiere credenciales de admin (ADC), igual que los
// demás scripts.

import admin from "firebase-admin";

const projectId = process.env.FIREBASE_PROJECT_ID || "hogaru-1";
const args = process.argv.slice(2);
const apply = args.includes("--apply");
const tenantArg = args.find((a) => a.startsWith("--tenant="))?.split("=")[1];

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

function toJsDate(value) {
  if (!value) return null;
  if (typeof value === "string") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === "object" && typeof value.toDate === "function") return value.toDate(); // Firestore Timestamp
  if (value instanceof Date) return value;
  return null;
}

function asDateKey(value) {
  if (typeof value === "string" && DATE_KEY_RE.test(value)) return value;
  const d = toJsDate(value);
  if (!d) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const resolveVisitorEventDate = (d) =>
  asDateKey(d.date) || asDateKey(d.visitDate) || asDateKey(d.checkInAt) || asDateKey(d.createdAt) || "";

const resolveTicketEventDate = (d) =>
  asDateKey(d.radicationDate) || asDateKey(d.createdAt) || asDateKey(d.updatedAt) || "";

function init() {
  if (!admin.apps.length) admin.initializeApp({ projectId });
}

async function backfill(collectionName, resolve) {
  const db = admin.firestore();
  let query = db.collection(collectionName);
  if (tenantArg) query = query.where("tenantId", "==", tenantArg);
  const snap = await query.get();

  let scanned = 0;
  let updated = 0;
  let alreadySet = 0;
  let noDate = 0;
  const samples = [];

  let batch = db.batch();
  let inBatch = 0;

  for (const doc of snap.docs) {
    scanned += 1;
    const data = doc.data();
    if (data.eventDate) {
      alreadySet += 1;
      continue;
    }
    const eventDate = resolve(data);
    if (!eventDate) {
      noDate += 1;
      continue;
    }
    updated += 1;
    if (samples.length < 5) samples.push({ id: doc.id, eventDate });
    if (apply) {
      batch.update(doc.ref, { eventDate });
      inBatch += 1;
      if (inBatch >= 400) {
        await batch.commit();
        batch = db.batch();
        inBatch = 0;
      }
    }
  }
  if (apply && inBatch > 0) await batch.commit();

  console.log(`\n${collectionName}`);
  console.log(`  escaneados:        ${scanned}`);
  console.log(`  ${apply ? "actualizados" : "por actualizar"}: ${updated}`);
  console.log(`  ya tenían eventDate: ${alreadySet}`);
  console.log(`  sin fecha resoluble: ${noDate}`);
  if (samples.length) {
    console.log(`  ejemplos: ${samples.map((s) => `${s.id}→${s.eventDate}`).join(", ")}`);
  }
}

async function run() {
  init();
  console.log(apply ? "MODO APPLY (escribe)" : "MODO DRY-RUN (no escribe — usa --apply para aplicar)");
  if (tenantArg) console.log(`Tenant: ${tenantArg}`);
  await backfill("visitorPasses", resolveVisitorEventDate);
  await backfill("tickets", resolveTicketEventDate);
  console.log("\nListo.");
  process.exit(0);
}

run().catch((e) => {
  console.error("Error:", e?.message || e);
  process.exit(1);
});
