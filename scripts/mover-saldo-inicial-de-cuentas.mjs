/**
 * mover-saldo-inicial-de-cuentas.mjs
 *
 * Saca `openingBalance` de `bankAccounts` y lo deja en `bankAccountBalances`,
 * un documento por cuenta y con el MISMO id.
 *
 * POR QUÉ EXISTE
 * --------------
 * `FLOW-002` CA11 pide que el residente diga a qué cuenta pagó, y para eso tiene
 * que poder leer las cuentas del conjunto. Las reglas de Firestore conceden o
 * niegan el documento ENTERO —no se pueden ocultar campos—, así que abrir esa
 * lectura con el saldo dentro le enseñaría al residente con cuánto dinero abrió
 * cada cuenta el conjunto. El número de cuenta sí puede verlo: es a donde
 * transfiere. El saldo no.
 *
 * EL ORDEN IMPORTA, Y ES LO ÚNICO DELICADO DE ESTE SCRIPT
 * ------------------------------------------------------
 * Este script va **ANTES** de desplegar las reglas nuevas. Al revés, entre el
 * despliegue y la migración habría una ventana en la que los residentes pueden
 * leer el saldo. No es hipotético: `conjunto-las-playas` tiene una cuenta
 * sembrada con 85.000.
 *
 *   1. node scripts/mover-saldo-inicial-de-cuentas.mjs --proyecto X --escribir
 *   2. firebase deploy --only firestore:rules --project X
 *
 * QUÉ ESCRIBE — y nada más
 * ------------------------
 *   bankAccountBalances/{idDeLaCuenta} : { tenantId, openingBalance, migradoEn }
 *   bankAccounts/{idDeLaCuenta}        : borra el campo `openingBalance`
 *
 * Las dos van en un `batch`, así que una cuenta nunca se queda con el saldo
 * borrado de un sitio y sin escribir en el otro.
 *
 * ES IDEMPOTENTE. Una cuenta que ya no tiene `openingBalance` se salta. Volver a
 * correrlo no pisa un saldo ya migrado y editado después desde la aplicación.
 *
 * USO
 * ---
 *   gcloud auth application-default login       # la credencial caduca aparte
 *   node scripts/mover-saldo-inicial-de-cuentas.mjs --proyecto vivaru-staging-02
 *   node scripts/mover-saldo-inicial-de-cuentas.mjs --proyecto vivaru-staging-02 --escribir
 */

import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const args = process.argv.slice(2);
const ESCRIBIR = args.includes("--escribir");
const iProyecto = args.indexOf("--proyecto");
const PROYECTO = iProyecto >= 0 ? args[iProyecto + 1] : null;

if (!PROYECTO) {
  console.error("Falta --proyecto. Ej: --proyecto vivaru-staging-02 (o hogaru-1 para producción).");
  process.exit(1);
}

initializeApp({ credential: applicationDefault(), projectId: PROYECTO });
const db = getFirestore();

console.log(`Proyecto: ${PROYECTO}${PROYECTO === "hogaru-1" ? " (PRODUCCIÓN)" : ""}`);
console.log(`Modo    : ${ESCRIBIR ? "ESCRITURA REAL" : "ensayo (no escribe)"}\n`);

const cuentas = await db.collection("bankAccounts").get();
console.log(`Cuentas bancarias: ${cuentas.size}`);

const pendientes = cuentas.docs.filter((d) => d.data().openingBalance !== undefined);
const yaMigradas = cuentas.size - pendientes.length;
console.log(`Ya sin el campo   : ${yaMigradas}`);
console.log(`Por migrar        : ${pendientes.length}\n`);

if (pendientes.length === 0) {
  console.log("Nada que hacer.");
  process.exit(0);
}

for (const d of pendientes) {
  const c = d.data();
  console.log(`  ${d.id}  ${String(c.label ?? "(sin nombre)").padEnd(28)} conjunto=${c.tenantId ?? "?"}  saldo=${c.openingBalance}`);
}

if (!ESCRIBIR) {
  console.log("\nEnsayo: no se escribió nada. Repite con --escribir.");
  process.exit(0);
}

// Un lote por cuenta: las dos escrituras de una misma cuenta van juntas o no
// van. No se agrupan todas en un lote único a propósito — un fallo a mitad
// dejaría un resultado parcial más difícil de leer que unas cuantas cuentas
// migradas y el resto intactas, que es exactamente lo que este script sabe
// retomar.
let hechas = 0;
for (const d of pendientes) {
  const c = d.data();
  const saldo = typeof c.openingBalance === "number" && Number.isFinite(c.openingBalance) ? c.openingBalance : 0;
  const lote = db.batch();
  lote.set(
    db.collection("bankAccountBalances").doc(d.id),
    { tenantId: c.tenantId ?? null, openingBalance: saldo, migradoEn: FieldValue.serverTimestamp() },
    { merge: true },
  );
  lote.update(d.ref, { openingBalance: FieldValue.delete() });
  await lote.commit();
  hechas += 1;
}

console.log(`\nMigradas ${hechas} cuentas.`);
console.log("Siguiente paso: firebase deploy --only firestore:rules --project " + PROYECTO);
