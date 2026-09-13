// Verifica, SOLO LEYENDO, que la historia sembrada cuadre con el guion y con el producto
// (docs/plan-seed-demo-lomas-de-sayilbedra.md, §7). Recalcula con las funciones del producto
// (`functions/lib`), no con una copia: un verificador que reimplementa la regla se equivoca con ella.
//
// Mismas reglas de proyecto que la semilla: con FIRESTORE_EMULATOR_HOST, solo `demo-*`; sin él,
// solo `vivaru-staging-02` o `hogaru-1`. No escribe nada en ningún caso.
//
// Uso: node functions/scripts/verificar-historia-demo.mjs <proyecto> <tenantId>

import { createRequire } from "node:module";
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

import { barrer } from "./historias/barrido.mjs";
import { DOMINIO_INERTE, construirPadron, digitoDeControlClabe, slugDeUnidad } from "./historias/lomas-de-sayilbedra.mjs";

const require = createRequire(import.meta.url);
const { calcularSaldo, TOLERANCIA_MONEDA } = require("../lib/payments.js");
const { cuentaParaCategoriaDeEgreso } = require("../lib/plan-de-cuentas.js");
const { idDeLinea } = require("../lib/conciliacion.js");

const EMULADOR = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const args = process.argv.slice(2);
const [proyecto, tenantId] = args.filter((a) => !a.startsWith("--"));
const hoyForzado = args.find((a) => a.startsWith("--hoy="))?.slice(6);
if (hoyForzado && !EMULADOR) {
  console.error("--hoy solo vale contra el emulador.");
  process.exit(1);
}
/** El «hoy» con que el producto calcula estados: el día UTC. */
const hoyUTC = hoyForzado ?? new Date().toISOString().slice(0, 10);
if (!proyecto || !tenantId) {
  console.error("Uso: verificar-historia-demo.mjs <proyecto> <tenantId>");
  process.exit(1);
}
if (EMULADOR ? !proyecto.startsWith("demo-") : !["vivaru-staging-02", "hogaru-1"].includes(proyecto)) {
  console.error(`Proyecto «${proyecto}» no admitido ${EMULADOR ? "con el emulador (demo-*)" : "(vivaru-staging-02 o hogaru-1)"}.`);
  process.exit(1);
}

initializeApp(EMULADOR ? { projectId: proyecto } : { credential: applicationDefault(), projectId: proyecto });
const db = getFirestore();
const auth = getAuth();
const padron = construirPadron(tenantId);

const resultados = [];
function comprobar(nombre, fallos) {
  resultados.push({ nombre, fallos });
  const marca = fallos.length ? "✗" : "✓";
  console.log(`${marca} ${nombre}${fallos.length ? `\n    ${fallos.slice(0, 12).join("\n    ")}${fallos.length > 12 ? `\n    … y ${fallos.length - 12} más` : ""}` : ""}`);
}

async function delConjunto(coleccion) {
  const snap = await db.collection(coleccion).where("tenantId", "==", tenantId).get();
  return new Map(snap.docs.map((d) => [d.id, d.data()]));
}

const unidades = await delConjunto("units");
const personas = await delConjunto("people");
const areas = await delConjunto("amenities");
const bancos = await delConjunto("bankAccounts");
const saldos = await delConjunto("bankAccountBalances");

console.log(`\nVerificando «${tenantId}» en ${proyecto}${EMULADOR ? " (emulador)" : ""}\n`);

// P1 · Las casas del guion, tal cual.
{
  const f = [];
  for (const c of padron.casas) {
    const u = unidades.get(c.id);
    if (!u) { f.push(`falta ${c.id}`); continue; }
    if (u.unitId !== slugDeUnidad(u.displayName)) f.push(`${c.id}: unitId «${u.unitId}» no es el slug de «${u.displayName}»`);
    if (u.coefficient !== c.coefficient) f.push(`${c.id}: indiviso ${u.coefficient} ≠ ${c.coefficient}`);
    if (u.tower !== c.tower) f.push(`${c.id}: sección «${u.tower}» ≠ «${c.tower}»`);
  }
  comprobar(`las ${padron.casas.length} casas del guion están, con su indiviso y su slug`, f);
}

// P2 · Indivisos de TODAS las unidades activas del conjunto: la corrida los usa todos.
{
  const activas = [...unidades.values()].filter((u) => u.status !== "inactive");
  const suma = activas.reduce((s, u) => s + Math.round((u.coefficient ?? 0) * 1_000_000), 0);
  comprobar(`los indivisos de las ${activas.length} unidades activas suman 100 %`, suma === 100_000_000 ? [] : [`suman ${suma / 1_000_000} %`]);
}

// P3 · Dueños y ocupantes: existen y viven en su casa.
{
  const f = [];
  for (const [id, u] of unidades) {
    if (!u.ownerIds?.length) f.push(`${id}: sin dueño (la corrida por indiviso lo exige)`);
    for (const pid of [...(u.ownerIds ?? []), ...(u.residentIds ?? [])]) {
      const p = personas.get(pid);
      if (!p) f.push(`${id}: apunta a ${pid}, que no existe`);
      else if (p.unitId !== id) f.push(`${id}: ${pid} vive en ${p.unitId}`);
    }
  }
  comprobar("cada casa tiene dueño, y sus personas existen y viven ahí", f);
}

// P4 · Personas: en una casa del conjunto, sin teléfono, con correo inerte o de cuenta con acceso.
{
  const alias = new Set(padron.cuentas.filter((c) => c.acceso).map((c) => c.email));
  const f = [];
  for (const [id, p] of personas) {
    if (!unidades.has(p.unitId)) f.push(`${id}: su unitId ${p.unitId} no es una unidad del conjunto`);
    if ("phone" in p) f.push(`${id}: lleva teléfono`);
    if (!p.email?.endsWith(`@${DOMINIO_INERTE}`) && !alias.has(p.email)) f.push(`${id}: correo no inerte «${p.email}»`);
    if (p.roleType !== p.occupancyType) f.push(`${id}: roleType ≠ occupancyType`);
  }
  comprobar(`las ${personas.size} personas viven en una casa del conjunto y ninguna tiene un correo o teléfono real`, f);
}

// P5 · Cuentas: su perfil, su casa y el enlace desde la persona.
{
  const f = [];
  for (const c of padron.cuentas) {
    const u = await auth.getUserByEmail(c.email).catch(() => null);
    if (!u) { f.push(`falta la cuenta ${c.email}`); continue; }
    const perfil = (await db.collection("users").doc(u.uid).get()).data();
    if (!perfil) { f.push(`${c.email}: sin users/${u.uid}`); continue; }
    if (perfil.tenantId !== tenantId || perfil.role !== c.role) f.push(`${c.email}: perfil ${perfil.role}@${perfil.tenantId}`);
    if (u.customClaims?.role !== c.role || u.customClaims?.tenantId !== tenantId) f.push(`${c.email}: claims ${JSON.stringify(u.customClaims)}`);
    if (c.casaId && perfil.unitId !== c.casaId) f.push(`${c.email}: unitId ${perfil.unitId} ≠ ${c.casaId}`);
    if (c.personaId && personas.get(c.personaId)?.authUid !== u.uid) f.push(`${c.email}: la persona no apunta a su cuenta`);
    if (u.passwordHash) f.push(`${c.email}: tiene contraseña`);
  }
  comprobar(`las ${padron.cuentas.length} cuentas tienen perfil, claims, casa y persona enlazada, y ninguna contraseña`, f);
}

// P6 · Áreas: la política con sus tipos exactos, o ninguna edición pasará las reglas.
{
  const f = [];
  for (const [id, a] of areas) {
    if (!(a.blockOnDebt === null || typeof a.blockOnDebt === "boolean")) f.push(`${id}: blockOnDebt`);
    if (typeof a.autoApprove !== "boolean") f.push(`${id}: autoApprove`);
    if (!(Number.isInteger(a.minAdvanceMinutes) && a.minAdvanceMinutes >= 0 && a.minAdvanceMinutes <= 10080)) f.push(`${id}: minAdvanceMinutes`);
    if (!a.createdAt) f.push(`${id}: sin createdAt (la lista ordena por él)`);
    if (a.isReservable === false) f.push(`${id}: isReservable false`);
  }
  comprobar(`las ${areas.size} áreas comunes tienen su política bien tipada`, f);
}

// P7 · Bancos: en MXN, con CLABE imposible y saldo de apertura aparte.
{
  const f = [];
  for (const [id, b] of bancos) {
    if (b.currency !== "MXN") f.push(`${id}: moneda ${b.currency}`);
    if ("openingBalance" in b) f.push(`${id}: openingBalance en el documento de la cuenta`);
    const n = String(b.accountNumber ?? "");
    if (!/^\d{18}$/.test(n) || Number(n[17]) === digitoDeControlClabe(n.slice(0, 17))) f.push(`${id}: CLABE «${n}» podría ser real`);
    if (typeof saldos.get(id)?.openingBalance !== "number") f.push(`${id}: sin bankAccountBalances`);
  }
  comprobar(`las ${bancos.size} cuentas bancarias van en MXN, con CLABE imposible y saldo aparte`, f);
}

// P8 · Ids: lo del conjunto lleva su prefijo.
{
  const f = [];
  for (const [nombre, mapa] of Object.entries({ units: unidades, people: personas, amenities: areas, bankAccounts: bancos })) {
    for (const id of mapa.keys()) if (!id.startsWith(`${tenantId}--`)) f.push(`${nombre}/${id}`);
  }
  comprobar("todo id del padrón lleva el conjunto delante", f);
}

// ── El dinero (plan §7): se recalcula con las funciones del producto ───────────────────────────

const cargos = await delConjunto("billingStatements");
const asientos = await delConjunto("ledgerEntries");
const operaciones = await delConjunto("paymentOperations");
const recibos = await delConjunto("paymentVouchers");
const adelantos = await delConjunto("advances");
const aplicaciones = await delConjunto("advanceApplications");
const cerca = (a, b) => Math.abs((a ?? 0) - (b ?? 0)) <= TOLERANCIA_MONEDA;

// M1 · Cada cargo: saldo y estado, los que da `calcularSaldo` hoy.
{
  const f = [];
  for (const [id, c] of cargos) {
    if (c.status === "cancelled") continue;
    const { balance, status } = calcularSaldo(c.amount ?? 0, c.paymentAmount ?? 0, c.advanceAppliedAmount ?? 0, c.dueDate ?? undefined, hoyUTC);
    if (!cerca(balance, c.balance) || status !== c.status) f.push(`${id}: guardado ${c.balance}/${c.status}, calculado ${balance}/${status}`);
  }
  comprobar(`los ${cargos.size} cargos tienen el saldo y el estado de calcularSaldo (hoy UTC ${hoyUTC})`, f);
}

// M2 · Lo pagado de cada cargo es exactamente lo que dicen sus asientos vivos.
{
  const porCargo = new Map();
  for (const e of asientos.values()) {
    if (e.sourceType !== "billingStatement" || e.reversedByEntryId) continue;
    porCargo.set(e.sourceId, (porCargo.get(e.sourceId) ?? 0) + (e.amount ?? 0));
  }
  const f = [];
  for (const [id, c] of cargos) if (!cerca(c.paymentAmount ?? 0, porCargo.get(id) ?? 0)) f.push(`${id}: paymentAmount ${c.paymentAmount}, asientos ${porCargo.get(id) ?? 0}`);
  for (const sid of porCargo.keys()) if (!cargos.has(sid)) f.push(`asientos de un cargo que no existe: ${sid}`);
  comprobar("lo pagado de cada cargo cuadra con sus asientos, y ningún asiento de cobro está huérfano", f);
}

// M3 · Cada pago: repartos + anticipo = importe; el manual lleva su recibo con la fecha del asiento.
{
  const f = [];
  let n = 0;
  for (const [id, op] of operaciones) {
    if (!Array.isArray(op.allocations) || op.reversalOf || op.status === "reversed") continue;
    n += 1;
    const repartido = op.allocations.reduce((s, a) => s + (a.amount ?? 0), 0) + (op.advanceAmount ?? 0);
    if (!cerca(repartido, op.amount)) f.push(`${id}: repartos + anticipo ${repartido} ≠ ${op.amount}`);
    if (op.source === "manual") {
      const recibo = [...recibos.values()].find((r) => r.operationKey === id);
      const fecha = [...asientos.values()].find((e) => e.operationKey === id)?.date;
      if (!recibo) f.push(`${id}: pago manual sin recibo`);
      else if (recibo.issueDate !== fecha) f.push(`${id}: recibo del ${recibo.issueDate}, asiento del ${fecha}`);
    }
  }
  comprobar(`los ${n} pagos reparten su importe entero, y los manuales llevan su recibo`, f);
}

// M4 · Anticipos: lo que queda es lo que no se cruzó, y lo cruzado cuadra en cada cargo.
{
  const f = [];
  const porAnticipo = new Map();
  const porCargo = new Map();
  for (const a of aplicaciones.values()) {
    if (a.status === "undone" || a.deshecha) continue;
    porAnticipo.set(a.advanceId, (porAnticipo.get(a.advanceId) ?? 0) + (a.amount ?? 0));
    porCargo.set(a.statementId, (porCargo.get(a.statementId) ?? 0) + (a.amount ?? 0));
  }
  for (const [id, a] of adelantos) {
    if (a.status === "cancelled" || a.status === "reversed") continue;
    if (!cerca(a.remaining, (a.amount ?? 0) - (porAnticipo.get(id) ?? 0))) f.push(`${id}: queda ${a.remaining}, debería ${(a.amount ?? 0) - (porAnticipo.get(id) ?? 0)}`);
  }
  for (const [id, c] of cargos) if (!cerca(c.advanceAppliedAmount ?? 0, porCargo.get(id) ?? 0)) f.push(`${id}: anticipo aplicado ${c.advanceAppliedAmount ?? 0}, cruces ${porCargo.get(id) ?? 0}`);
  comprobar(`los ${adelantos.size} anticipos y sus ${aplicaciones.size} cruces cuadran`, f);
}

// M5 · Ningún ingreso de cuota escrito a mano: se contaría dos veces (o ninguna).
{
  const f = [...asientos.entries()]
    .filter(([, e]) => e.type === "ingreso" && e.sourceType === "manual" && e.category === "alicuota")
    .map(([id]) => id);
  comprobar("ningún asiento manual de cuota", f);
}

// ── Egresos y tesorería ────────────────────────────────────────────────────────────────────────

const egresos = await delConjunto("expenses");
const traspasos = await delConjunto("treasuryTransfers");
const cajas = await delConjunto("pettyCashFunds");
const CATEGORIAS = new Set(["nomina", "servicios_publicos", "mantenimiento", "proveedores", "administracion", "seguros", "impuestos", "vigilancia", "otros"]);

// E1 · Cada egreso pagado sin plan apunta a su asiento, y el asiento dice lo mismo que él.
{
  const f = [];
  for (const [id, e] of egresos) {
    if (e.installments?.length) continue;
    const vinculados = [...asientos.entries()].filter(([, a]) => a.sourceType === "expense" && a.sourceId === id && !a.reversedByEntryId);
    if (e.status !== "pagado") {
      if (e.ledgerEntryId || vinculados.length) f.push(`${id}: ${e.status} con asiento`);
      continue;
    }
    const a = asientos.get(e.ledgerEntryId);
    if (!a) { f.push(`${id}: pagado sin su asiento ${e.ledgerEntryId}`); continue; }
    if (vinculados.length !== 1) f.push(`${id}: ${vinculados.length} asientos`);
    if (!cerca(a.amount, e.amount) || a.date !== e.paidAt || a.bankAccountId !== e.bankAccountId || a.accountCode !== e.accountCode) {
      f.push(`${id}: asiento ${a.amount}/${a.date}/${a.bankAccountId}/${a.accountCode} ≠ egreso ${e.amount}/${e.paidAt}/${e.bankAccountId}/${e.accountCode}`);
    }
  }
  comprobar(`los ${egresos.size} egresos: cada pagado con su asiento idéntico, y ningún pendiente con asiento`, f);
}

// E2 · Egresos en cuotas: lo pagado es la suma de cuotas pagadas y de sus asientos.
{
  const f = [];
  let n = 0;
  for (const [id, e] of egresos) {
    if (!e.installments?.length) continue;
    n += 1;
    const pagadas = e.installments.filter((c) => c.status === "pagada");
    const enCuotas = pagadas.reduce((s, c) => s + c.amount, 0);
    const enLibro = [...asientos.values()].filter((a) => a.sourceType === "expense" && a.sourceId === id && !a.reversedByEntryId).reduce((s, a) => s + a.amount, 0);
    if (!cerca(e.paidAmount ?? 0, enCuotas) || !cerca(enCuotas, enLibro)) f.push(`${id}: paidAmount ${e.paidAmount}, cuotas ${enCuotas}, libro ${enLibro}`);
    for (const c of pagadas) if (!asientos.has(c.ledgerEntryId)) f.push(`${id}: la cuota ${c.number} no tiene asiento`);
  }
  comprobar(`los ${n} egresos en cuotas cuadran con sus cuotas y su libro`, f);
}

// E3 · Categoría del tipo y la cuenta contable que le toca.
{
  const f = [];
  for (const [id, e] of egresos) {
    if (!CATEGORIAS.has(e.category)) f.push(`${id}: categoría «${e.category}» fuera del tipo`);
    else if (e.accountCode !== cuentaParaCategoriaDeEgreso(e.category).code) f.push(`${id}: cuenta ${e.accountCode} para ${e.category}`);
  }
  comprobar("cada egreso con una categoría del tipo y su cuenta contable", f);
}

// E4 · Los cargos de un prorrateo apuntan a un egreso que existe.
{
  const f = [...cargos.entries()].filter(([, c]) => c.sourceExpenseId && !egresos.has(c.sourceExpenseId)).map(([id, c]) => `${id} → ${c.sourceExpenseId}`);
  const n = [...cargos.values()].filter((c) => c.sourceExpenseId).length;
  comprobar(`los ${n} cargos de prorrateo apuntan a su egreso`, f);
}

// T1 · La caja chica: nunca en negativo ni por encima de su fondo.
{
  const f = [];
  for (const [id, caja] of cajas) {
    const entra = [...traspasos.values()].filter((x) => x.toAccountId === id && x.status === "registrado").reduce((s, x) => s + x.amount, 0);
    const sale = [...traspasos.values()].filter((x) => x.fromAccountId === id && x.status === "registrado").reduce((s, x) => s + x.amount, 0);
    const gasto = [...asientos.values()].filter((a) => a.bankAccountId === id && a.type === "egreso" && !a.reversedByEntryId).reduce((s, a) => s + a.amount, 0);
    const saldo = entra - sale - gasto;
    if (saldo < -TOLERANCIA_MONEDA || saldo > caja.limit + TOLERANCIA_MONEDA) f.push(`${id}: saldo ${saldo} con fondo ${caja.limit}`);
  }
  comprobar(`las ${cajas.size} cajas chicas tienen un saldo entre cero y su fondo`, f);
}

// ── Banco y conciliación ───────────────────────────────────────────────────────────────────────

const lineas = await delConjunto("bankStatementLines");
const casosDeConciliacion = await delConjunto("reconciliationCases");

// B1 · Cada línea tiene el id que le daría la importación (clave natural).
{
  const f = [];
  for (const [id, l] of lineas) {
    const esperado = idDeLinea({ tenantId, bankAccountId: l.bankAccountId, date: l.date, amount: l.amount, description: l.description });
    if (id !== esperado) f.push(`${id}: la importación le daría ${esperado}`);
  }
  comprobar(`las ${lineas.size} líneas del banco tienen el id de su clave natural`, f);
}

// B2 · Conciliar casa en los dos sentidos: línea ↔ asiento (o tramo de traspaso) ↔ caso aplicado.
{
  const f = [];
  let n = 0;
  for (const [id, l] of lineas) {
    const caso = casosDeConciliacion.get(id);
    if (!caso) f.push(`${id}: línea sin caso`);
    if (!l.reconciled) continue;
    n += 1;
    if (caso?.status !== "aplicado") f.push(`${id}: conciliada con caso «${caso?.status}»`);
    if (l.matchedLedgerEntryId) {
      const a = asientos.get(l.matchedLedgerEntryId);
      if (!a?.reconciled || a.bankStatementLineId !== id) f.push(`${id}: su asiento ${l.matchedLedgerEntryId} no apunta a ella`);
    } else if (l.matchedTransferId) {
      const x = traspasos.get(l.matchedTransferId);
      if (x?.salidaLineId !== id && x?.entradaLineId !== id) f.push(`${id}: su traspaso ${l.matchedTransferId} no apunta a ella`);
    } else f.push(`${id}: conciliada sin pareja`);
  }
  for (const [id, a] of asientos) {
    if (a.reconciled && lineas.get(a.bankStatementLineId)?.matchedLedgerEntryId !== id) f.push(`${id}: asiento conciliado sin su línea`);
  }
  const pendientes = lineas.size - n;
  comprobar(`de ${lineas.size} líneas, ${n} conciliadas en los dos sentidos y ${pendientes} pendientes, todas con su caso`, f);
}

// ── Medidor, informes, presupuesto y constancias ───────────────────────────────────────────────

const lecturas = await delConjunto("meterReadings");
const servicios = await delConjunto("meteredServices");
const informes = await delConjunto("monthlyReports");
const documentos = await delConjunto("documents");
const presupuestos = await delConjunto("budgets");
const certificados = await delConjunto("clearanceCertificates");
const plan = new Set([...(await delConjunto("chartOfAccounts")).values()].map((c) => c.code));

// L1 · Lecturas encadenadas: la primera es la base; cada anterior es la actual del periodo previo.
{
  const f = [];
  const porCasa = new Map();
  for (const l of lecturas.values()) {
    if (!porCasa.has(l.unitId)) porCasa.set(l.unitId, []);
    porCasa.get(l.unitId).push(l);
  }
  for (const [casa, lista] of porCasa) {
    lista.sort((a, b) => a.period.localeCompare(b.period));
    lista.forEach((l, i) => {
      if (!l.photoUrl) f.push(`${casa} ${l.period}: sin foto`);
      if (i === 0) {
        if (!l.esLineaBase || l.consumption !== 0 || l.previous !== l.current) f.push(`${casa} ${l.period}: la primera no es base`);
      } else {
        if (l.previous !== lista[i - 1].current) f.push(`${casa} ${l.period}: anterior ${l.previous} ≠ ${lista[i - 1].current}`);
        if (l.consumption !== l.current - l.previous) f.push(`${casa} ${l.period}: consumo ${l.consumption} ≠ ${l.current - l.previous}`);
      }
    });
  }
  comprobar(`las ${lecturas.size} lecturas de ${porCasa.size} casas están encadenadas y con foto`, f);
}

// L2 · Cada cargo de consumo es su lectura por la tarifa, y la lectura quedó cobrada.
{
  const f = [];
  const tarifa = new Map([...servicios.entries()].map(([id, s]) => [id, s.rate]));
  let n = 0;
  for (const [id, c] of cargos) {
    if (c.concept !== "consumo_medido") continue;
    n += 1;
    const l = [...lecturas.values()].find((x) => x.unitId === c.unitId && x.period === c.period);
    if (!l) { f.push(`${id}: sin lectura`); continue; }
    if (c.amount !== Math.round(l.consumption * (tarifa.get(l.serviceId) ?? 0))) f.push(`${id}: ${c.amount} ≠ ${l.consumption} × tarifa`);
    if (l.status !== "cobrado") f.push(`${id}: su lectura está «${l.status}»`);
  }
  comprobar(`los ${n} cargos de consumo salen de su lectura por la tarifa`, f);
}

// I1 · Informes emitidos: su PDF en Documentos, en su carpeta, y cada firma con nombre y fecha.
{
  const f = [];
  for (const [id, i] of informes) {
    if (i.status === "borrador") continue;
    const d = documentos.get(i.documentId);
    if (!d) { f.push(`${id}: sin su documento ${i.documentId}`); continue; }
    if (d.category !== "informe_mensual" || !d.fileUrl || !d.storagePath || !d.folderId) f.push(`${id}: documento incompleto`);
    for (const s of i.signatures ?? []) if (!s.uid || !s.name || !s.role || !s.signedAt) f.push(`${id}: firma incompleta de ${s.uid}`);
    if (!i.issuedAt) f.push(`${id}: emitido sin fecha`);
  }
  const emitidos = [...informes.values()].filter((i) => i.status !== "borrador").length;
  comprobar(`los ${emitidos} informes emitidos tienen su PDF en Documentos y sus firmas completas`, f);
}

// P2 · Presupuesto: cada línea es una cuenta del plan del conjunto; aprobado con la fecha del acta.
{
  const f = [];
  for (const [id, p] of presupuestos) {
    for (const l of p.lines ?? []) if (!plan.has(l.accountCode)) f.push(`${id}: la cuenta ${l.accountCode} no está en el plan`);
    if (p.status === "aprobado" && !/^\d{4}-\d{2}-\d{2}$/.test(String(p.approvedAt))) f.push(`${id}: aprobado sin fecha de acta`);
  }
  comprobar(`los ${presupuestos.size} presupuestos usan cuentas del plan`, f);
}

// C1 · Constancias: emitidas con saldo cero.
{
  const f = [...certificados.entries()].filter(([, c]) => (c.balanceAtIssue ?? 0) !== 0).map(([id, c]) => `${id}: saldo ${c.balanceAtIssue}`);
  comprobar(`las ${certificados.size} constancias se emitieron con saldo cero`, f);
}

// ── Operación ──────────────────────────────────────────────────────────────────────────────────

const reservasHechas = await delConjunto("reservations");
const pases = await delConjunto("visitorPasses");
const invitaciones = await delConjunto("visitorInvitations");
const autorizaciones = await delConjunto("visitorAuthorizations");
const paquetes = await delConjunto("packages");
const tickets = await delConjunto("tickets");
const comunicados = await delConjunto("communications");
const encuestas = await delConjunto("surveys");
const respuestas = await delConjunto("survey_responses");
const acuerdos = await delConjunto("committee_agreements");
const firmasDeAcuerdos = await delConjunto("committee_agreement_signatures");
const firmasDelReglamento = await delConjunto("regulation_signatures");
const carpetas = await delConjunto("documentFolders");
const usuarios = await delConjunto("users");
const milis = (v) => (typeof v?.toMillis === "function" ? v.toMillis() : typeof v === "string" ? Date.parse(v) : NaN);
/** El día local de Puebla (UTC−6 fijo, como la semilla). */
const diaLocal = (ms) => new Date(ms - 6 * 3_600_000).toISOString().slice(0, 10);
const hoyLocal = hoyForzado ?? diaLocal(Date.now());
function sumarHabiles(dia, n) {
  const d = new Date(`${dia}T12:00:00Z`);
  for (let k = 0; k < n; ) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) k += 1;
  }
  return d.toISOString().slice(0, 10);
}

// O1 · Reservas: los nueve campos que compara la cancelación del residente, y el aforo de cada área.
{
  const f = [];
  const NUEVE = ["tenantId", "unitId", "createdBy", "amenityId", "amenity", "date", "startTime", "endTime", "slot"];
  const minutos = (h) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));
  const turnos = new Map();
  for (const [id, r] of reservasHechas) {
    const faltan = NUEVE.filter((k) => !r[k]);
    if (faltan.length) f.push(`${id}: le falta ${faltan.join(", ")} (el residente no podría cancelarla)`);
    if (typeof r.startAt?.toMillis !== "function") f.push(`${id}: startAt no es una marca de tiempo`);
    if (!["approved", "pending", "cancelled"].includes(r.status)) f.push(`${id}: estado «${r.status}»`);
    if (r.autoApproved && r.status === "pending") f.push(`${id}: aprobada sola y pendiente a la vez`);
    if (r.kind === "mudanza") {
      if (!r.mudanza || "reservedBy" in r) f.push(`${id}: la mudanza no tiene la forma de construirMudanza`);
      continue;
    }
    if (r.status === "cancelled") continue;
    const k = `${r.amenityId}|${r.date}`;
    if (!turnos.has(k)) turnos.set(k, []);
    turnos.get(k).push(r);
  }
  for (const [k, lista] of turnos) {
    const aforo = areas.get(k.split("|")[0])?.maxReservationsPerSlot ?? 1;
    const marcas = lista.flatMap((r) => [[minutos(r.startTime), 1], [minutos(r.endTime), -1]]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    let dentro = 0;
    let maximo = 0;
    for (const [, paso] of marcas) maximo = Math.max(maximo, (dentro += paso));
    if (maximo > aforo) f.push(`${k}: ${maximo} reservas a la vez con aforo ${aforo}`);
  }
  comprobar(`las ${reservasHechas.size} reservas llevan los nueve campos de la cancelación y respetan el aforo`, f);
}

// O2 · Visitas: la portería puede operar cada pase (checkInAt/checkOutAt escritos) y cada invitación tiene el suyo.
{
  const f = [];
  const qrs = new Set();
  for (const [id, p] of pases) {
    qrs.add(p.qrCodeValue);
    if (!("checkInAt" in p) || !("checkOutAt" in p)) f.push(`${id}: sin checkInAt/checkOutAt escritos (la portería no podría darle ingreso)`);
    if (p.status === "scheduled" && (p.checkInAt != null || p.checkOutAt != null)) f.push(`${id}: programado con marcas de ingreso`);
    if (p.status === "completed" && !(milis(p.checkOutAt) >= milis(p.checkInAt))) f.push(`${id}: salida antes que la entrada`);
    if (p.sourceAuthorizationId && !autorizaciones.has(p.sourceAuthorizationId)) f.push(`${id}: su autorización no existe`);
  }
  for (const [id, inv] of invitaciones) if (!qrs.has(inv.qrToken)) f.push(`${id}: invitación sin su pase`);
  comprobar(`los ${pases.size} pases de visita (${invitaciones.size} invitaciones, ${autorizaciones.size} autorizaciones) se pueden operar en la portería`, f);
}

// O3 · Firmas de acuerdos y del reglamento: id {padre}_{casa}, de una cuenta de esa casa, después de enviarse.
{
  const f = [];
  const revisar = (id, s, padreId, padre, desde) => {
    if (id !== `${padreId}_${s.unitId}`) f.push(`${id}: el id no es {padre}_{casa}`);
    if (!padre) f.push(`${id}: firma de algo que no existe`);
    const u = usuarios.get(s.signedBy);
    if (!u || u.role !== "resident" || u.unitId !== s.unitId) f.push(`${id}: la firma no es de una cuenta de esa casa`);
    if (milis(s.signedAt) < desde) f.push(`${id}: firmada antes de enviarse`);
  };
  for (const [id, s] of firmasDeAcuerdos) {
    const a = acuerdos.get(s.agreementId);
    revisar(id, s, s.agreementId, a, a ? milis(a.sentAt) : 0);
    if (a?.signatureMode === "informativo") f.push(`${id}: firma en un acuerdo informativo`);
  }
  for (const [id, s] of firmasDelReglamento) {
    const r = documentos.get(s.regulationId);
    revisar(id, s, s.regulationId, r?.category === "reglamento" ? r : null, r ? milis(r.uploadedAt) : 0);
  }
  const vigente = (await db.collection("tenantSettings").doc(tenantId).get()).data()?.activeRegulationId;
  if (documentos.get(vigente)?.category !== "reglamento") f.push(`el reglamento vigente (${vigente}) no es un documento de reglamento`);
  comprobar(`las ${firmasDeAcuerdos.size} firmas de acuerdos y las ${firmasDelReglamento.size} del reglamento son de una cuenta de su casa`, f);
}

// O4 · Encuestas: el contador es el número de respuestas; cada respuesta, una por casa y sin uid.
{
  const f = [];
  for (const [id, e] of encuestas) {
    const suyas = [...respuestas.entries()].filter(([, r]) => r.surveyId === id);
    if (suyas.length !== e.responseCount) f.push(`${id}: responseCount ${e.responseCount} y ${suyas.length} respuestas`);
    for (const [rid, r] of suyas) {
      if (rid !== `${id}_${r.unitId}`) f.push(`${rid}: el id no es {encuesta}_{casa}`);
      if ("uid" in r || "userId" in r) f.push(`${rid}: la respuesta lleva quién respondió`);
      if (milis(r.respondedAt) < milis(e.publishedAt)) f.push(`${rid}: respondida antes de publicarse`);
      if (e.status === "closed" && milis(r.respondedAt) > milis(e.closingDate)) f.push(`${rid}: respondida después del cierre`);
    }
  }
  comprobar(`las ${encuestas.size} encuestas cuentan bien sus ${respuestas.size} respuestas`, f);
}

// O5 · PQRS: de una cuenta de la casa, con su día y su respuesta; y hay uno vencido y uno por vencer.
{
  const f = [];
  for (const [id, k] of tickets) {
    if (usuarios.get(k.residentId)?.unitId !== k.unitId) f.push(`${id}: residentId no es el uid de una cuenta de la casa`);
    if (k.eventDate !== String(k.radicationDate).slice(0, 10)) f.push(`${id}: eventDate ${k.eventDate} y radicado el ${k.radicationDate}`);
    if (k.response) {
      if (!Array.isArray(k.responseHistory) || !k.responseHistory.length) f.push(`${id}: respondido sin historial`);
      if (milis(k.respondedAt) < milis(k.radicationDate)) f.push(`${id}: respondido antes de radicarse`);
      if (k.status === "open") f.push(`${id}: respondido y abierto`);
    } else if (k.status !== "open") f.push(`${id}: «${k.status}» sin respuesta`);
  }
  // `getTicketSla`: 15 días hábiles desde la radicación; amarillo con 5 o menos, rojo al pasarse.
  const sla = [...tickets.values()].filter((k) => k.status === "open").map((k) => {
    const limite = sumarHabiles(diaLocal(milis(k.radicationDate)), 15);
    return limite < hoyLocal ? "vencido" : (Date.parse(limite) - Date.parse(hoyLocal)) / 86_400_000 <= 5 ? "por vencer" : "a tiempo";
  });
  for (const e of ["vencido", "por vencer"]) if (!sla.includes(e)) f.push(`ningún PQRS abierto está ${e}`);
  comprobar(`los ${tickets.size} PQRS son de una cuenta de su casa y hay abiertos vencidos y por vencer`, f);
}

// O6 · Paquetes: de una persona de la casa; entregados a alguien de la casa, después de llegar.
{
  const f = [];
  for (const [id, p] of paquetes) {
    if (personas.get(p.residentId)?.unitId !== p.unitId) f.push(`${id}: el destinatario no es de la casa`);
    if (p.status === "delivered") {
      if (personas.get(p.deliveredToId)?.unitId !== p.unitId || p.receivedBy !== p.deliveredToId) f.push(`${id}: lo recibió alguien que no es de la casa`);
      if (!(milis(p.deliveredAt) >= milis(p.arrivedAt))) f.push(`${id}: entregado antes de llegar`);
    } else if (p.deliveredToId) f.push(`${id}: pendiente y con quien lo recibió`);
  }
  comprobar(`los ${paquetes.size} paquetes son de personas de su casa y se entregan después de llegar`, f);
}

// O7 · Documentos en carpetas que existen, cada acuerdo con su acta, y comunicados con el estado de sus fechas.
{
  const f = [];
  for (const [id, d] of documentos) {
    if (d.folderId && !carpetas.has(d.folderId)) f.push(`${id}: su carpeta ${d.folderId} no existe`);
    if (!d.fileUrl || !d.storagePath) f.push(`${id}: sin archivo`);
    if (d.category === "acuerdo" && !acuerdos.has(d.sourceId)) f.push(`${id}: acta de un acuerdo que no existe`);
  }
  const actas = new Set([...documentos.values()].filter((d) => d.category === "acuerdo").map((d) => d.sourceId));
  for (const [id, a] of acuerdos) if (!a.fileUrl || !actas.has(id)) f.push(`${id}: acuerdo sin su acta en Documentos`);
  const PARA_EL_RESIDENTE = new Set(["asamblea", "comunicado", "acuerdo", "reglamento", "plano", "memoria", "otro"]);
  if (![...documentos.values()].some((d) => PARA_EL_RESIDENTE.has(d.category))) f.push("el residente no vería ningún documento");
  for (const [id, c] of comunicados) {
    const dia = diaLocal(milis(c.createdAt));
    const esperado = c.startsAt && c.startsAt > dia ? "scheduled" : c.endsAt && c.endsAt < dia ? "expired" : "published";
    if (c.status !== esperado) f.push(`${id}: «${c.status}» y por sus fechas era «${esperado}»`);
    if ((c.notificationSummary ?? "").length > 280 || (c.title ?? "").length < 4 || (c.message ?? "").length < 8) f.push(`${id}: textos fuera de los límites del formulario`);
  }
  comprobar(`los ${documentos.size} documentos están en carpetas que existen y los ${comunicados.size} comunicados tienen el estado de sus fechas`, f);
}

// ── Cuentas, guía, avisos y manifiesto (T1.9) ──────────────────────────────────────────────────

const membresias = await delConjunto("tenantUsers");
const avisos = await delConjunto("notifications");
const uidPorCorreo = new Map([...usuarios.values()].map((u) => [u.email, u.uid]));

// V1 · Cada cuenta, con su membresía: los campos de su perfil, su casa por id y el consejo donde toca.
{
  const f = [];
  for (const c of padron.cuentas) {
    const uid = uidPorCorreo.get(c.email);
    const m = uid ? membresias.get(`${tenantId}_${uid}`) : null;
    if (!m) {
      f.push(`${c.clave}: sin membresía`);
      continue;
    }
    if (m.uid !== uid || m.role !== c.role || m.status !== "active" || m.email !== c.email) f.push(`${c.clave}: uid, rol, estado o correo de la membresía no cuadran`);
    if (c.casaId && (m.unitId !== c.casaId || !m.unitLabel)) f.push(`${c.clave}: la membresía no apunta a su casa por id de documento`);
    if (Boolean(m.isCommittee) !== c.consejo) f.push(`${c.clave}: marca de consejo ${Boolean(m.isCommittee)} y el guion dice ${c.consejo}`);
    if (c.consejo && typeof m.committeeSince?.toMillis !== "function") f.push(`${c.clave}: consejero sin fecha de nombramiento`);
  }
  comprobar(`las ${padron.cuentas.length} cuentas tienen su membresía, con su casa y la marca de consejo donde toca`, f);
}

// V2 · La guía de onboarding da por recorridos los dos portales (cadenas ISO: un Timestamp se ignora).
{
  const seen = (await db.collection("tenantOnboarding").doc(tenantId).get()).data()?.seen ?? {};
  const f = ["portal-porteria", "portal-residente"]
    .filter((k) => typeof seen[k] !== "string" || Number.isNaN(Date.parse(seen[k])))
    .map((k) => `${k}: ${seen[k] === undefined ? "no está" : "no es una cadena ISO"}`);
  comprobar("la guía da por recorridos el portal de portería y el del residente", f);
}

// V3 · Avisos: los seis campos que compara «marcar como leído», nada en el futuro, y buzón en las cuentas con acceso.
{
  const f = [];
  const CAMPOS = ["userId", "tenantId", "type", "title", "description", "link"];
  const tope = hoyForzado ? Date.parse(`${hoyForzado}T23:59:59-06:00`) : Date.now();
  const porUid = new Map();
  for (const [id, n] of avisos) {
    const faltan = CAMPOS.filter((k) => !(k in n));
    if (faltan.length) f.push(`${id}: le falta ${faltan.join(", ")} (no se podría marcar como leído)`);
    if (typeof n.read !== "boolean" || typeof n.createdAt?.toMillis !== "function") f.push(`${id}: read o createdAt con otra forma`);
    else if (n.createdAt.toMillis() > tope) f.push(`${id}: fechado en el futuro`);
    porUid.set(n.userId, (porUid.get(n.userId) ?? 0) + 1);
  }
  for (const c of padron.cuentas.filter((x) => x.acceso)) {
    const n = porUid.get(uidPorCorreo.get(c.email)) ?? 0;
    if (n < 10) f.push(`${c.clave}: solo ${n} avisos en su buzón`);
  }
  comprobar(`los ${avisos.size} avisos llevan los campos que compara «marcar como leído», y las cuentas con acceso tienen buzón`, f);
}

// V4 · Todo lo del conjunto está en la línea base o en el manifiesto: `--limpiar` lo alcanza.
{
  const f = [];
  const m = (await db.collection("semillas").doc(tenantId).get()).data();
  if (!m?.lineaBase) f.push("el manifiesto no tiene línea base");
  else {
    for (const [c, ids] of await barrer(db, tenantId)) {
      const conocidos = new Set([...(m.lineaBase[c] ?? []), ...(m.docs?.[c] ?? [])]);
      const fuera = [...ids].filter((id) => !conocidos.has(id));
      if (fuera.length) f.push(`${c}: ${fuera.length} fuera del manifiesto y de la línea base (p. ej. ${fuera[0]})`);
    }
  }
  comprobar("todo lo del conjunto está en la línea base o en el manifiesto: --limpiar lo alcanza", f);
}

// Hoy (no es una comprobación: depende de la hora a la que se sembró).
{
  const dentro = [...pases.values()].filter((p) => p.status === "inside" && p.date === hoyLocal).length;
  const porEntregar = [...paquetes.values()].filter((p) => p.status === "pending").length;
  const abiertos = [...tickets.values()].filter((k) => k.status === "open").length;
  console.log(`\n  hoy ${hoyLocal}: ${dentro} visitas dentro · ${porEntregar} paquetes por entregar · ${abiertos} PQRS abiertos`);
}

// Informe: recaudo por periodo (no es una comprobación: es para leerlo).
{
  const porPeriodo = new Map();
  for (const c of cargos.values()) {
    if (c.status === "cancelled") continue;
    const p = porPeriodo.get(c.period) ?? { emitido: 0, cobrado: 0 };
    p.emitido += c.amount ?? 0;
    p.cobrado += (c.paymentAmount ?? 0) + (c.advanceAppliedAmount ?? 0);
    porPeriodo.set(c.period, p);
  }
  const filas = [...porPeriodo.entries()].sort(([a], [b]) => a.localeCompare(b));
  console.log(`\n  recaudo por periodo: ${filas.map(([p, v]) => `${p} ${Math.round((v.cobrado / v.emitido) * 100)} % de $${Math.round(v.emitido).toLocaleString("es-MX")}`).join(" · ")}`);
}

const fallidas = resultados.filter((r) => r.fallos.length);
console.log(`\n${fallidas.length ? `✗ ${fallidas.length} de ${resultados.length} comprobaciones fallan` : `✓ ${resultados.length} de ${resultados.length} comprobaciones en verde`}\n`);
process.exit(fallidas.length ? 1 : 0);
