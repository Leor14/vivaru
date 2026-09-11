// Siembra una DEMO visible de cinco capacidades en UN conjunto que ya existe,
// para poder enseñarlas: presupuesto contra ejecución (`FEAT-009`), la foto del
// medidor (`FEAT-008`), tesorería con traspaso y caja chica (`FEAT-010`), el
// registro de proveedores y un paz y salvo.
//
// USO
//   node functions/scripts/sembrar-demo-finanzas.mjs <proyecto> <conjunto>                     → simula
//   node functions/scripts/sembrar-demo-finanzas.mjs <proyecto> <conjunto> --escribir          → siembra
//   node functions/scripts/sembrar-demo-finanzas.mjs <proyecto> <conjunto> --limpiar [--escribir] → deshace
//
// REGLAS, y cada una tiene su porqué:
//   · El proyecto va SIEMPRE como argumento: el activo de gcloud es `hogaru-1`,
//     que es producción, y no puede ser el default de nada.
//   · Sin `--escribir` no escribe: dice qué haría.
//   · Idempotente. Los ids son fijos (prefijo `demo-`) y lo que ya existe NO se
//     pisa: un presupuesto del año que ya exista, sembrado o no, se deja.
//   · No toca Cartera ni el libro (decisión de David, 10 sep 2026): no cobra el
//     consumo, no paga gastos desde la caja, y la cuenta nueva nace con saldo
//     inicial 0 y se llena con un traspaso — un saldo inicial nuevo movería el
//     saldo de fondos; un traspaso, no.
//   · No reimplementa lo que vive en el servidor: registrar y cerrar lecturas y
//     emitir el paz y salvo llaman al código compilado de `functions/lib`, el
//     mismo que usan las callables.
//   · Las banderas NO se tocan aquí: se encienden aparte con
//     `mover-bandera-de-conjunto.mjs`, porque encender es una decisión.

import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";

import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import sharp from "sharp";

const BUCKETS = {
  "hogaru-1": "hogaru-1.firebasestorage.app",
  "vivaru-staging-02": "vivaru-staging-02.firebasestorage.app",
};
const [proyecto, tenantId, ...opciones] = process.argv.slice(2);
const ESCRIBIR = opciones.includes("--escribir");
const LIMPIAR = opciones.includes("--limpiar");
if (!BUCKETS[proyecto] || !tenantId) {
  console.error("Uso: node functions/scripts/sembrar-demo-finanzas.mjs <hogaru-1|vivaru-staging-02> <conjunto> [--escribir] [--limpiar]");
  console.error("Sin --escribir, simula: dice qué haría y no escribe nada.");
  process.exit(1);
}
for (const f of ["medicion-de-consumos.js", "clearance-certificates.js"]) {
  if (!existsSync(new URL(`../lib/${f}`, import.meta.url))) {
    console.error(`Falta functions/lib/${f}: compila antes con «npm --prefix functions run build».`);
    process.exit(1);
  }
}

initializeApp({ projectId: proyecto, storageBucket: BUCKETS[proyecto] });
const db = getFirestore();
const bucket = getStorage().bucket();
const { registrarLectura, cerrarPeriodo, periodoAnterior } = await import(new URL("../lib/medicion-de-consumos.js", import.meta.url).href);
const { emitirPazYSalvo } = await import(new URL("../lib/clearance-certificates.js", import.meta.url).href);

const ACTOR = "demo-vivaru";
const SERVICIO = "demo-agua-potable";
const firmas = () => ({ createdBy: ACTOR, updatedBy: ACTOR, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });

// El día LOCAL: `toISOString` da el de Greenwich, y a las siete de la tarde en
// México ya es mañana.
const fecha = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const hoy = new Date();
const hace = (dias) => fecha(new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - dias));
const periodoActual = fecha(hoy).slice(0, 7);

const IMPORTES = {
  MXN: { traspaso: 15000, caja: 3000, tarifa: 28 },
  COP: { traspaso: 3000000, caja: 500000, tarifa: 4500 },
  USD: { traspaso: 1000, caja: 200, tarifa: 1.5 },
};

const anota = (bloque, texto) => console.log(`${bloque.padEnd(12)} ${texto}`);
const verbo = (hace, haria) => (ESCRIBIR ? hace : haria);
const deConjunto = (col) => db.collection(col).where("tenantId", "==", tenantId).get();
const xml = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const tenantSnap = await db.collection("tenants").doc(tenantId).get();
if (!tenantSnap.exists) {
  console.error(`El conjunto ${tenantId} no existe en ${proyecto}.`);
  process.exit(1);
}
const tenant = tenantSnap.data();
const moneda = IMPORTES[tenant.currency] ? tenant.currency : "MXN";
const importes = IMPORTES[moneda];
// `PRD-V-FEAT-010` RN-12: «caja menor» en Colombia; «caja chica» en el resto.
const nombreCaja = String(tenant.country ?? "").toUpperCase() === "CO" ? "Caja menor de portería" : "Caja chica de portería";
console.log(`${ESCRIBIR ? "SEMBRANDO" : "SIMULACIÓN"}${LIMPIAR ? " · LIMPIEZA" : ""} · ${proyecto} · ${tenantId} (${tenant.name}, ${tenant.country ?? "sin país"}, ${moneda})\n`);

async function crearSiFalta(bloque, col, id, datos, que) {
  const ref = db.collection(col).doc(id);
  if ((await ref.get()).exists) return anota(bloque, `ya existe ${que} (${col}/${id})`);
  anota(bloque, `${verbo("creo", "crearía")} ${que}`);
  if (ESCRIBIR) await ref.create(datos);
}

async function unidades() {
  const [u, cargos] = await Promise.all([deConjunto("units"), deConjunto("billingStatements")]);
  const deuda = new Map();
  for (const d of cargos.docs) {
    const c = d.data();
    deuda.set(c.unitId, (deuda.get(c.unitId) ?? 0) + Number(c.balance ?? 0));
  }
  return u.docs
    .map((d) => ({ id: d.id, label: String(d.data().displayName ?? d.data().label ?? d.data().unitId ?? d.id), deuda: deuda.get(d.id) ?? 0 }))
    .sort((a, b) => a.label.localeCompare(b.label, "es", { numeric: true }));
}

// ── Presupuesto del año, aprobado ───────────────────────────────────────────

async function presupuesto() {
  const year = hoy.getFullYear();
  const ref = db.collection("budgets").doc(`${tenantId}_${year}`);
  const previo = await ref.get();
  if (previo.exists) {
    const p = previo.data();
    return anota("presupuesto", `omito: ya hay presupuesto ${year} (${p.status}, ${p.createdBy === ACTOR ? "sembrado" : "NO sembrado"}) y no se pisa`);
  }
  const [plan, libro] = await Promise.all([deConjunto("chartOfAccounts"), deConjunto("ledgerEntries")]);
  // La categoría del asiento se traduce a cuenta con la `systemKey` del propio
  // plan: el mismo enlace que usa el producto, no uno escrito aquí.
  const codigoPorClave = new Map(plan.docs.map((d) => d.data()).filter((c) => c.systemKey).map((c) => [c.systemKey, c.code]));
  const hojas = new Set(plan.docs.map((d) => String(d.data().code)).filter((c) => c.includes(".") && c !== "1.10"));
  const ejecutado = new Map();
  for (const d of libro.docs) {
    const e = d.data();
    if (!String(e.date ?? "").startsWith(String(year))) continue;
    const codigo = e.accountCode ?? codigoPorClave.get(e.category);
    if (!codigo || !hojas.has(codigo)) continue;
    ejecutado.set(codigo, (ejecutado.get(codigo) ?? 0) + Number(e.amount ?? 0));
  }
  if (ejecutado.size === 0) return anota("presupuesto", `omito: no hay asientos de ${year} con cuenta; no habría con qué compararlo`);

  // Cada cuenta con su desvío, para que la demo enseñe las dos caras: lo que se
  // pasó (servicios públicos) y lo que va holgado (mantenimiento).
  const FACTOR = { "1.1": 1.0, "1.2": 1.3, "2.1": 1.02, "2.2": 0.85, "2.3": 1.25, "2.4": 1.1, "2.6": 1.0 };
  const meses = hoy.getMonth() + 1;
  const anual = (v) => (v / meses) * 12;
  const redondea = (v) => Math.max(100, Math.round(v / 100) * 100);
  const lines = [...ejecutado]
    .filter(([, v]) => v > 0)
    .map(([accountCode, v]) => ({ accountCode, amount: redondea(anual(v) * (FACTOR[accountCode] ?? 1.1)) }));
  // Dos partidas presupuestadas y aún sin ejecutar: la pantalla también las enseña.
  const egresoAnual = [...ejecutado].filter(([c]) => c.startsWith("2.")).reduce((s, [, v]) => s + anual(v), 0);
  for (const codigo of ["2.5", "2.9"]) {
    if (hojas.has(codigo) && !ejecutado.has(codigo)) lines.push({ accountCode: codigo, amount: redondea(egresoAnual * 0.04) });
  }
  lines.sort((a, b) => a.accountCode.localeCompare(b.accountCode, "es", { numeric: true }));
  anota("presupuesto", `${verbo("creo", "crearía")} ${year} APROBADO (acta del ${year}-03-15), ${lines.length} líneas: ${lines.map((l) => `${l.accountCode}=${l.amount}`).join(" ")}`);
  if (ESCRIBIR) {
    await ref.create({
      tenantId,
      year,
      lines,
      status: "aprobado",
      approvedAt: `${year}-03-15`,
      approvedBy: ACTOR,
      approvedRecordedAt: FieldValue.serverTimestamp(),
      ...firmas(),
    });
  }
}

// ── Medidor: dos períodos con foto, cerrados y SIN cobrar ───────────────────

async function subirFoto(unidad, periodo, lectura) {
  const limpio = `${unidad.id}-${periodo}`.toLowerCase().replace(/[^a-z0-9.\-_]+/g, "-");
  const ruta = `tenants/${tenantId}/meter-readings/${SERVICIO}/${limpio}.jpg`;
  const archivo = bucket.file(ruta);
  const [existe] = await archivo.exists();
  let token = existe ? (await archivo.getMetadata())[0]?.metadata?.firebaseStorageDownloadTokens : null;
  if (!existe) {
    token = randomUUID();
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600">
      <rect width="100%" height="100%" fill="#1f2a37"/>
      <circle cx="400" cy="270" r="200" fill="#e5e7eb" stroke="#9ca3af" stroke-width="16"/>
      <rect x="235" y="215" width="330" height="90" rx="10" fill="#111827"/>
      <text x="400" y="278" font-family="DejaVu Sans Mono, monospace" font-size="60" fill="#f9fafb" text-anchor="middle">${String(lectura).padStart(5, "0")}</text>
      <text x="400" y="370" font-family="DejaVu Sans, sans-serif" font-size="34" fill="#374151" text-anchor="middle">m3 · agua</text>
      <text x="400" y="560" font-family="DejaVu Sans, sans-serif" font-size="28" fill="#e5e7eb" text-anchor="middle">${xml(unidad.label)} · ${periodo} · foto de ejemplo</text>
    </svg>`;
    const jpg = await sharp(Buffer.from(svg)).jpeg({ quality: 82 }).toBuffer();
    await archivo.save(jpg, { contentType: "image/jpeg", metadata: { metadata: { firebaseStorageDownloadTokens: token } } });
  } else if (!token) {
    token = randomUUID();
    await archivo.setMetadata({ metadata: { firebaseStorageDownloadTokens: token } });
  }
  return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(ruta)}?alt=media&token=${token}`;
}

async function medidor(lista) {
  if (lista.length === 0) return anota("medidor", "omito: el conjunto no tiene unidades");
  await crearSiFalta("medidor", "meteredServices", SERVICIO, {
    tenantId,
    name: "Agua potable",
    unit: "m3",
    rate: importes.tarifa,
    accountCode: "1.11",
    active: true,
  }, `el servicio «Agua potable» (m³, ${importes.tarifa} ${moneda}/m³)`);
  const periodos = [periodoAnterior(periodoActual), periodoActual];
  anota("medidor", `${verbo("registro", "registraría")} ${lista.length} lecturas con foto en ${periodos.join(" y ")} (la primera es línea base) y ${verbo("cierro", "cerraría")} los dos períodos, SIN cobrar`);
  if (!ESCRIBIR) return;
  for (const [p, periodo] of periodos.entries()) {
    for (const [i, unidad] of lista.entries()) {
      const base = 1200 + i * 137;
      const lectura = p === 0 ? base : base + 8 + ((i * 7) % 15);
      try {
        const photoUrl = await subirFoto(unidad, periodo, lectura);
        await registrarLectura({ tenantId, serviceId: SERVICIO, unitId: unidad.id, period: periodo, current: lectura, photoUrl, actorUid: ACTOR });
      } catch (e) {
        anota("medidor", `omito ${unidad.label} ${periodo}: ${e.message}`);
      }
    }
    try {
      const r = await cerrarPeriodo({ tenantId, serviceId: SERVICIO, period: periodo, actorUid: ACTOR });
      anota("medidor", `cerrado ${periodo}: ${r.lecturas} lecturas`);
    } catch (e) {
      anota("medidor", `no cierro ${periodo}: ${e.message}`);
    }
  }
}

// ── Tesorería: un traspaso y una caja chica abierta ─────────────────────────

async function tesoreria() {
  const [cuentas, libro] = await Promise.all([deConjunto("bankAccounts"), deConjunto("ledgerEntries")]);
  const activas = cuentas.docs.filter((d) => d.data().active !== false);
  if (activas.length === 0) return anota("tesorería", "omito: el conjunto no tiene ninguna cuenta bancaria activa");
  // El origen es la cuenta que opera: la que más asientos lleva.
  const usos = new Map();
  for (const d of libro.docs) {
    const b = d.data().bankAccountId;
    if (b) usos.set(b, (usos.get(b) ?? 0) + 1);
  }
  const origen = [...activas].sort((a, b) => (usos.get(b.id) ?? 0) - (usos.get(a.id) ?? 0))[0];
  const nombreOrigen = origen.data().label;
  let destino = activas.find((d) => d.id !== origen.id && !d.id.startsWith("demo-")) ?? activas.find((d) => d.id === "demo-cuenta-ahorros");
  let nombreDestino = destino?.data().label;
  if (!destino) {
    nombreDestino = "Cuenta de ahorros";
    anota("tesorería", `${verbo("creo", "crearía")} la «${nombreDestino}» (${origen.data().bankName ?? "banco"}), con saldo inicial 0`);
    if (ESCRIBIR) {
      await db.collection("bankAccounts").doc("demo-cuenta-ahorros").create({
        tenantId,
        label: nombreDestino,
        bankName: origen.data().bankName ?? "Banco",
        accountNumber: null,
        accountType: "ahorros",
        currency: moneda,
        active: true,
        ...firmas(),
      });
      await db.collection("bankAccountBalances").doc("demo-cuenta-ahorros").set(
        { tenantId, openingBalance: 0, updatedBy: ACTOR, updatedAt: FieldValue.serverTimestamp() },
        { merge: true },
      );
    }
    destino = { id: "demo-cuenta-ahorros" };
  } else {
    anota("tesorería", `el destino es la cuenta que ya existe, «${nombreDestino}»`);
  }
  await crearSiFalta("tesorería", "treasuryTransfers", "demo-traspaso-reserva", {
    tenantId, fromAccountId: origen.id, toAccountId: destino.id, amount: importes.traspaso, date: hace(12),
    detail: "Fondo de reserva", kind: "traspaso", status: "registrado", ...firmas(),
  }, `un traspaso de ${importes.traspaso} ${moneda} de «${nombreOrigen}» a «${nombreDestino}»`);
  await crearSiFalta("tesorería", "pettyCashFunds", "demo-caja", {
    tenantId, name: nombreCaja, limit: importes.caja, sourceAccountId: origen.id, status: "abierta", ...firmas(),
  }, `la «${nombreCaja}», con límite de ${importes.caja} ${moneda}`);
  await crearSiFalta("tesorería", "treasuryTransfers", "demo-apertura-caja", {
    tenantId, fromAccountId: origen.id, toAccountId: "demo-caja", amount: importes.caja, date: hace(8),
    kind: "apertura", status: "registrado", ...firmas(),
  }, `su apertura desde «${nombreOrigen}»`);
}

// ── Proveedores: los que ya nombran los egresos ─────────────────────────────

async function proveedores() {
  const egresos = await deConjunto("expenses");
  const grupos = new Map();
  for (const d of egresos.docs) {
    const nombre = String(d.data().vendorName ?? "").trim();
    if (!nombre) continue;
    if (!grupos.has(nombre)) grupos.set(nombre, []);
    grupos.get(nombre).push(d);
  }
  if (grupos.size === 0) return anota("proveedores", "omito: ningún egreso nombra a su proveedor");
  const slug = (t) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  for (const [nombre, docs] of [...grupos].sort((a, b) => a[0].localeCompare(b[0], "es"))) {
    const id = `demo-prov-${slug(nombre)}`;
    const cuenta = new Map();
    for (const d of docs) if (d.data().category) cuenta.set(d.data().category, (cuenta.get(d.data().category) ?? 0) + 1);
    const defaultCategory = [...cuenta].sort((a, b) => b[1] - a[1])[0]?.[0];
    const taxId = docs.map((d) => d.data().vendorTaxId).find((t) => typeof t === "string" && t.trim());
    await crearSiFalta("proveedores", "vendors", id, {
      tenantId, type: "proveedor", legalName: nombre,
      ...(taxId ? { taxId: taxId.trim() } : {}),
      ...(defaultCategory ? { defaultCategory } : {}),
      status: "active", ...firmas(),
    }, `«${nombre}»`);
    const sinEnlace = docs.filter((d) => !d.data().vendorId);
    if (sinEnlace.length > 0) {
      anota("proveedores", `   ${verbo("enlazo", "enlazaría")} ${sinEnlace.length} egreso(s) a «${nombre}»`);
      if (ESCRIBIR) for (const d of sinEnlace) await d.ref.update({ vendorId: id });
    }
  }
}

// ── Paz y salvo: uno, para una unidad al día ────────────────────────────────

async function pazYSalvo(lista) {
  const sembrados = (await deConjunto("clearanceCertificates")).docs.filter((d) => d.id.startsWith("pys_demo-vivaru-"));
  if (sembrados.length > 0) return anota("paz y salvo", `ya hay ${sembrados.length} sembrado(s): ${sembrados.map((d) => d.data().code ?? d.id).join(", ")}`);
  const alDia = lista.filter((u) => u.deuda <= 0.005);
  if (alDia.length === 0) return anota("paz y salvo", "omito: ninguna unidad está al día");
  if (!ESCRIBIR) return anota("paz y salvo", `emitiría uno para ${alDia[0].label} (${alDia.length} unidades al día)`);
  for (const u of alDia) {
    try {
      const r = await emitirPazYSalvo({ tenantId, unitId: u.id, unitLabel: u.label, issueDate: fecha(hoy), operationKey: `demo-vivaru-${u.id}` }, ACTOR);
      return anota("paz y salvo", `emitido ${r.code} para ${u.label}`);
    } catch (e) {
      anota("paz y salvo", `${u.label}: ${e.message}`);
    }
  }
}

// ── Limpieza: deshace exactamente lo sembrado ───────────────────────────────

async function limpiar() {
  const borrar = async (ref, que) => {
    anota("limpieza", `${verbo("borro", "borraría")} ${que}`);
    if (ESCRIBIR) await ref.delete();
  };
  const gastosDeCaja = (await db.collection("expenses").where("tenantId", "==", tenantId).where("bankAccountId", "==", "demo-caja").get()).size;
  for (const col of ["treasuryTransfers", "pettyCashFunds", "bankAccounts", "bankAccountBalances", "meteredServices", "vendors"]) {
    for (const d of (await deConjunto(col)).docs.filter((x) => x.id.startsWith("demo-"))) {
      const v = d.data();
      if (col === "treasuryTransfers" && (v.salidaLineId || v.entradaLineId)) {
        anota("limpieza", `DEJO ${col}/${d.id}: tiene un tramo conciliado en el banco`);
        continue;
      }
      if (col === "pettyCashFunds" && gastosDeCaja > 0) {
        anota("limpieza", `DEJO ${col}/${d.id}: ${gastosDeCaja} egreso(s) salieron de ella`);
        continue;
      }
      await borrar(d.ref, `${col}/${d.id}`);
    }
  }
  const lecturas = await db.collection("meterReadings").where("tenantId", "==", tenantId).where("serviceId", "==", SERVICIO).get();
  for (const d of lecturas.docs) {
    if (d.data().status === "cobrado") anota("limpieza", `DEJO meterReadings/${d.id}: ya se cobró`);
    else await borrar(d.ref, `meterReadings/${d.id}`);
  }
  const [fotos] = await bucket.getFiles({ prefix: `tenants/${tenantId}/meter-readings/${SERVICIO}/` });
  anota("limpieza", `${verbo("borro", "borraría")} ${fotos.length} foto(s) de ejemplo`);
  if (ESCRIBIR) for (const f of fotos) await f.delete();
  for (const d of (await deConjunto("expenses")).docs.filter((x) => String(x.data().vendorId ?? "").startsWith("demo-prov-"))) {
    anota("limpieza", `${verbo("desenlazo", "desenlazaría")} expenses/${d.id}`);
    if (ESCRIBIR) await d.ref.update({ vendorId: FieldValue.delete() });
  }
  const pres = db.collection("budgets").doc(`${tenantId}_${hoy.getFullYear()}`);
  const p = await pres.get();
  if (p.exists && p.data().createdBy === ACTOR) await borrar(pres, `budgets/${pres.id}`);
  for (const d of (await deConjunto("clearanceCertificates")).docs.filter((x) => x.id.startsWith("pys_demo-vivaru-"))) {
    await borrar(d.ref, `clearanceCertificates/${d.id}`);
  }
}

if (LIMPIAR) {
  await limpiar();
} else {
  const lista = await unidades();
  await presupuesto();
  await medidor(lista);
  await tesoreria();
  await proveedores();
  await pazYSalvo(lista);
}
console.log(`\n${ESCRIBIR ? "Hecho." : "Simulación: no se escribió nada. Añade --escribir para sembrar."}`);
