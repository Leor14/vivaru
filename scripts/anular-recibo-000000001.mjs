/**
 * anular-recibo-000000001.mjs
 *
 * Corrección manual, de una sola vez, sobre PRODUCCIÓN (`hogaru-1`).
 *
 * POR QUÉ EXISTE
 * --------------
 * El recibo `000000001` (Apartamento 503, $1.120.000) se emitió ANTES del cambio
 * del 20 de agosto de 2026 que metió la emisión dentro de la transacción del pago.
 * David revirtió ese pago y el reverso está bien, pero la operación de pago es
 * anterior al cambio y **no guarda `voucherId`**, así que el reverso no tenía por
 * dónde encontrar el recibo. El recibo sigue figurando como válido.
 *
 * Ver `docs/pendientes.md` → «Cabo suelto en producción».
 *
 * QUÉ ESCRIBE — y nada más
 * ------------------------
 *   anulado       : true
 *   anuladoEn     : Timestamp.now()
 *   anuladoPor    : "correccion-manual"
 *   anuladoMotivo : (texto abajo)
 *
 * **NO toca el secuencial.** Decisión de David: cambiarle el número a un papel que
 * alguien ya descargó es peor que soportar dos formas. Tampoco escribe `updatedAt`
 * ni `updatedBy`, que sugerirían que lo hizo la aplicación.
 *
 * `anuladoEn` va como Timestamp, no como texto, para que coincida con lo que
 * escribe el reverso automático en `functions/src/payments.ts`. (El tipo de
 * `src/types/domain.ts` lo declara `string`; la discrepancia es previa a este
 * script y no se corrige aquí.)
 *
 * SEGURIDAD
 * ---------
 * - Por defecto NO escribe: enseña lo que haría y sale (ensayo).
 * - Solo escribe con `--escribir`.
 * - Antes de escribir comprueba la huella del documento (secuencial, importe,
 *   unidad). Si no cuadra, se niega.
 * - Es idempotente: si ya está anulado, no vuelve a escribir.
 * - `paymentVouchers` solo tiene disparador de CREACIÓN
 *   (`onPaymentVoucherCreated`), así que esta actualización no manda ningún correo.
 *
 * USO
 * ---
 *   gcloud auth application-default login      # la credencial caduca aparte
 *   node scripts/anular-recibo-000000001.mjs             # ensayo
 *   node scripts/anular-recibo-000000001.mjs --escribir  # escribe de verdad
 */

import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

const PROYECTO = "hogaru-1"; // producción
const SECUENCIAL = "000000001";
const IMPORTE_ESPERADO = 1120000;
const UNIDAD_ESPERADA = "503";
const MOTIVO =
  "Pago revertido manualmente el 20 de agosto de 2026. La operación de pago es " +
  "anterior al cambio que enlaza el recibo con su pago, así que el reverso no " +
  "pudo anularlo automáticamente. Anulado a mano para que deje de figurar como válido.";

const ESCRIBIR = process.argv.includes("--escribir");

initializeApp({ credential: applicationDefault(), projectId: PROYECTO });
const db = getFirestore();

function fin(codigo, mensaje) {
  console.log(`\n${mensaje}`);
  process.exit(codigo);
}

// ── 1. Localizar el recibo ───────────────────────────────────────────────────
console.log(`Proyecto: ${PROYECTO} (PRODUCCIÓN)`);
console.log(`Modo    : ${ESCRIBIR ? "ESCRITURA REAL" : "ensayo (no escribe)"}\n`);

const todos = await db.collection("paymentVouchers").get();
console.log(`Recibos en la colección: ${todos.size}`);

const candidatos = todos.docs.filter(
  (d) => d.data().sequentialNumber === SECUENCIAL || d.data().code === SECUENCIAL,
);

if (candidatos.length === 0) {
  fin(1, `ERROR: no hay ningún recibo con secuencial/código ${SECUENCIAL}. No se escribe nada.`);
}
if (candidatos.length > 1) {
  fin(1, `ERROR: hay ${candidatos.length} recibos con ${SECUENCIAL}. Ambiguo. No se escribe nada.`);
}

const doc = candidatos[0];
const v = doc.data();

console.log("\n── Recibo encontrado ─────────────────────────────");
console.log("docId           :", doc.id);
console.log("code            :", v.code ?? "(ausente)");
console.log("sequentialNumber:", v.sequentialNumber ?? "(ausente)");
console.log("tenantId        :", v.tenantId);
console.log("importe         :", v.amount);
console.log("concepto        :", v.concept);
console.log("unidad          :", v.payerUnitLabel ?? "(ausente)");
console.log("pagador         :", v.payerName ?? "(ausente)");
console.log("fecha emisión   :", v.issueDate);
console.log("operationKey    :", v.operationKey ?? "(AUSENTE — es la causa del problema)");
console.log("anulado         :", v.anulado ?? "(ausente)");

// ── 2. Comprobar la huella ───────────────────────────────────────────────────
const problemas = [];
if (v.amount !== IMPORTE_ESPERADO) {
  problemas.push(`el importe es ${v.amount}, se esperaba ${IMPORTE_ESPERADO}`);
}
if (!String(v.payerUnitLabel ?? "").includes(UNIDAD_ESPERADA)) {
  problemas.push(`la unidad es "${v.payerUnitLabel}", se esperaba que contuviera "${UNIDAD_ESPERADA}"`);
}
if (problemas.length > 0) {
  fin(1, `ERROR: la huella no cuadra:\n  - ${problemas.join("\n  - ")}\nNo se escribe nada.`);
}
console.log("\nHuella comprobada: importe y unidad coinciden.");

// ── 3. Idempotencia ──────────────────────────────────────────────────────────
if (v.anulado === true) {
  console.log("\nYa estaba anulado:");
  console.log("  anuladoEn    :", v.anuladoEn);
  console.log("  anuladoPor   :", v.anuladoPor);
  console.log("  anuladoMotivo:", v.anuladoMotivo);
  fin(0, "Nada que hacer. El script es idempotente.");
}

// ── 4. Escribir (o enseñar lo que escribiría) ────────────────────────────────
const cambio = {
  anulado: true,
  anuladoEn: Timestamp.now(),
  anuladoPor: "correccion-manual",
  anuladoMotivo: MOTIVO,
};

console.log("\n── Se escribirán EXACTAMENTE estos 4 campos ──────");
console.log("  anulado       : true");
console.log("  anuladoEn     : Timestamp (ahora)");
console.log('  anuladoPor    : "correccion-manual"');
console.log(`  anuladoMotivo : "${MOTIVO}"`);
console.log("\nNO se toca: sequentialNumber, code, amount, updatedAt, updatedBy, ni ningún otro campo.");

if (!ESCRIBIR) {
  fin(0, "ENSAYO. No se ha escrito nada. Para escribir de verdad:\n  node scripts/anular-recibo-000000001.mjs --escribir");
}

await doc.ref.update(cambio);
console.log("\nESCRITO.");

// ── 5. Releer para comprobar ─────────────────────────────────────────────────
const despues = (await doc.ref.get()).data();
console.log("\n── Releído de Firestore ─────────────────────────");
console.log("anulado         :", despues.anulado);
console.log("anuladoEn       :", despues.anuladoEn?.toDate?.().toISOString() ?? despues.anuladoEn);
console.log("anuladoPor      :", despues.anuladoPor);
console.log("anuladoMotivo   :", despues.anuladoMotivo);
console.log("sequentialNumber:", despues.sequentialNumber, "(intacto)");
console.log("code            :", despues.code ?? "(ausente)", "(intacto)");
console.log("amount          :", despues.amount, "(intacto)");

const ok =
  despues.anulado === true &&
  despues.anuladoPor === "correccion-manual" &&
  despues.sequentialNumber === v.sequentialNumber &&
  despues.amount === v.amount;

fin(ok ? 0 : 1, ok ? "Comprobado: anulado, y el secuencial y el importe intactos." : "AVISO: la relectura no cuadra. Revisar a mano.");
