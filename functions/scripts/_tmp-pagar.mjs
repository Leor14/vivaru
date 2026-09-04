// Paga una cuota llamando a `pagarCuota`, **la misma función que ejecuta la
// callable `payExpenseInstallment`**: marca la cuota, crea SU asiento en el libro
// y recalcula `paidAmount` y el estado, todo en una transacción. Lo único que no
// pasa por aquí son las guardas de AUTORIZACIÓN.
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
initializeApp({ credential: applicationDefault(), projectId: "hogaru-1" });
const { pagarCuota } = await import("../lib/egresos-en-cuotas.js");
const { sumarDeudaAProveedores } = await import("../lib/nucleo-estado-financiero.js");
const db = getFirestore();

const T = "conjunto-las-playas", ID = "exp-playas-012", UID = "script-david-flow008";
const todos = async () => (await db.collection("expenses").where("tenantId","==",T).get()).docs.map(d=>d.data());
const asientos = async () => (await db.collection("ledgerEntries").where("tenantId","==",T).where("sourceId","==",ID).get()).docs;

console.log("ANTES");
console.log("  deuda del conjunto:", sumarDeudaAProveedores(await todos()).toLocaleString("es-CO"));
console.log("  asientos de esta factura:", (await asientos()).length);

const r = await pagarCuota({ tenantId: T, expenseId: ID, installmentNumber: 1, paidAt: "2026-09-04" }, UID);
console.log("\npagarCuota →", JSON.stringify(r));

const d = (await db.collection("expenses").doc(ID).get()).data();
console.log("\nDESPUÉS");
console.log("  estado:", d.status, "· paidAmount:", d.paidAmount);
for (const c of d.installments) console.log(`   cuota ${c.number}  ${c.dueDate}  ${c.amount}  ${c.status}${c.ledgerEntryId ? "  asiento=" + c.ledgerEntryId : ""}`);
console.log("  deuda del conjunto:", sumarDeudaAProveedores(await todos()).toLocaleString("es-CO"), " (antes 33.150)");

const a = (await asientos())[0].data();
console.log("\nEL ASIENTO QUE ENTRÓ AL LIBRO");
for (const k of ["type","date","amount","concept","category","accountCode","sourceType","sourceId","installmentNumber","reconciled"])
  console.log(`  ${k.padEnd(18)}: ${JSON.stringify(a[k])}`);
