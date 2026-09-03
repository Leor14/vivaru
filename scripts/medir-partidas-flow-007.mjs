/**
 * medir-partidas-flow-007.mjs — mide las DOS partidas nuevas de la entrega 1 de
 * `PRD-V-FLOW-007`: cuentas pendientes de cobro y deuda a proveedores.
 *
 * `R5` de la ficha advierte que la deuda a proveedores puede salir en cero
 * porque no hay proveedores registrados. Eso NO se decide leyendo el código: se
 * cuenta. Solo lectura.
 *
 *   node scripts/medir-partidas-flow-007.mjs hogaru-1
 */
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const projectId = process.argv[2] ?? "hogaru-1";
initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();
const snap = async (c) => (await db.collection(c).get()).docs.map((d) => ({ id: d.id, ...d.data() }));

const tenants = await snap("tenants");
const expenses = await snap("expenses");
const vendors = await snap("vendors");
const billing = await snap("billingStatements");

const cuenta = (arr, f) => arr.reduce((m, x) => ((m[f(x)] = (m[f(x)] ?? 0) + 1), m), {});

console.log(`== expenses: ${expenses.length}`);
console.log("   por status:", JSON.stringify(cuenta(expenses, (e) => String(e.status))));
console.log("   con dueDate:", expenses.filter((e) => e.dueDate).length);
console.log("   con vendorId:", expenses.filter((e) => e.vendorId).length);
console.log(`== vendors: ${vendors.length}`);
console.log(`== billingStatements: ${billing.length}`);
console.log("   por status:", JSON.stringify(cuenta(billing, (b) => String(b.status))));

console.log("\n== por conjunto");
for (const t of tenants) {
  const ex = expenses.filter((e) => e.tenantId === t.id);
  // El catálogo es `registrado | pagado | anulado` —castellano—. Filtrar por
  // "paid"/"cancelled" daba los 52 egresos como pendientes, incluidos los 39 ya
  // pagados: una deuda a proveedores inflada tres veces.
  const pendientes = ex.filter((e) => e.status === "registrado");
  const deuda = pendientes.reduce((a, e) => a + (Number(e.amount) || 0), 0);
  const bs = billing.filter((b) => b.tenantId === t.id);
  const porCobrar = bs.reduce((a, b) => a + Math.max(Number(b.balance) || 0, 0), 0);
  console.log(
    `  ${(t.name ?? t.id).padEnd(32)} egresos=${String(ex.length).padStart(3)} ` +
      `pend=${String(pendientes.length).padStart(3)} deudaProv=${String(deuda).padStart(10)} ` +
      `cargos=${String(bs.length).padStart(4)} porCobrar=${String(porCobrar).padStart(12)}`,
  );
}
