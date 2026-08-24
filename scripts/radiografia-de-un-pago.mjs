/**
 * radiografia-de-un-pago.mjs — todo lo que un pago dejó escrito, en una pantalla.
 *
 * POR QUÉ EXISTE
 * --------------
 * Un pago toca cinco colecciones a la vez —el cargo, el libro, el recibo, el
 * anticipo si sobró, y la auditoría— y verificar que quedó bien obligaba a
 * consultarlas de una en una. Se escribió esa consulta a mano cuatro veces el
 * 24 de agosto de 2026, y las cuatro por lo mismo: **el defecto de ese día vivía
 * entre dos colecciones**, no dentro de una. Lo que no se mira junto no se ve.
 *
 * DE SOLO LECTURA. No hay ninguna escritura en este fichero.
 *
 * USO
 * ---
 *   node scripts/radiografia-de-un-pago.mjs <projectId> <tenantId> [statementId]
 *
 * Sin `statementId` enseña los últimos movimientos del conjunto, que es como se
 * empieza cuando no se sabe qué buscar.
 */

import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const [projectId, tenantId, statementId] = process.argv.slice(2);
if (!projectId || !tenantId) {
  console.error("Uso: node scripts/radiografia-de-un-pago.mjs <projectId> <tenantId> [statementId]");
  process.exit(1);
}
initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();

const seg = (t) => t?._seconds ?? t?.seconds ?? 0;
const cuando = (t) => (seg(t) ? new Date(seg(t) * 1000).toISOString().slice(0, 19).replace("T", " ") : "—");
const dinero = (n) => (typeof n === "number" ? n.toLocaleString("es-CO") : String(n ?? "—"));

console.log(`${projectId}${projectId === "hogaru-1" ? " (PRODUCCIÓN)" : ""} · ${tenantId}\n`);

if (!statementId) {
  const led = await db.collection("ledgerEntries").where("tenantId", "==", tenantId).get();
  const ultimos = led.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => seg(b.createdAt) - seg(a.createdAt)).slice(0, 12);
  console.log("Últimos movimientos del libro — pasa un statementId para la radiografía completa\n");
  for (const e of ultimos) {
    console.log(
      `  ${cuando(e.createdAt)}  ${String(e.type).padEnd(7)} ${dinero(e.amount).padStart(12)}  ${String(e.sourceType ?? "-").padEnd(16)} ${e.concept ?? ""}`,
    );
  }
  process.exit(0);
}

const cargo = await db.collection("billingStatements").doc(statementId).get();
if (!cargo.exists) {
  console.error(`No existe el cargo ${statementId}.`);
  process.exit(1);
}
const c = cargo.data();
console.log("── EL CARGO ──────────────────────────────────────────────────");
console.log(`  ${statementId}  ${c.unitLabel ?? c.unitId} · ${c.period} · ${c.concept ?? "-"}`);
console.log(`  facturado ${dinero(c.amount)} · pagado ${dinero(c.paymentAmount)} · anticipo ${dinero(c.advanceAppliedAmount ?? 0)} · saldo ${dinero(c.balance)} · ${c.status}`);
// R4: lo cubierto con anticipos no está en `paymentAmount` y sí salda. Si esta
// resta no da cero, hay un descuadre y es lo primero que hay que mirar.
const cuadra = (c.amount ?? 0) - (c.paymentAmount ?? 0) - (c.advanceAppliedAmount ?? 0) - (c.balance ?? 0);
console.log(`  ${cuadra === 0 ? "✓ cuadra" : `✗ DESCUADRE de ${dinero(cuadra)} (facturado − pagado − anticipo − saldo)`}`);

const [led, vou, adv, app, aud] = await Promise.all([
  db.collection("ledgerEntries").where("tenantId", "==", tenantId).get(),
  db.collection("paymentVouchers").where("tenantId", "==", tenantId).get(),
  db.collection("advances").where("tenantId", "==", tenantId).get(),
  db.collection("advanceApplications").where("tenantId", "==", tenantId).get(),
  db.collection("auditLogs").where("tenantId", "==", tenantId).get(),
]);

const asientos = led.docs.map((d) => ({ id: d.id, ...d.data() })).filter((e) => e.sourceId === statementId);
console.log("\n── EL LIBRO ──────────────────────────────────────────────────");
if (asientos.length === 0) console.log("  (ningún asiento apunta a este cargo)");
for (const e of asientos) {
  console.log(`  ${cuando(e.createdAt)}  ${String(e.type).padEnd(7)} ${dinero(e.amount).padStart(12)}  cuenta=${e.accountCode ?? "-"} categoria=${e.category ?? "-"}`);
  // D-C: el asiento tenía `bankAccountId: null` fijo hasta FLOW-002. Que salga
  // «(sin cuenta)» en un pago por transferencia es exactamente el defecto viejo.
  console.log(`      origen=${e.sourceType ?? "-"} banco=${e.bankAccountId ?? "(sin cuenta)"} revertido=${e.reversedSourceType ?? "no"}`);
}

// **El recibo NO cuelga del cargo.** Con un pago repartido cubre varias líneas,
// así que se ata por `ledgerEntryId` —el asiento de la primera— y por
// `operationKey`, que las une todas. Buscarlo por `statementId` devolvía
// «ninguno» sobre pagos que sí habían emitido recibo: una herramienta que
// miente sobre un recibo es peor que no tenerla.
const idsDeAsiento = new Set(asientos.map((e) => e.id));
const recibos = vou.docs
  .map((d) => ({ id: d.id, ...d.data() }))
  .filter((v) => idsDeAsiento.has(v.ledgerEntryId) || v.statementId === statementId);
console.log("\n── EL RECIBO ─────────────────────────────────────────────────");
if (recibos.length === 0) console.log("  (ninguno — normal si el cobro vino de un comprobante del residente)");
for (const v of recibos) console.log(`  ${v.code ?? v.id} · ${dinero(v.amount)} · ${v.issueDate ?? "-"}${v.anulado ? " · ANULADO" : ""}`);

const cruces = app.docs.map((d) => ({ id: d.id, ...d.data() })).filter((a) => a.statementId === statementId);
const anticipos = adv.docs.map((d) => ({ id: d.id, ...d.data() }));
console.log("\n── ANTICIPOS ─────────────────────────────────────────────────");
if (cruces.length === 0) console.log("  (ningún cruce contra este cargo)");
for (const a of cruces) {
  const origen = anticipos.find((x) => x.id === a.advanceId);
  console.log(`  cruce ${a.id} · ${dinero(a.amount)} · ${a.date}${a.reversedAt ? " · DESHECHO" : ""}`);
  if (origen) console.log(`      del anticipo ${a.advanceId}: ${dinero(origen.amount)} originales, quedan ${dinero(origen.remaining)}, ${origen.status}`);
}

const rastro = aud.docs.map((d) => ({ id: d.id, ...d.data() }))
  .filter((x) => JSON.stringify(x.metadata ?? {}).includes(statementId))
  .sort((a, b) => seg(a.createdAt) - seg(b.createdAt));
console.log("\n── LA AUDITORÍA ──────────────────────────────────────────────");
// Una auditoría que NO se escribió es invisible: no hay error en ningún sitio,
// simplemente falta la fila. Por eso se enseña aquí, al lado del efecto.
if (rastro.length === 0) console.log("  (NINGUNA fila — si hubo una operación, su auditoría no se escribió)");
for (const x of rastro) console.log(`  ${cuando(x.createdAt)}  ${x.action}  ${JSON.stringify(x.metadata)}`);
