// Restaura las unidades que la semilla DECLARA y que no existen en la base.
//
// POR QUÉ EXISTE. Salió de `PRD-V-FIX-002`, Fase 2. El informe de claves dejaba
// `tenant-nogal-bogota` en BLOQUEADO con **quince documentos huérfanos** —cargos,
// paquetes, reservas, pases, personas y **una membresía de residente**— apuntando
// a `t1-101`, `t1-102` y `t2-204`. Y uno de esos huérfanos es lo que hace que
// **`juan.herrera@elnogal.co` no vea absolutamente nada** en su portal: su
// `tenantUsers.unitId` nombra una unidad que no está.
//
// LO QUE SE MIDIÓ ANTES DE ESCRIBIR NADA:
//
//   - `seed-data-co.mjs` declara **20 unidades** y existen **15**, en LOS DOS
//     ambientes. Faltan las mismas cinco: `t1-101`, `t1-102`, `t2-201`, `t2-202`
//     y `t2-204`.
//   - El array lleva las veinte **desde el primer commit** (`b2ddf68`, 10 de mayo
//     de 2026) y no se ha tocado desde entonces: no es que se añadieran después.
//   - Los documentos huérfanos también los declara la misma semilla.
//
// Así que esto **no inventa una unidad**: vuelve a escribir la que la semilla
// siempre dijo que existía, con sus mismos valores. Es la diferencia entre
// restaurar y adivinar, y es la razón de que solo funcione sobre conjuntos
// sembrados: sin una declaración previa no hay nada que restaurar.
//
// LO QUE NO HACE. **No toca ni una unidad que ya exista** — ni para «corregirla».
// No borra, no mueve y no reescribe documentos: los huérfanos se resuelven solos
// en cuanto su unidad vuelve a estar, sin migrar nada.
//
// Uso:
//   node functions/scripts/restaurar-unidades-de-la-semilla.mjs <projectId> [tenantId]
//     ... sin más            solo mide y enseña qué crearía
//     ... --escribir         crea las que faltan
//     ... --si-produccion    obligatorio junto a --escribir en `hogaru-1`

import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

import { TENANT_CO, UNITS_CO } from "./seed-data-co.mjs";
import { TENANT_MX, UNITS_MX } from "./seed-data-mx.mjs";
import { TENANT_PLAYAS, UNITS_PLAYAS } from "./seed-data-playas.mjs";
import { COLECCIONES_CON_CLAVE_DE_UNIDAD } from "./lib/claves-de-unidad.mjs";
import { construirCatalogo, planificarDocumento } from "../lib/clave-de-unidad.js";

const SEMBRADOS = [
  { tenantId: TENANT_CO.id, unidades: UNITS_CO, semilla: "seed-data-co.mjs" },
  { tenantId: TENANT_MX.id, unidades: UNITS_MX, semilla: "seed-data-mx.mjs" },
  { tenantId: TENANT_PLAYAS.id, unidades: UNITS_PLAYAS, semilla: "seed-data-playas.mjs" },
];

const [, , projectId, ...resto] = process.argv;
const banderas = new Set(resto.filter((a) => a.startsWith("--")));
const tenantPedido = resto.find((a) => !a.startsWith("--"));
const escribir = banderas.has("--escribir");
const siProduccion = banderas.has("--si-produccion");

if (!projectId) {
  console.error("Uso: node restaurar-unidades-de-la-semilla.mjs <projectId> [tenantId] [--escribir] [--si-produccion]");
  process.exit(1);
}
if (projectId === "hogaru-1" && escribir && !siProduccion) {
  console.error("Esto es PRODUCCIÓN. Añade --si-produccion si de verdad es lo que quieres.");
  process.exit(1);
}

initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();

const objetivo = SEMBRADOS.filter((s) => !tenantPedido || s.tenantId === tenantPedido);
if (objetivo.length === 0) {
  console.error(
    `«${tenantPedido}» no es un conjunto sembrado. Solo se puede restaurar lo que una semilla declara: ` +
      SEMBRADOS.map((s) => s.tenantId).join(", "),
  );
  process.exit(1);
}

console.log(`\nRESTAURAR UNIDADES DECLARADAS POR LA SEMILLA · ${projectId}`);
console.log(escribir ? "MODO: ESCRIBIENDO\n" : "MODO: SECO — no se escribe nada\n");

let creadas = 0;
for (const { tenantId, unidades, semilla } of objetivo) {
  const conjunto = await db.collection("tenants").doc(tenantId).get();
  if (!conjunto.exists) {
    console.log(`── ${tenantId}: no existe en ${projectId}. Se salta.`);
    continue;
  }

  const snap = await db.collection("units").where("tenantId", "==", tenantId).get();
  const existentes = new Set(snap.docs.map((d) => d.id));
  const faltan = unidades.filter((u) => !existentes.has(u.id));

  console.log(`── ${tenantId} (${semilla}): la semilla declara ${unidades.length}, existen ${existentes.size}`);
  if (faltan.length === 0) {
    console.log("   No falta ninguna.\n");
    continue;
  }

  // Cuántos documentos vivos dejarían de ser huérfanos. Es la razón de hacerlo, y
  // merece medirse ANTES: restaurar una unidad que no desatasca nada es ruido.
  //
  // **No se cuentan los que YA usen el id nuevo** —ninguno lo usa, la unidad no
  // existe—, sino los que HOY son huérfanos y dejarían de serlo. Se mide con el
  // mismo resolvedor que usa la migración, planificando dos veces: con el catálogo
  // de ahora y con el catálogo que habría después.
  const deAhora = construirCatalogo(
    snap.docs.map((d) => ({ id: d.id, unitId: d.data().unitId, displayName: d.data().displayName })),
  );
  const deDespues = construirCatalogo([
    ...snap.docs.map((d) => ({ id: d.id, unitId: d.data().unitId, displayName: d.data().displayName })),
    ...faltan.map((u) => ({ id: u.id, unitId: u.unitId, displayName: u.displayName })),
  ]);

  const desatascados = {};
  for (const coleccion of COLECCIONES_CON_CLAVE_DE_UNIDAD) {
    const docs = await db.collection(coleccion.nombre).where("tenantId", "==", tenantId).get();
    const n = docs.docs.filter((d) => {
      const doc = { id: d.id, datos: d.data() };
      return (
        planificarDocumento(coleccion, doc, deAhora).accion === "listar" &&
        planificarDocumento(coleccion, doc, deDespues).accion !== "listar"
      );
    }).length;
    if (n > 0) desatascados[coleccion.nombre] = n;
  }
  const total = Object.values(desatascados).reduce((a, b) => a + b, 0);

  for (const u of faltan) {
    console.log(`   + ${u.id.padEnd(12)} «${u.displayName}» ${u.tower ?? ""}`);
  }
  console.log(
    `   ${faltan.length} unidad(es) a crear · dejan de ser huérfanos ${total} documento(s)` +
      (total ? `: ${Object.entries(desatascados).map(([c, n]) => `${c}=${n}`).join(" · ")}` : ""),
  );
  if (total > 0) {
    console.log("   Los desatasca la MIGRACIÓN, no esto: crear la unidad solo les devuelve a quién apuntar.");
  }
  if (desatascados.tenantUsers) {
    console.log(`   ⚠ ${desatascados.tenantUsers} membresía(s) de residente: hoy no ven NADA de lo suyo.`);
  }

  if (escribir) {
    const now = FieldValue.serverTimestamp();
    for (const u of faltan) {
      // Los mismos campos que escribe `seed-tenant.mjs`, sin inventar ninguno.
      // `create()` y no `set()`: si la unidad apareciera entre la medida y la
      // escritura, esto falla en vez de pisarla.
      await db.collection("units").doc(u.id).create({
        tenantId,
        unitId: u.unitId,
        displayName: u.displayName,
        tower: u.tower,
        type: "apartment",
        status: "active",
        ownerIds: [],
        residentIds: [],
        restauradaDeLaSemilla: true,
        createdAt: now,
        updatedAt: now,
      });
      creadas += 1;
    }
    console.log(`   ${faltan.length} creada(s).`);
  }
  console.log("");
}

console.log(escribir ? `${creadas} unidad(es) creada(s).` : "SECO: no se escribió nada.");
process.exit(0);
