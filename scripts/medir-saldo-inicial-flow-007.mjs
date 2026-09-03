/**
 * medir-saldo-inicial-flow-007.mjs — mide `TBD-M1` de `PRD-V-FLOW-007`.
 *
 * POR QUÉ EXISTE: la entrega 1 ancla el informe mensual al saldo real del banco
 * en vez de a cero. Si NINGÚN conjunto tiene saldo inicial registrado, esa
 * entrega no cambia una sola cifra y se leería como un no-op —el error que este
 * repositorio ya cometió con tres capacidades encendidas sobre tablas vacías—.
 * Este script decide eso ANTES de escribir el código, no después.
 *
 * Es de SOLO LECTURA por construcción: no hay ninguna escritura en el fichero.
 *
 *   node scripts/medir-saldo-inicial-flow-007.mjs hogaru-1
 */
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const projectId = process.argv[2] ?? "hogaru-1";
initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();

const snap = async (c) => (await db.collection(c).get()).docs.map((d) => ({ id: d.id, ...d.data() }));

const tenants = await snap("tenants");
const balances = await snap("bankAccountBalances");
const accounts = await snap("bankAccounts");

// OJO: los NUEVE conjuntos del proyecto de producción son `isExample: true`
// —producción no tiene clientes todavía, medido el 26 de agosto—. Filtrar por
// `isExample !== true` deja la población en CERO y el conteo saldría vacío
// leyéndose como «ningún conjunto tiene saldo», que es una respuesta distinta.
// La población de `TBD-M1` son los nueve, y se cuentan todos.
const reales = tenants;
const ejemplos = tenants.filter((t) => t.isExample === true).length;
console.log(`== tenants: ${tenants.length} total (${ejemplos} con isExample: true) — la población son los ${reales.length}`);

console.log(`\n== bankAccountBalances: ${balances.length} documentos`);
const campos = new Set();
balances.forEach((b) => Object.keys(b).forEach((k) => campos.add(k)));
console.log("campos presentes:", [...campos].sort().join(", ") || "(ninguno)");

console.log(`\n== bankAccounts: ${accounts.length} documentos`);
const camposCuenta = new Set();
accounts.forEach((a) => Object.keys(a).forEach((k) => camposCuenta.add(k)));
console.log("campos presentes:", [...camposCuenta].sort().join(", ") || "(ninguno)");
const conSaldoViejo = accounts.filter((a) => a.openingBalance !== undefined);
console.log(`cuentas que TODAVÍA llevan openingBalance dentro: ${conSaldoViejo.length}`);

// El conteo que decide la entrega 1.
const num = (v) => (typeof v === "number" ? v : Number(v));
const porTenant = new Map();
for (const b of balances) {
  const v = num(b.openingBalance);
  if (!porTenant.has(b.tenantId)) porTenant.set(b.tenantId, []);
  porTenant.get(b.tenantId).push({ id: b.id, valor: v });
}

console.log("\n== TBD-M1 · saldo inicial por conjunto de producción");
let conDato = 0;
let conDatoNoCero = 0;
for (const t of reales) {
  const filas = porTenant.get(t.id) ?? [];
  const presentes = filas.filter((f) => Number.isFinite(f.valor));
  const noCero = presentes.filter((f) => f.valor !== 0);
  if (presentes.length > 0) conDato += 1;
  if (noCero.length > 0) conDatoNoCero += 1;
  const cuentas = accounts.filter((a) => a.tenantId === t.id).length;
  console.log(
    `  ${(t.name ?? t.id).padEnd(28)} cuentas=${String(cuentas).padStart(2)} ` +
      `saldos=${String(presentes.length).padStart(2)} ` +
      `no-cero=${String(noCero.length).padStart(2)} ` +
      `valores=[${presentes.map((f) => f.valor).join(", ")}]`,
  );
}

console.log(`\nRESULTADO TBD-M1:`);
console.log(`  conjuntos de producción con ALGÚN saldo inicial registrado: ${conDato} de ${reales.length}`);
console.log(`  conjuntos con algún saldo inicial DISTINTO DE CERO:         ${conDatoNoCero} de ${reales.length}`);

// Saldos huérfanos: documentos de saldo cuyo tenant no es de producción.
const idsReales = new Set(reales.map((t) => t.id));
const huerfanos = balances.filter((b) => !idsReales.has(b.tenantId));
console.log(`  documentos de saldo que NO son de un conjunto de producción: ${huerfanos.length}`);
