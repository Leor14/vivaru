/**
 * seed-billing-test.mjs
 *
 * Crea 3 cobros de prueba para Jaime Gutierrez (T1-403, tenant-santa-maria)
 * que cubren los 3 estados del hero card: Al día, Pendiente y Vencido.
 *
 * USO:
 *   node functions/scripts/seed-billing-test.mjs
 *
 * REQUISITOS:
 *   - gcloud auth application-default login   (una sola vez)
 *   - Node 18+
 */

import admin from "firebase-admin";

const PROJECT_ID = "hogaru-1";
const TENANT_ID  = "tenant-santa-maria";
// unitId debe ser el Firestore doc ID de la unidad (el que guarda tenantUsers.unitId),
// NO el campo unitId del documento units.
// Jaime Gutierrez → T1-403 → doc ID: G1bWNzZJuakw9KRoAx7p
const UNIT_ID    = "G1bWNzZJuakw9KRoAx7p";
const UNIT_LABEL = "T1-403";

if (!admin.apps.length) {
  admin.initializeApp({ projectId: PROJECT_ID });
}
const db = admin.firestore();

const today = new Date().toISOString().slice(0, 10);
const thisMonth  = today.slice(0, 7);          // "2026-05"
const lastMonth  = offsetMonth(-1);            // "2026-04"
const twoMonths  = offsetMonth(-2);            // "2026-03"

function offsetMonth(delta) {
  const d = new Date();
  d.setMonth(d.getMonth() + delta);
  return d.toISOString().slice(0, 7);
}

function dueDate(yearMonth, day = 15) {
  return `${yearMonth}-${String(day).padStart(2, "0")}`;
}

const statements = [
  {
    // 1. Pendiente — cuota del mes en curso, sin pagar
    id: `billing-test-${UNIT_ID}-${thisMonth}`,
    tenantId: TENANT_ID,
    unitId:   UNIT_ID,
    unitLabel: UNIT_LABEL,
    period:   thisMonth,
    amount:   400000,
    paymentAmount: 0,
    balance:  400000,
    dueDate:  dueDate(thisMonth, 31),
    status:   "pending",
    lastPaymentAt: null,
    createdBy: "seed-script",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  },
  {
    // 2. Al día — mes anterior, pagado completo
    id: `billing-test-${UNIT_ID}-${lastMonth}`,
    tenantId: TENANT_ID,
    unitId:   UNIT_ID,
    unitLabel: UNIT_LABEL,
    period:   lastMonth,
    amount:   400000,
    paymentAmount: 400000,
    balance:  0,
    dueDate:  dueDate(lastMonth, 30),
    status:   "paid",
    lastPaymentAt: `${lastMonth}-28`,
    createdBy: "seed-script",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  },
  {
    // 3. Vencido — hace 2 meses, saldo sin pagar, fecha ya pasó
    id: `billing-test-${UNIT_ID}-${twoMonths}`,
    tenantId: TENANT_ID,
    unitId:   UNIT_ID,
    unitLabel: UNIT_LABEL,
    period:   twoMonths,
    amount:   400000,
    paymentAmount: 0,
    balance:  400000,
    dueDate:  dueDate(twoMonths, 15),
    status:   "overdue",
    lastPaymentAt: null,
    createdBy: "seed-script",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  },
];

async function run() {
  console.log(`\nSeed billing test — proyecto: ${PROJECT_ID}`);
  console.log(`Tenant: ${TENANT_ID}  |  Unidad: ${UNIT_ID}\n`);

  for (const stmt of statements) {
    const { id, ...data } = stmt;
    await db.collection("billingStatements").doc(id).set(data, { merge: true });
    console.log(`✓  ${stmt.period}  [${stmt.status}]  balance: $${stmt.balance.toLocaleString("es-CO")}`);
  }

  console.log("\n✅ 3 cobros creados. Recarga el portal del residente.\n");
}

run().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
