// SOLO LECTURA: cuanto se desvia el INFORME AUTOMATICO mensual del estado
// financiero de pantalla, por usar una regla de exclusion distinta.
//
// Reproduce las DOS reglas que conviven HOY, sobre los mismos asientos:
//
//   A) La del job `monthlyFinancialArchive` (functions/src/index.ts:3575):
//      `category !== "alicuota"`. Es la regla VIEJA — R12 nunca llego aqui.
//
//   B) La de `esRecaudoDeCartera` (src/features/finanzas/financial-statement.ts:171),
//      que mira el ORIGEN y arrastra el reverso (R12 + R13).
//
// Este script comparaba antes la regla vieja contra una version de la nueva
// SIN `reversedSourceType`, que es una regla que **no existe en ningun sitio**:
// se escribio antes de R13. Medir contra una regla imaginaria no dice nada.
//
// Lo que importa no es la diferencia de totales sino **cuantos asientos caen de
// lado distinto**: comparar antes/despues no prueba que una regla sea inerte,
// aplicar las dos sobre los mismos datos si.
//
// `cuotaIncome` se calcula igual que la pagina de Finanzas: la suma de
// `paymentAmount` de TODOS los cargos del conjunto, sin mirar el concepto.
//
// Solo imprime agregados por conjunto. Ningun concepto, unidad ni residente.
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

// A) la del job de functions, que solo mira la categoria.
const reglaJob = (e) => e.category === "alicuota";
// B) la de pantalla: origen, reverso y la rama de convivencia.
const reglaPantalla = (e) =>
  e.sourceType === "billingStatement" ||
  e.reversedSourceType === "billingStatement" ||
  e.category === "alicuota";

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
    porTenant.set(tid, { cuotaIncome: 0, ledgerJob: 0, ledgerPantalla: 0, asientosQueCambian: 0 });
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
  if (!reglaJob(d)) b.ledgerJob += monto;
  if (!reglaPantalla(d)) b.ledgerPantalla += monto;
  if (reglaJob(d) !== reglaPantalla(d)) b.asientosQueCambian += 1;
}

const fmt = (n) => n.toLocaleString("es-CO", { maximumFractionDigits: 0 });

console.log(`\nProyecto: ${projectId}\n`);
console.log("Conjunto".padEnd(28) + "cuotaIncome".padStart(14) + "informeJob".padStart(14) + "pantalla".padStart(14) + "delta".padStart(12) + "  asientos");
console.log("─".repeat(96));

let conCambio = 0;
for (const [tid, b] of [...porTenant.entries()].sort()) {
  const informeJob = b.cuotaIncome + b.ledgerJob;
  const pantalla = b.cuotaIncome + b.ledgerPantalla;
  const delta = pantalla - informeJob;
  if (delta !== 0) conCambio += 1;
  const marca = esEjemplo.get(tid) ? " (ejemplo)" : "";
  const linea =
    (tid + marca).padEnd(28) +
    fmt(b.cuotaIncome).padStart(14) +
    fmt(informeJob).padStart(14) +
    fmt(pantalla).padStart(14) +
    (delta === 0 ? "—" : fmt(delta)).padStart(12) +
    "  " + (b.asientosQueCambian || "");
  console.log(delta === 0 ? linea : `${linea}  ←`);
}

console.log("─".repeat(96));
console.log(`\nConjuntos donde el informe automatico NO coincide con la pantalla: ${conCambio} de ${porTenant.size}\n`);
