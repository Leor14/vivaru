// Siembra la historia de un conjunto de demostración. Plan: docs/plan-seed-demo-lomas-de-sayilbedra.md
// (y su contrato de datos, docs/plan-seed-demo-lomas-de-sayilbedra-contrato.md).
//
// SEGURIDAD, antes que nada (plan §3.2):
//   · El proyecto va SIEMPRE como argumento y no hay default: el activo de gcloud es producción.
//     «La trampa no se evita recordándola: se evita quitando el default» (seed-pqrs-piloto.mjs).
//   · Con FIRESTORE_EMULATOR_HOST puesto solo acepta proyectos `demo-*`; sin él, solo
//     `vivaru-staging-02` o `hogaru-1`, y producción exige además `--si-produccion`.
//   · Simula si no se dice `--escribir`.
//   · Se niega si el conjunto no es de ejemplo; para sembrar o refrescar, también si no está
//     activo, si no es de México, o si alguna bandera no resuelve como la historia necesita (D4, D5).
//
// Tres modos:
//   · sembrar (por defecto): la historia hasta ayer; las membresías, la guía y el buzón de las
//     cuentas demo; la captura de los avisos que eso dispara (D6); y el lote de hoy, solo lo que ya
//     pasó a la hora de correr. Idempotente: la segunda corrida no crea nada.
//   · --refrescar: antes de una demo, cierra lo que los días anteriores dejaron abierto en la
//     portería y siembra el día (visitas y paquetes). No toca el dinero ni la historia.
//   · --limpiar: borra lo del manifiesto por id exacto, las cuentas y los archivos, devuelve los
//     ajustes a como estaban y comprueba que no queda nada fuera de la línea base.
//
// Uso:
//   node functions/scripts/sembrar-historia-demo.mjs <proyecto> <tenantId>
//        [--escribir] [--refrescar | --limpiar] [--si-produccion] [--admin=<uid>] [--hoy=YYYY-MM-DD (solo emulador)]

import { createRequire } from "node:module";
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

import { asegurarLineaBase, completarManifiesto, limpiar, lineaBaseGuardada } from "./historias/barrido.mjs";
import { capturarAvisos, sembrarAvisosHistoricos } from "./historias/escritores/avisos.mjs";
import { crearEscritoresDeBanco } from "./historias/escritores/banco.mjs";
import { crearEscritoresDeCartera } from "./historias/escritores/cartera.mjs";
import { cargarUids, escribirMembresias, marcarOnboarding } from "./historias/escritores/cuentas.mjs";
import { crearEscritoresDeEgresos } from "./historias/escritores/egresos.mjs";
import { crearEscritoresDeInformes } from "./historias/escritores/informes.mjs";
import { crearEscritoresDelMedidor } from "./historias/escritores/medidor.mjs";
import { cerrarDiasAnteriores, crearEscritoresDeOperacion } from "./historias/escritores/operacion.mjs";
import { escribirPadron } from "./historias/escritores/padron.mjs";
import { CASAS_DEMO, construirHistoria } from "./historias/lomas-de-sayilbedra.mjs";
import { eventosDelDia } from "./historias/lomas-operacion.mjs";
import { crearContexto, imprimirConteo } from "./historias/motor.mjs";
import { hoyLocal, instante } from "./historias/reloj.mjs";

const require = createRequire(import.meta.url);

const BUCKETS = {
  "hogaru-1": "hogaru-1.firebasestorage.app",
  "vivaru-staging-02": "vivaru-staging-02.firebasestorage.app",
};
const EMULADOR = Boolean(process.env.FIRESTORE_EMULATOR_HOST);

const args = process.argv.slice(2);
const [proyecto, tenantId] = args.filter((a) => !a.startsWith("--"));
const tiene = (nombre) => args.includes(`--${nombre}`);
const opcion = (nombre) => args.find((a) => a.startsWith(`--${nombre}=`))?.slice(nombre.length + 3);
const escribir = tiene("escribir");
const modo = tiene("limpiar") ? "limpiar" : tiene("refrescar") ? "refrescar" : "sembrar";

function fallar(mensaje) {
  console.error(`\n✗ ${mensaje}\n`);
  process.exit(1);
}

if (!proyecto || !tenantId) {
  fallar("Uso: sembrar-historia-demo.mjs <proyecto> <tenantId> [--escribir] [--refrescar | --limpiar] [--si-produccion] [--admin=<uid>] [--hoy=YYYY-MM-DD]");
}
if (tiene("limpiar") && tiene("refrescar")) fallar("--limpiar y --refrescar no van juntos.");
if (EMULADOR) {
  if (!proyecto.startsWith("demo-")) fallar(`Con el emulador el proyecto tiene que ser demo-*; «${proyecto}» parece real.`);
} else {
  if (!(proyecto in BUCKETS)) fallar(`Proyecto desconocido: «${proyecto}». Solo vivaru-staging-02 o hogaru-1.`);
  if (opcion("hoy")) fallar("--hoy solo vale contra el emulador: en un ambiente real, «hoy» es hoy.");
  if (proyecto === "hogaru-1" && escribir && !tiene("si-produccion")) {
    fallar("Esto es PRODUCCIÓN. Añade --si-produccion si de verdad es lo que quieres, y solo con el permiso de David.");
  }
}

initializeApp(
  EMULADOR
    ? { projectId: proyecto, storageBucket: `${proyecto}.appspot.com` }
    : { credential: applicationDefault(), projectId: proyecto, storageBucket: BUCKETS[proyecto] },
);
const db = getFirestore();
const { resolveFeatureFlag } = require("../lib/feature-flags.js");

const hoy = opcion("hoy") ?? hoyLocal();
// «Ahora», para no sembrar lo que hoy todavía no pasa. En el emulador, con --hoy, el mediodía.
const ahora = EMULADOR && opcion("hoy") ? instante(hoy, "12:00") : new Date();

// ── El conjunto ────────────────────────────────────────────────────────────────────────────────

const snap = await db.collection("tenants").doc(tenantId).get();
if (!snap.exists) fallar(`No existe tenants/${tenantId} en ${proyecto}.`);
const conjunto = snap.data();
if (conjunto.isExample !== true) fallar(`«${conjunto.name}» no está marcado isExample: aquí no se siembra ni se limpia historia inventada.`);

// ── Banderas: como resuelven en Lomas tras D4 y D5 (plan §10 y §12.6) ──────────────────────────

const DEBEN_ESTAR_ENCENDIDAS = [
  "producto-plan-de-cuentas", "producto-concepto-al-libro", "producto-anticipos", "producto-pago-multiple",
  "producto-cobro-por-coeficiente", "producto-prorrateo-de-gastos", "producto-egresos-en-cuotas",
  "producto-registro-proveedores", "producto-estado-de-cuenta", "producto-informe-mensual",
  "producto-reservas-servidor", "producto-presupuesto-anual", "producto-medicion-de-consumos",
  "producto-tesoreria", "producto-rol-consejo", "producto-puerta-de-buzones",
];
// La sombra de PQRS (`ai-pqrs-shadow`) no hace falta apagarla: con el conjunto marcado `isExample`,
// `planificarSombra` omite cada ticket sin llamar al modelo y deja una fila `omitida · sembrado` en
// `aiAssistance` (leído en `sombra-pqrs.ts` el 13 sep). El barrido la apunta y `--limpiar` la borra.
const DEBEN_ESTAR_APAGADAS = ["producto-notificaciones-push"];

if (modo !== "limpiar") {
  if (conjunto.status !== "active") fallar(`«${conjunto.name}» está en «${conjunto.status}»: en prueba, lo sembrado no se podría operar desde la interfaz.`);
  if (conjunto.country !== "MX" || conjunto.currency !== "MXN") fallar(`La historia es de México (MX, MXN) y «${conjunto.name}» es ${conjunto.country}/${conjunto.currency}.`);
  const malas = [];
  for (const k of DEBEN_ESTAR_ENCENDIDAS) {
    const r = await resolveFeatureFlag(k, tenantId);
    if (!r.enabled) malas.push(`${k}: apagada (${r.source})`);
  }
  for (const k of DEBEN_ESTAR_APAGADAS) {
    const r = await resolveFeatureFlag(k, tenantId);
    if (r.enabled) malas.push(`${k}: encendida (${r.source})`);
  }
  if (conjunto.sinClienteDetras !== true) malas.push("falta la marca sinClienteDetras (D5)");
  if (malas.length) fallar(`«${conjunto.name}» no está listo para sembrar:\n    ${malas.join("\n    ")}`);
}

// ── Quién hace de administración ───────────────────────────────────────────────────────────────

let adminUid = null;
if (modo !== "limpiar") {
  const membresias = await db.collection("tenantUsers").where("tenantId", "==", tenantId).get();
  const admins = membresias.docs
    .map((d) => d.data())
    .filter((m) => ["tenant_admin", "admin_tenant"].includes(m.role) && (m.status ?? "active") === "active");
  adminUid = opcion("admin") ?? (admins.length === 1 ? admins[0].uid : null);
  if (!adminUid) fallar(`Hay ${admins.length} administradores activos; di cuál firma con --admin=<uid>.`);
}

// ── La historia ────────────────────────────────────────────────────────────────────────────────

const historia = construirHistoria({ tenantId, hoy });
const { padron } = historia;

console.log(`\nProyecto ${proyecto}${EMULADOR ? " (EMULADOR)" : ""} · conjunto «${conjunto.name}» (${tenantId})`);
console.log(`Hoy (Puebla): ${hoy} · modo ${modo.toUpperCase()} · ${escribir ? "ESCRIBIR" : "SIMULACIÓN"}${adminUid ? ` · administración: ${adminUid}` : ""}`);

const ctx = crearContexto({ db, auth: getAuth(), bucket: getStorage().bucket(), tenantId, adminUid, escribir, historia: historia.historia });
// El «hoy» con que el PRODUCTO calcula estados es el día UTC (`calcularSaldo`, el cron de vencidos).
ctx.hoyUTC = EMULADOR && opcion("hoy") ? opcion("hoy") : new Date().toISOString().slice(0, 10);
ctx.ahora = ahora;
if (adminUid) ctx.adminNombre = (await db.collection("users").doc(adminUid).get()).data()?.fullName ?? "Administración";

async function ejecutar(eventos, escritores, { soloLoQueYaPaso = false } = {}) {
  for (const ev of eventos) {
    if (soloLoQueYaPaso && instante(ev.fecha, ev.datos?.efecto ?? ev.hora) > ahora) {
      ctx.cuenta("lote de hoy", "todavía no pasan");
      continue;
    }
    const escritor = escritores[ev.tipo];
    if (!escritor) {
      ctx.cuenta(`(sin escritor todavía) ${ev.tipo}`, "crearia");
      continue;
    }
    try {
      await escritor(ev);
    } catch (e) {
      throw new Error(`${ev.fecha} ${ev.hora} · ${ev.tipo} · ${ev.clave}: ${e.message}`);
    }
  }
}

function terminar() {
  console.log("");
  imprimirConteo(ctx);
  console.log(escribir ? `\nHecho. Lo creado queda en el manifiesto semillas/${tenantId}.\n` : "\nSimulación: no se escribió nada. Añade --escribir.\n");
  process.exit(0);
}

// ── --limpiar ──────────────────────────────────────────────────────────────────────────────────

if (modo === "limpiar") {
  await limpiar(ctx, { auth: ctx.auth, bucket: ctx.bucket });
  process.exit(0);
}

// ── --refrescar ────────────────────────────────────────────────────────────────────────────────

if (modo === "refrescar") {
  const base = await lineaBaseGuardada(ctx);
  if (!base) fallar("Este conjunto no tiene historia sembrada (no hay manifiesto): primero hay que sembrarla.");
  await cargarUids(ctx, padron);
  const escritores = crearEscritoresDeOperacion(ctx, historia);
  try {
    console.log("\n· Lo que dejaron abierto los días anteriores");
    await cerrarDiasAnteriores(ctx, historia);
    console.log(`· El día ${hoy}, lo que ya pasó`);
    await ejecutar(eventosDelDia(hoy, padron, { CASAS_DEMO }), escritores, { soloLoQueYaPaso: true });
    if (escribir) await completarManifiesto(ctx, base);
  } finally {
    if (escribir) await ctx.manifiesto.guardar();
  }
  terminar();
}

// ── Sembrar ────────────────────────────────────────────────────────────────────────────────────

console.log(
  `Padrón: ${padron.casas.length} casas · ${padron.personas.length} personas · ${padron.cuentas.length} cuentas ` +
    `(${padron.cuentas.filter((c) => c.acceso).length} con acceso) · ${padron.areas.length} áreas · ` +
    `${padron.proveedores.length} proveedores · ${padron.bancos.length} cuentas bancarias`,
);
console.log(`Eventos: ${historia.eventos.length}`);

const arranque = new Date();
const escritores = {
  ...crearEscritoresDeCartera(ctx, historia),
  ...crearEscritoresDeEgresos(ctx, historia),
  ...crearEscritoresDeBanco(ctx, historia),
  ...crearEscritoresDelMedidor(ctx, historia),
  ...crearEscritoresDeInformes(ctx, historia),
  ...crearEscritoresDeOperacion(ctx, historia),
};
const historicos = historia.eventos.filter((e) => e.fecha < hoy);
const deHoy = historia.eventos.filter((e) => e.fecha === hoy);
const creados = (coleccion) => ctx.conteo.get(coleccion)?.creado ?? 0;

async function capturar(fase) {
  if (!escribir) return;
  if (EMULADOR) return console.log(`  (emulador: sin disparadores, nada que capturar en la fase «${fase}»)`);
  await capturarAvisos(ctx, {
    desde: arranque,
    fase,
    creados: fase === "historia"
      ? { tickets: creados("tickets"), reservas: creados("reservations"), avisanAlResidente: creados("reservas que avisan al residente") }
      : null,
  });
}

try {
  const base = escribir ? await asegurarLineaBase(ctx) : null;
  console.log("\n· Padrón y configuración");
  await escribirPadron(ctx, padron);
  if (escribir) await ctx.manifiesto.guardar();

  let mes = null;
  for (const ev of historicos) {
    if (ev.fecha.slice(0, 7) !== mes) {
      if (mes && escribir) await ctx.manifiesto.guardar();
      mes = ev.fecha.slice(0, 7);
      console.log(`· ${mes}`);
    }
    await ejecutar([ev], escritores);
  }

  // Las membresías, después de la historia (plan §3.8): mientras no existían, los disparadores de
  // la historia no encontraron residentes ni portería a quién avisar.
  console.log("· Membresías, guía y buzón de las cuentas demo");
  await escribirMembresias(ctx, padron);
  await marcarOnboarding(ctx);
  await sembrarAvisosHistoricos(ctx, historia);
  if (escribir) await ctx.manifiesto.guardar();
  await capturar("historia");

  console.log(`· Hoy (${hoy}), lo que ya pasó`);
  await ejecutar(deHoy, escritores, { soloLoQueYaPaso: true });
  console.log("· Estados de la cartera");
  await escritores.recalcularEstados();
  await capturar("hoy");
  if (escribir) await completarManifiesto(ctx, base);
} finally {
  if (escribir) await ctx.manifiesto.guardar();
}
terminar();
