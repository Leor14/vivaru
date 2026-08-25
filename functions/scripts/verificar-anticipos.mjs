// Verifica `PRD-V-FLOW-002` (anticipos) **contra una base de verdad**, no contra
// el emulador.
//
// Por qué existe: las 73 pruebas de emulador corren contra datos que se inventa
// la propia prueba. Este script corre el mismo código contra los datos de un
// ambiente real —plan de cuentas sembrado, banderas resueltas por override,
// cuentas bancarias de verdad— que es donde aparecen las diferencias que ninguna
// suite ve. Es la lección del 23 de agosto de 2026 aplicada al servidor.
//
// **Lo que prueba y lo que no.** Ejecuta la MISMA lógica que corre desplegada
// (importa `functions/lib/`, que es lo que se subió) contra la base real. NO
// prueba el camino del callable —sesión, CORS, reglas de Firestore—: eso se mira
// por el navegador cuando haya pantalla.
//
// Es NO DESTRUCTIVO: crea sus propios documentos con prefijo `verif-flow002-`,
// los usa y los borra al terminar. No toca ni un documento existente.
//
// Uso:
//   node functions/scripts/verificar-anticipos.mjs <projectId> <tenantId>
//
// El proyecto va como argumento SIEMPRE: el activo de gcloud es `hogaru-1`, que
// es producción, y no puede ser el default de nada.

import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const [projectId, tenantId] = process.argv.slice(2);
if (!projectId || !tenantId) {
  console.error("Uso: node functions/scripts/verificar-anticipos.mjs <projectId> <tenantId>");
  process.exit(1);
}

initializeApp({ projectId });
const db = getFirestore();

const { aplicarPago, revertirPago, esRecaudoDeCartera } = require("../lib/payments.js");
const { cruzarAnticipo, deshacerCruce, anularAnticipo } = require("../lib/advances.js");

const P = "verif-flow002-";
const UID = "verificacion-automatica";
const ROL = "tenant_admin";
const HOY = new Date().toISOString().slice(0, 10);
const creados = { billingStatements: [], advances: [], advanceApplications: [], ledgerEntries: [], paymentOperations: [] };

let ok = 0;
let fallos = 0;
function comprobar(nombre, real, esperado) {
  const bien = JSON.stringify(real) === JSON.stringify(esperado);
  if (bien) ok += 1;
  else fallos += 1;
  console.log(`  ${bien ? "✔" : "✘"} ${nombre}${bien ? "" : `  → esperaba ${JSON.stringify(esperado)}, dio ${JSON.stringify(real)}`}`);
}

async function cargo(sufijo, amount) {
  const id = `${P}${sufijo}`;
  await db.collection("billingStatements").doc(id).set({
    tenantId,
    unitId: `${P}unidad`,
    unitLabel: "VERIF-101",
    period: "2099-01",
    concept: "administracion",
    amount,
    paymentAmount: 0,
    balance: amount,
    dueDate: "2099-01-31",
    status: "pending",
    createdBy: UID,
  });
  creados.billingStatements.push(id);
  return id;
}

/** El ingreso tal y como lo calcula el producto, acotado a lo que crea el script. */
async function ingresoDeLaVerificacion() {
  const cargos = await db.collection("billingStatements").where("tenantId", "==", tenantId).where("unitId", "==", `${P}unidad`).get();
  const cuotaIncome = cargos.docs.reduce((s, d) => s + (d.data().paymentAmount ?? 0), 0);
  // Se pide SIN filtrar por `operationKey` y se filtra en memoria, a proposito:
  // un `where` de rango sobre otro campo exige un INDICE COMPUESTO que solo
  // existe en la nube, y montar uno para un script de verificacion seria pagar
  // en produccion por una comodidad de aqui. Es el patron de `watchLedger`, el
  // unico que no se rompio el 23 de agosto.
  const libro = await db.collection("ledgerEntries").where("tenantId", "==", tenantId).get();
  const ledgerIncome = libro.docs
    .map((d) => d.data())
    // Por el CONCEPTO y no por `operationKey`: los asientos de reverso no llevan
    // clave de operación, así que filtrar por ella dejaba fuera precisamente los
    // negativos — y el ingreso parecía no bajar nunca. Falso negativo del
    // medidor, no del producto, pero indistinguible desde fuera.
    .filter((e) => typeof e.concept === "string" && e.concept.includes("VERIF-101"))
    .filter((e) => e.type === "ingreso" && !esRecaudoDeCartera(e))
    .reduce((s, e) => s + (e.amount ?? 0), 0);
  return { cuotaIncome, ledgerIncome, total: cuotaIncome + ledgerIncome };
}

function anota(res) {
  if (res?.advanceId) creados.advances.push(res.advanceId);
  if (res?.applicationId) creados.advanceApplications.push(res.applicationId);
  return res;
}

/**
 * **La membresía del actor de la verificación.**
 *
 * Desde `PLAT-002` §11.2 las seis callables del dinero resuelven por
 * `tenantUsers/{tenantId}_{uid}` y no por el claim del token. Este script opera
 * con un uid sintético que no existe en `tenantUsers` en ningún ambiente, así
 * que **sin esto se caía en el primer `aplicarPago`** con «No tienes permiso
 * para registrar cobros en este conjunto», antes de la primera comprobación y
 * sin que ninguno de los veinte asertos llegara a correr.
 *
 * Se siembra en vez de subir el rol a `superadmin`, que también pasaría: el
 * superadmin sale de la guarda ANTES de `assertTenantOperable`, así que este
 * script dejaría de ejercer el estado del conjunto — que es `CF8` y es lo que
 * más caro costó.
 */
async function sembrarActor() {
  await db.collection("tenantUsers").doc(`${tenantId}_${UID}`).set({
    uid: UID,
    tenantId,
    role: "tenant_admin",
    status: "active",
    fullName: "Verificación automática",
    seededBy: "verificar-anticipos",
  });
}

async function limpiar() {
  // Se borra por CONSULTA y no por la lista en memoria: si el script murió a
  // mitad, la lista está incompleta y los documentos se quedarían para siempre.
  const borrar = [];
  for (const col of ["billingStatements", "advances", "advanceApplications"]) {
    const s = await db.collection(col).where("tenantId", "==", tenantId).get();
    s.docs.filter((d) => d.id.startsWith(P) || d.data().unitId === `${P}unidad`).forEach((d) => borrar.push(d.ref));
  }
  for (const col of ["ledgerEntries", "paymentOperations"]) {
    const s = await db.collection(col).where("tenantId", "==", tenantId).get();
    s.docs.filter((d) => (d.data().operationKey ?? d.id ?? "").includes(P) || (d.data().concept ?? "").includes("VERIF-101")).forEach((d) => borrar.push(d.ref));
  }
  const vouchers = await db.collection("paymentVouchers").where("tenantId", "==", tenantId).get();
  vouchers.docs.filter((d) => (d.data().operationKey ?? "").includes(P)).forEach((d) => borrar.push(d.ref));
  // La membresía del actor también es basura de la verificación.
  const actor = db.collection("tenantUsers").doc(`${tenantId}_${UID}`);
  if ((await actor.get()).exists) borrar.push(actor);
  for (const ref of borrar) await ref.delete();
  return borrar.length;
}

async function run() {
  console.log(`\n${projectId} · ${tenantId} — verificación de FLOW-002 contra la base\n`);
  await limpiar();
  await sembrarActor();

  console.log("D-A · el sobrepago deja saldo a favor");
  const c1 = await cargo("da", 140000);
  const pago = anota(await aplicarPago(
    { tenantId, statementId: c1, amount: 200000, date: HOY, operationKey: `${P}op-da`, source: "manual" },
    UID, ROL,
  ));
  comprobar("al cargo van 140.000, no 200.000", pago.paymentAmount, 140000);
  comprobar("nace un anticipo de 60.000", pago.advanceAmount, 60000);
  comprobar("R1: aplicado + anticipo = pagado", pago.paymentAmount + pago.advanceAmount, 200000);
  const asiento = (await db.collection("ledgerEntries").doc((await db.collection("advances").doc(pago.advanceId).get()).data().ledgerEntryId).get()).data();
  comprobar("el asiento del anticipo NO hereda el origen", asiento.sourceType, "advance");
  comprobar("y la exclusión no lo atrapa", esRecaudoDeCartera(asiento), false);
  comprobar("lleva la cuenta 1.10 del plan sembrado", asiento.accountCode, "1.10");
  comprobar("CA6′: el ingreso total es lo que entró", (await ingresoDeLaVerificacion()).total, 200000);

  console.log("\nR10 · idempotencia");
  const rep = await aplicarPago(
    { tenantId, statementId: c1, amount: 200000, date: HOY, operationKey: `${P}op-da`, source: "manual" },
    UID, ROL,
  );
  comprobar("un reintento no aplica de nuevo", rep.applied, false);
  comprobar("y devuelve el MISMO anticipo", rep.advanceId, pago.advanceId);

  console.log("\nR4 · cruzar no mueve dinero");
  const c2 = await cargo("cruce", 90000);
  const antes = await ingresoDeLaVerificacion();
  const cruce = anota(await cruzarAnticipo(
    { tenantId, advanceId: pago.advanceId, statementId: c2, amount: 60000, date: HOY, operationKey: `${P}op-cruce` },
    UID, ROL,
  ));
  comprobar("aplica 60.000 al cargo", cruce.appliedAmount, 60000);
  comprobar("el cargo queda debiendo 30.000", cruce.balance, 30000);
  const cargoCruzado = (await db.collection("billingStatements").doc(c2).get()).data();
  comprobar("NO toca paymentAmount", cargoCruzado.paymentAmount, 0);
  comprobar("sube advanceAppliedAmount", cargoCruzado.advanceAppliedAmount, 60000);
  comprobar("CA6′: el ingreso total NO cambia al cruzar", (await ingresoDeLaVerificacion()).total, antes.total);

  console.log("\nCA12 · deshacer el cruce");
  const undo = await deshacerCruce({ tenantId, applicationId: cruce.applicationId, operationKey: `${P}op-undo` }, UID, ROL);
  comprobar("el anticipo vuelve a `open` con sus 60.000", [undo.remaining, undo.advanceStatus], [60000, "open"]);
  comprobar("el ingreso sigue sin moverse", (await ingresoDeLaVerificacion()).total, antes.total);

  console.log("\nR8 · revertir con el anticipo YA CRUZADO se bloquea");
  const cruce2 = anota(await cruzarAnticipo(
    { tenantId, advanceId: pago.advanceId, statementId: c2, amount: 60000, date: HOY, operationKey: `${P}op-cruce2` },
    UID, ROL,
  ));
  let bloqueado = false;
  try {
    await revertirPago({ tenantId, operationKey: `${P}op-da`, reversalKey: `${P}op-rev-x`, reason: "prueba" }, UID, ROL);
  } catch (e) { bloqueado = /deshacer esos cruces/i.test(e?.message ?? ""); }
  comprobar("bloquea y dice qué hacer", bloqueado, true);
  await deshacerCruce({ tenantId, applicationId: cruce2.applicationId, operationKey: `${P}op-undo2` }, UID, ROL);

  console.log("\nR15 · revertir el pago se lleva el anticipo");
  await revertirPago({ tenantId, operationKey: `${P}op-da`, reversalKey: `${P}op-rev`, reason: "Cobro duplicado" }, UID, ROL);
  const advTrasRev = (await db.collection("advances").doc(pago.advanceId).get()).data();
  comprobar("el anticipo queda anulado", advTrasRev.status, "cancelled");
  comprobar("el ingreso vuelve a cero", (await ingresoDeLaVerificacion()).total, 0);

  console.log("\nD-B · un pago cubre varios cargos");
  const m1 = await cargo("m1", 140000);
  const m2 = await cargo("m2", 90000);
  const multi = anota(await aplicarPago(
    { tenantId, amount: 300000, date: HOY, operationKey: `${P}op-multi`, source: "manual",
      allocations: [{ statementId: m1, amount: 140000 }, { statementId: m2, amount: 90000 }] },
    UID, ROL,
  ));
  comprobar("dos líneas aplicadas", multi.allocations.length, 2);
  comprobar("y 70.000 al anticipo", multi.advanceAmount, 70000);
  const asientosMulti = await db.collection("ledgerEntries").where("operationKey", "==", `${P}op-multi`).get();
  comprobar("un asiento por línea, más el del anticipo", asientosMulti.size, 3);

  console.log("\nR9 · anular con motivo");
  let sinMotivo = false;
  try {
    await anularAnticipo({ tenantId, advanceId: multi.advanceId, reason: "  ", operationKey: `${P}op-anul-x` }, UID, ROL);
  } catch { sinMotivo = true; }
  comprobar("sin motivo se rechaza", sinMotivo, true);
  const ingresoAntesDeAnular = (await ingresoDeLaVerificacion()).total;
  await anularAnticipo({ tenantId, advanceId: multi.advanceId, reason: "Verificación", operationKey: `${P}op-anul` }, UID, ROL);
  comprobar("anular NO baja el ingreso (§4: devolver es un egreso)", (await ingresoDeLaVerificacion()).total, ingresoAntesDeAnular);

  console.log("\nD-B · revertir el pago repartido");
  await revertirPago({ tenantId, operationKey: `${P}op-multi`, reversalKey: `${P}op-rev-multi`, reason: "Cobro duplicado" }, UID, ROL);
  const r1 = (await db.collection("billingStatements").doc(m1).get()).data();
  const r2 = (await db.collection("billingStatements").doc(m2).get()).data();
  comprobar("las DOS cuotas vuelven a deber", [r1.paymentAmount, r2.paymentAmount], [0, 0]);

  const borrados = await limpiar();
  console.log(`\nLimpieza: ${borrados} documentos de prueba borrados.`);
  console.log(`\n${ok} comprobaciones en verde, ${fallos} en rojo.\n`);
  process.exit(fallos > 0 ? 1 : 0);
}

run().catch(async (e) => {
  console.error("\nError:", e?.message || e);
  const n = await limpiar().catch(() => 0);
  console.error(`Limpieza de emergencia: ${n} documentos borrados.`);
  process.exit(1);
});
