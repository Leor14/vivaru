/**
 * seed-load-test.mjs
 *
 * Genera un tenant SINTÉTICO para la prueba de carga (ver
 * docs/plan-prueba-carga-vivaru.md): N unidades × M meses de cartera + libro,
 * para medir la página de Cartera y el Reporte de Comité a distintas escalas.
 *
 * Escribe en colecciones reales (units, billingStatements, ledgerEntries) bajo un
 * tenantId claramente prefijado "loadtest-...". Ids deterministas → idempotente y
 * borrable con --clean. NO crea usuarios ni toca otros tenants.
 *
 * USO:
 *   node functions/scripts/seed-load-test.mjs --units=1000 --months=36 [--tenant=loadtest-1000u-36m]
 *   node functions/scripts/seed-load-test.mjs --tenant=loadtest-1000u-36m --clean
 *
 * REQUISITOS:
 *   - gcloud auth application-default login   (una sola vez)
 *   - Node 18+
 *
 * OJO (costo): N×M escrituras Firestore. 1000×36 ≈ 36.000 cobros. Limpia con --clean
 * al terminar para no acumular costo de almacenamiento.
 */

import admin from "firebase-admin";

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "hogaru-1";
const args = process.argv.slice(2);
const getArg = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.split("=")[1] : def;
};
const UNITS = parseInt(getArg("units", "1000"), 10);
const MONTHS = parseInt(getArg("months", "36"), 10);
const CLEAN = args.includes("--clean");
const TENANT = getArg("tenant", `loadtest-${UNITS}u-${MONTHS}m`);
const AMOUNT = parseInt(getArg("amount", "400000"), 10);

if (!TENANT.startsWith("loadtest-")) {
  console.error("Por seguridad, el tenant debe empezar con 'loadtest-'.");
  process.exit(1);
}

if (!admin.apps.length) admin.initializeApp({ projectId: PROJECT_ID });
const db = admin.firestore();
const ts = () => admin.firestore.FieldValue.serverTimestamp();

function offsetMonth(delta) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + delta);
  return d.toISOString().slice(0, 7); // YYYY-MM
}
const today = new Date().toISOString().slice(0, 10);

// ── Commit por lotes (máx 500 ops/batch) ──────────────────────────────────────
class Batcher {
  constructor() { this.batch = db.batch(); this.n = 0; this.total = 0; }
  async set(ref, data) {
    this.batch.set(ref, data, { merge: true });
    if (++this.n >= 450) await this.flush();
    this.total++;
  }
  async del(ref) {
    this.batch.delete(ref);
    if (++this.n >= 450) await this.flush();
    this.total++;
  }
  async flush() {
    if (this.n === 0) return;
    await this.batch.commit();
    this.batch = db.batch();
    this.n = 0;
  }
}

async function clean() {
  console.log(`\n🧹 Limpiando tenant ${TENANT}...`);
  const b = new Batcher();
  for (const coll of ["billingStatements", "ledgerEntries", "units"]) {
    let removed = 0;
    // paginar para no traer todo a memoria
    while (true) {
      const snap = await db.collection(coll).where("tenantId", "==", TENANT).limit(500).get();
      if (snap.empty) break;
      for (const d of snap.docs) await b.del(d.ref);
      await b.flush();
      removed += snap.size;
      if (snap.size < 500) break;
    }
    console.log(`  ${coll}: ${removed} doc(s) eliminados`);
  }
  console.log("✅ Limpieza completa.\n");
}

function statusFor(unitIndex, monthOffset) {
  const chronic = unitIndex % 12 === 0;            // ~8% morosos crónicos
  if (monthOffset === 0) return chronic ? "overdue" : "pending"; // mes vigente
  if (chronic && monthOffset <= 5) return "overdue";              // deben ~6 meses
  if (unitIndex % 25 === 0 && monthOffset === 1) return "overdue"; // rezagados ocasionales
  return "paid";
}

async function seed() {
  console.log(`\n🌱 Seed de carga — proyecto ${PROJECT_ID}`);
  console.log(`   Tenant: ${TENANT}`);
  console.log(`   Unidades: ${UNITS}  ×  Meses: ${MONTHS}  ≈ ${(UNITS * MONTHS).toLocaleString("es-CO")} cobros\n`);

  const periods = Array.from({ length: MONTHS }, (_, k) => offsetMonth(-k)); // [actual, -1, -2, ...]
  const b = new Batcher();

  // Tenant doc (para nombre/moneda en la UI).
  await db.collection("tenants").doc(TENANT).set(
    { name: `Carga ${UNITS}u/${MONTHS}m`, currency: "COP", branding: {} },
    { merge: true },
  );

  // Unidades.
  for (let i = 0; i < UNITS; i++) {
    const unitDocId = `lt-${TENANT}-unit-${i}`;
    const label = `LT-${String(i).padStart(4, "0")}`;
    await b.set(db.collection("units").doc(unitDocId), {
      tenantId: TENANT,
      unitId: label.toLowerCase(),
      displayName: label,
      tower: `T${(i % 4) + 1}`,
      type: "apartment",
      status: "active",
      ownerIds: [],
      residentIds: [],
      createdAt: ts(),
      updatedAt: ts(),
    });

    // Cartera del unit: un cobro por período.
    for (let m = 0; m < MONTHS; m++) {
      const period = periods[m];
      const status = statusFor(i, m);
      const paid = status === "paid";
      await b.set(db.collection("billingStatements").doc(`lt-${TENANT}-stmt-${i}-${period}`), {
        tenantId: TENANT,
        unitId: unitDocId,
        unitLabel: label,
        period,
        concept: "administracion",
        campaignId: null,
        amount: AMOUNT,
        paymentAmount: paid ? AMOUNT : 0,
        balance: paid ? 0 : AMOUNT,
        dueDate: `${period}-15`,
        status,
        archived: false,
        lastPaymentAt: paid ? `${period}-10` : null,
        createdBy: "loadtest",
        createdAt: ts(),
        updatedAt: ts(),
      });
    }

    if ((i + 1) % 200 === 0) console.log(`  ... ${i + 1}/${UNITS} unidades`);
  }

  // Libro: por mes, 1 ingreso + 3 egresos por categoría (para el estado de resultados).
  const EXP_CATS = ["servicios", "mantenimiento", "administracion"];
  for (let m = 0; m < MONTHS; m++) {
    const period = periods[m];
    const date = `${period}-05`;
    await b.set(db.collection("ledgerEntries").doc(`lt-${TENANT}-led-${period}-inc`), {
      tenantId: TENANT, type: "ingreso", category: "otros_ingresos", date,
      amount: Math.round(AMOUNT * UNITS * 0.05), concept: "Otros ingresos", sourceType: "manual",
      createdBy: "loadtest", createdAt: ts(), updatedAt: ts(),
    });
    for (let k = 0; k < EXP_CATS.length; k++) {
      await b.set(db.collection("ledgerEntries").doc(`lt-${TENANT}-led-${period}-exp${k}`), {
        tenantId: TENANT, type: "egreso", category: EXP_CATS[k], date,
        amount: Math.round(AMOUNT * UNITS * 0.18), concept: `Egreso ${EXP_CATS[k]}`, sourceType: "expense",
        createdBy: "loadtest", createdAt: ts(), updatedAt: ts(),
      });
    }
  }

  await b.flush();
  console.log(`\n✅ Seed completo. ~${b.total.toLocaleString("es-CO")} escrituras.`);
  console.log(`   Abre /admin/billing y /admin/reports con el tenant ${TENANT} y mide.`);
  console.log(`   Para borrar: node functions/scripts/seed-load-test.mjs --tenant=${TENANT} --clean\n`);
}

async function run() {
  if (CLEAN) { await clean(); return; }
  await seed();
}

run().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
