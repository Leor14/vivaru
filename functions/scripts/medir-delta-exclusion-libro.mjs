// SOLO LECTURA: cuánto mueve, por conjunto, la corrección de la exclusión (R12).
//
// Reproduce las dos reglas —la vieja (`category !== "alicuota"`) y la nueva
// (`sourceType !== "billingStatement" && category !== "alicuota"`)— sobre los
// datos reales y compara el ingreso del libro y el total de ingresos.
//
// `cuotaIncome` se calcula igual que la página de Finanzas: la suma de
// `paymentAmount` de TODOS los cargos del conjunto (`src/app/(admin)/admin/
// finanzas/page.tsx:125`), sin mirar el concepto.
//
// Solo imprime agregados por conjunto. Ningún concepto, unidad ni residente.
//
// Uso: node functions/scripts/medir-delta-exclusion-libro.mjs <projectId>

import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const projectId = process.argv[2];
if (!projectId) {
  console.error("Uso: node medir-delta-exclusion-libro.mjs <projectId>");
  process.exit(1);
}

initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();

const vieja = (e) => e.category === "alicuota";
const nueva = (e) => e.sourceType === "billingStatement" || e.category === "alicuota";

const [ledgerSnap, billingSnap, tenantsSnap] = await Promise.all([
  db.collection("ledgerEntries").get(),
  db.collection("billingStatements").get(),
  db.collection("tenants").get(),
]);

const esEjemplo = new Map();
for (const t of tenantsSnap.docs) esEjemplo.set(t.id, t.data().isExample === true);

const porTenant = new Map();
const bucket = (tid) => {
  if (!porTenant.has(tid)) {
    porTenant.set(tid, { cuotaIncome: 0, ledgerVieja: 0, ledgerNueva: 0, asientosQueCambian: 0 });
  }
  return porTenant.get(tid);
};

for (const doc of billingSnap.docs) {
  const d = doc.data();
  bucket(d.tenantId ?? "(sin tenantId)").cuotaIncome += typeof d.paymentAmount === "number" ? d.paymentAmount : 0;
}

for (const doc of ledgerSnap.docs) {
  const d = doc.data();
  if (d.type !== "ingreso") continue;
  const b = bucket(d.tenantId ?? "(sin tenantId)");
  const monto = typeof d.amount === "number" ? d.amount : 0;
  if (!vieja(d)) b.ledgerVieja += monto;
  if (!nueva(d)) b.ledgerNueva += monto;
  if (vieja(d) !== nueva(d)) b.asientosQueCambian += 1;
}

const fmt = (n) => n.toLocaleString("es-CO", { maximumFractionDigits: 0 });

console.log(`\nProyecto: ${projectId}\n`);
console.log("Conjunto".padEnd(28) + "cuotaIncome".padStart(14) + "totalAntes".padStart(14) + "totalDespués".padStart(14) + "delta".padStart(12) + "  asientos");
console.log("─".repeat(96));

let conCambio = 0;
for (const [tid, b] of [...porTenant.entries()].sort()) {
  const antes = b.cuotaIncome + b.ledgerVieja;
  const despues = b.cuotaIncome + b.ledgerNueva;
  const delta = despues - antes;
  if (delta !== 0) conCambio += 1;
  const marca = esEjemplo.get(tid) ? " (ejemplo)" : "";
  const linea =
    (tid + marca).padEnd(28) +
    fmt(b.cuotaIncome).padStart(14) +
    fmt(antes).padStart(14) +
    fmt(despues).padStart(14) +
    (delta === 0 ? "—" : fmt(delta)).padStart(12) +
    "  " + (b.asientosQueCambian || "");
  console.log(delta === 0 ? linea : `${linea}  ←`);
}

console.log("─".repeat(96));
console.log(`\nConjuntos cuyo total de ingresos cambia: ${conCambio} de ${porTenant.size}\n`);
