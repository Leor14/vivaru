/**
 * medir-conciliacion.mjs — mide el terreno de la conciliación bancaria.
 *
 * POR QUÉ EXISTE: las reglas de `PRD-V-FLOW-004` (la coherencia de efecto, la
 * ventana de fecha y la clave de duplicado) se fijaron con las cifras que saca
 * este script, no eligiéndolas. Sin él, la ficha no es reproducible.
 *
 * Lo que enseña, y cada cosa contesta una pregunta de la PRD:
 *   - la forma real de las líneas y cuántas hay por conjunto y por lote;
 *   - los duplicados CON y SIN la descripción en la clave — la diferencia es el
 *     argumento de R5;
 *   - la integridad del enlace línea ↔ asiento en los dos sentidos;
 *   - cuántos candidatos por monto y por fecha tiene cada línea pendiente, que
 *     es lo que sostiene R4.
 *
 * Es de SOLO LECTURA por construcción: no hay ninguna escritura en el fichero.
 *
 *   node scripts/medir-conciliacion.mjs hogaru-1
 */
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const projectId = process.argv[2] ?? "hogaru-1";
initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();

const snap = async (c) => (await db.collection(c).get()).docs.map((d) => ({ id: d.id, ...d.data() }));

const lines = await snap("bankStatementLines");
const ledger = await snap("ledgerEntries");
const accounts = await snap("bankAccounts");

console.log(`== bankStatementLines: ${lines.length}`);
const keys = new Set();
lines.forEach((l) => Object.keys(l).forEach((k) => keys.add(k)));
console.log("campos presentes:", [...keys].sort().join(", "));

const by = (arr, f) => arr.reduce((m, x) => ((m[f(x)] = (m[f(x)] ?? 0) + 1), m), {});
console.log("por tenant:", JSON.stringify(by(lines, (l) => l.tenantId)));
console.log("por reconciled:", JSON.stringify(by(lines, (l) => String(l.reconciled))));
console.log("por importBatchId:", JSON.stringify(by(lines, (l) => l.importBatchId ?? "(sin)")));
console.log("por bankAccountId:", JSON.stringify(by(lines, (l) => l.bankAccountId ?? "(sin)")));
console.log("signo del monto:", JSON.stringify(by(lines, (l) => (l.amount > 0 ? "+" : l.amount < 0 ? "-" : "0"))));
console.log("isExample:", JSON.stringify(by(lines, (l) => String(l.isExample))));

console.log("\n-- las 27 líneas (fecha | monto | conciliada | descripción) --");
[...lines].sort((a,b)=>String(a.date).localeCompare(String(b.date))).forEach((l) =>
  console.log(`${l.id.slice(0,6)} ${l.date} ${String(l.amount).padStart(12)} ${l.reconciled ? "SI" : "no"} ${l.matchedLedgerEntryId ? "→"+String(l.matchedLedgerEntryId).slice(0,6) : "      "} | ${JSON.stringify(l.description)}`)
);

// Duplicados candidatos
const clave = (l) => `${l.tenantId}|${l.bankAccountId}|${l.date}|${l.amount}`;
const dup = {};
lines.forEach((l) => (dup[clave(l)] = (dup[clave(l)] ?? []).concat(l.id)));
const dups = Object.entries(dup).filter(([, v]) => v.length > 1);
console.log(`\n-- duplicados por (tenant|cuenta|fecha|monto): ${dups.length} grupos --`);
dups.forEach(([k, v]) => console.log(`  ${k}  x${v.length}  ${v.map(x=>x.slice(0,6)).join(",")}`));

const clave2 = (l) => `${l.tenantId}|${l.bankAccountId}|${l.date}|${l.amount}|${(l.description??"").trim().toLowerCase()}`;
const dup2 = {};
lines.forEach((l) => (dup2[clave2(l)] = (dup2[clave2(l)] ?? []).concat(l.id)));
console.log(`duplicados incluyendo descripción: ${Object.values(dup2).filter(v=>v.length>1).length} grupos`);

console.log(`\n== bankAccounts: ${accounts.length}`);
accounts.forEach((a) => console.log(`  ${a.id.slice(0,6)} tenant=${a.tenantId} ${JSON.stringify({name:a.name, bank:a.bankName, currency:a.currency, saldo:a.currentBalance ?? a.balance})}`));

console.log(`\n== ledgerEntries: ${ledger.length}`);
const lkeys = new Set(); ledger.forEach((e)=>Object.keys(e).forEach(k=>lkeys.add(k)));
console.log("campos presentes:", [...lkeys].sort().join(", "));
console.log("por reconciled:", JSON.stringify(by(ledger, (e) => String(e.reconciled))));
console.log("por sourceType:", JSON.stringify(by(ledger, (e) => String(e.sourceType))));
console.log("por tenant:", JSON.stringify(by(ledger, (e) => e.tenantId)));

// Integridad del enlace bidireccional
const lineById = new Map(lines.map((l) => [l.id, l]));
const ledById = new Map(ledger.map((e) => [e.id, e]));
let rotos = [];
lines.filter((l) => l.reconciled || l.matchedLedgerEntryId).forEach((l) => {
  const e = ledById.get(l.matchedLedgerEntryId);
  if (!e) rotos.push(`línea ${l.id.slice(0,6)} apunta a asiento inexistente (${l.matchedLedgerEntryId})`);
  else if (e.bankStatementLineId !== l.id) rotos.push(`línea ${l.id.slice(0,6)} → asiento ${e.id.slice(0,6)} que apunta a ${String(e.bankStatementLineId).slice(0,6)}`);
  else if (e.tenantId !== l.tenantId) rotos.push(`línea ${l.id.slice(0,6)} conciliada CRUZANDO tenant`);
});
ledger.filter((e) => e.reconciled || e.bankStatementLineId).forEach((e) => {
  const l = lineById.get(e.bankStatementLineId);
  if (!l) rotos.push(`asiento ${e.id.slice(0,6)} reconciled=${e.reconciled} apunta a línea inexistente (${e.bankStatementLineId})`);
});
console.log(`\n-- integridad del enlace: ${rotos.length} incoherencias --`);
rotos.forEach((r) => console.log("  " + r));

// ¿cuántos asientos conciliados tienen contraparte de banco?
const conc = ledger.filter((e) => e.reconciled);
console.log(`asientos reconciled=true: ${conc.length}; de ellos con bankStatementLineId: ${conc.filter(e=>e.bankStatementLineId).length}`);

// Candidatos determinísticos: para cada línea sin conciliar, asientos del mismo tenant con mismo monto
const pendientes = lines.filter((l) => !l.reconciled);
console.log(`\n-- candidatos por monto exacto, para las ${pendientes.length} líneas pendientes --`);
pendientes.forEach((l) => {
  const cands = ledger.filter((e) => e.tenantId === l.tenantId && !e.reconciled && Math.abs(Number(e.amount) - Math.abs(Number(l.amount))) < 0.01);
  const exactos = cands.filter((e) => e.date === l.date);
  console.log(`  ${l.id.slice(0,6)} ${l.date} ${l.amount}: ${cands.length} por monto, ${exactos.length} también misma fecha`);
});
