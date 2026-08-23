// Borra UNA cuenta del plan de un conjunto. Para limpiar residuo de pruebas.
//
// **Existe porque la pantalla no borra, y eso es correcto** (`PRD-V-PLAT-003`
// §5.1: anadir, renombrar, desactivar). R5 dice que una cuenta con movimientos
// se DESACTIVA, y las reglas no pueden comprobar si los tiene —eso exige
// consultar otras colecciones—, asi que en la interfaz no hay boton. Aqui si se
// puede comprobar, y por eso este script existe y la pantalla no.
//
// Tres guardas, y ninguna es decorativa:
//
//   1. **Nunca borra una cuenta de sistema.** Si tiene `systemKey`, se niega.
//      Es R3, y la regla de Firestore ya lo veta para el cliente; esto usa el
//      SDK de admin, que NO pasa por las reglas, asi que la guarda tiene que
//      estar aqui o no esta en ningun sitio.
//   2. **Nunca borra una cuenta con movimientos.** Mira `ledgerEntries`,
//      `billingStatements` y `expenses` por `accountCode`. Borrarla dejaria
//      registros apuntando al vacio, y los informes agrupan por ese codigo.
//   3. **Simula por defecto.** Hay que pedir `--escribir`.
//
// Uso: node functions/scripts/borrar-cuenta-de-plan.mjs <projectId> <tenantId> <code> [--escribir]

import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const [projectId, tenantId, code, ...resto] = process.argv.slice(2);
const escribir = resto.includes("--escribir");

if (!projectId || !tenantId || !code) {
  console.error("Uso: node borrar-cuenta-de-plan.mjs <projectId> <tenantId> <code> [--escribir]");
  process.exit(1);
}

initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();

const docId = `${tenantId}_${code}`;
const snap = await db.collection("chartOfAccounts").doc(docId).get();

console.log(`\n${projectId} · ${tenantId} · cuenta ${code}`);

if (!snap.exists) {
  console.log("  no existe. Nada que borrar.\n");
  process.exit(0);
}

const data = snap.data();
console.log(`  nombre    : «${data.name}»`);
console.log(`  tipo      : ${data.type} · ${data.status}`);
console.log(`  systemKey : ${data.systemKey ?? "— (creada a mano)"}`);
console.log(`  createdBy : ${data.createdBy ?? "?"}`);

if (data.systemKey) {
  console.error("\n  NO SE BORRA: es una cuenta del plan estandar (R3). Se desactiva, no se borra.\n");
  process.exit(1);
}

// Guarda 2 — movimientos. Se cuentan en las tres colecciones que llevan
// `accountCode`, no solo en el libro: un cargo o un egreso que apunte a esta
// cuenta tambien se quedaria huerfano.
const colecciones = ["ledgerEntries", "billingStatements", "expenses"];
let movimientos = 0;
for (const col of colecciones) {
  const q = await db
    .collection(col)
    .where("tenantId", "==", tenantId)
    .where("accountCode", "==", code)
    .limit(50)
    .get();
  if (q.size) console.log(`  ${col}: ${q.size} apuntando a esta cuenta`);
  movimientos += q.size;
}

if (movimientos > 0) {
  console.error(`\n  NO SE BORRA: ${movimientos} registros apuntan a ${code}. Desactivala (R5).\n`);
  process.exit(1);
}
console.log("  movimientos: ninguno en libro, cartera ni egresos");

if (!escribir) {
  console.log("\n  Simulacion. Vuelve a correrlo con --escribir para borrarla.\n");
  process.exit(0);
}

await db.collection("chartOfAccounts").doc(docId).delete();

// Releer, no fiarse del await: es la unica forma de saber que quedo borrada.
const despues = await db.collection("chartOfAccounts").doc(docId).get();
console.log(`\n  borrada: ${!despues.exists ? "SI, releido de la base" : "NO — sigue ahi"}\n`);
