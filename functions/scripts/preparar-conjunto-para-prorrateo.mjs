// Mide —y opcionalmente cierra— los dos huecos de datos que impiden repartir un
// gasto entre las unidades (`PRD-V-FLOW-001`, que se apoya en `PRD-V-PLAT-001`).
//
// POR QUÉ EXISTE. `producto-cobro-por-coeficiente` lleva encendida desde el 25 de
// agosto de 2026 en los nueve conjuntos y **no puede generar ni una corrida**,
// porque `repartirPorCoeficiente` exige dos cosas que los datos no tienen:
//
//   R2 · toda unidad activa con coeficiente, y la suma exactamente 100 (±1e-6)
//   R5 · toda unidad activa con responsable de cobro o con propietario
//
// Medido en producción el 25 de agosto de 2026: **0 de 88 unidades con
// coeficiente** y **74 de 87 activas sin responsable ni propietario**. Encender
// la bandera no era el arranque: la tabla que alimenta estaba vacía.
//
// LO QUE ESCRIBE, Y LO QUE NO INVENTA.
//
//   - `coefficient` en cada unidad activa: reparto **a partes iguales**
//     normalizado a exactamente 100 por conjunto. El residuo se asigna por resto
//     mayor **en millonésimas**, con el mismo método que
//     `repartirPorCoeficiente` usa para el dinero, para que R2 no falle por la
//     coma flotante. Es un dato de demostración y se dice: sin asamblea que los
//     apruebe, cualquier reparto es igual de arbitrario, y el uniforme es el
//     único que no finge precisión que no tiene.
//
//   - `ownerIds` en cada unidad: **NO se inventa, se enlaza**. Cada documento de
//     `people` ya trae su `unitId`; lo que falta es el enlace de vuelta. Solo se
//     enganchan las personas cuyo `roleType` es de propiedad —`owner_occupant` e
//     `investor`—. **Un arrendatario NO se convierte en propietario**: a quién se
//     le cobra es una decisión de negocio (§4 de la ficha) y no la toma un script.
//     Las unidades que se queden sin responsable se nombran, no se rellenan.
//
// NO TOCA `billingResponsiblePersonId`, por lo mismo.
//
// NO CLOBBERA. Una unidad que ya tenga coeficiente o propietarios se salta y se
// cuenta aparte: este script cierra huecos, no reescribe decisiones.
//
// Uso:
//   node functions/scripts/preparar-conjunto-para-prorrateo.mjs <projectId> [tenantId]
//     ... sin más            solo mide y enseña qué haría
//     ... --escribir         aplica
//     ... --si-produccion    obligatorio junto a --escribir en `hogaru-1`
//
// Sin `tenantId` recorre todos los conjuntos. Con él, solo ese — que es lo
// sensato: para validar `FLOW-001` basta UN conjunto operable, y sembrar los
// nueve multiplica el dato inventado sin multiplicar lo que se aprende.

import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { terminoCoeficiente } from "../lib/vocabulario-pais.js";

const [, , projectId, ...resto] = process.argv;
const banderas = new Set(resto.filter((a) => a.startsWith("--")));
const tenantPedido = resto.find((a) => !a.startsWith("--"));

const escribir = banderas.has("--escribir");
const siProduccion = banderas.has("--si-produccion");

if (!projectId) {
  console.error("Uso: node preparar-conjunto-para-prorrateo.mjs <projectId> [tenantId] [--escribir]");
  process.exit(1);
}
if (projectId === "hogaru-1" && escribir && !siProduccion) {
  console.error("Esto es PRODUCCIÓN. Añade --si-produccion si de verdad es lo que quieres.");
  process.exit(1);
}

initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();

const ROLES_DE_PROPIEDAD = new Set(["owner_occupant", "investor"]);
const TOLERANCIA_SUMA = 0.000001; // el mismo de `coefficient-billing.ts`
const MILLONESIMAS = 1_000_000; // 100% con seis decimales, en enteros

/**
 * Reparte 100 entre `n` unidades de forma que la suma sea EXACTAMENTE 100 dentro
 * de la tolerancia. Se trabaja en millonésimas enteras y el residuo se asigna por
 * resto mayor, igual que hace el reparto del dinero. Con 24 unidades, `100/24` no
 * cierra solo: es justo el caso que haría fallar R2 y bloquear todo.
 */
function repartirCienEntre(n) {
  const totalMinor = 100 * MILLONESIMAS;
  const exacto = totalMinor / n;
  const piso = Math.floor(exacto);
  const pisos = new Array(n).fill(piso);
  let residuo = totalMinor - piso * n;
  for (let i = 0; i < n && residuo > 0; i++, residuo--) pisos[i] += 1;
  return pisos.map((v) => v / MILLONESIMAS);
}

const tenantsSnap = await db.collection("tenants").get();
const paises = Object.fromEntries(tenantsSnap.docs.map((d) => [d.id, d.data()?.country ?? null]));

const unidades = (await db.collection("units").get()).docs.map((d) => ({ _id: d.id, ...d.data() }));
const personas = (await db.collection("people").get()).docs.map((d) => ({ _id: d.id, ...d.data() }));

// El enlace va de la persona a la unidad. `people.unitId` puede referirse al
// campo `unitId` de la unidad o a su id de documento: se indexan los dos.
const personasPorUnidad = new Map();
for (const p of personas) {
  if (!p.unitId || (p.status ?? "active") !== "active") continue;
  const clave = `${p.tenantId}|${p.unitId}`;
  if (!personasPorUnidad.has(clave)) personasPorUnidad.set(clave, []);
  personasPorUnidad.get(clave).push(p);
}
const personasDe = (u) =>
  personasPorUnidad.get(`${u.tenantId}|${u.unitId}`) ?? personasPorUnidad.get(`${u.tenantId}|${u._id}`) ?? [];

const porConjunto = new Map();
for (const u of unidades) {
  if ((u.status ?? "active") === "inactive") continue;
  if (tenantPedido && u.tenantId !== tenantPedido) continue;
  if (!porConjunto.has(u.tenantId)) porConjunto.set(u.tenantId, []);
  porConjunto.get(u.tenantId).push(u);
}

if (porConjunto.size === 0) {
  console.error(tenantPedido ? `El conjunto «${tenantPedido}» no tiene unidades activas.` : "No hay unidades activas.");
  process.exit(1);
}

console.log(`\nProyecto: ${projectId}`);
console.log(`Modo:     ${escribir ? "ESCRIBIENDO" : "solo medición — nada se escribe"}\n`);

let totalCoef = 0;
let totalDuenos = 0;
const conjuntosOperables = [];
const conjuntosBloqueados = [];

for (const [tenantId, us] of [...porConjunto.entries()].sort()) {
  const termino = terminoCoeficiente(paises[tenantId] ?? undefined);
  const reparto = repartirCienEntre(us.length);
  const orden = [...us].sort((a, b) =>
    String(a.displayName ?? a._id).localeCompare(String(b.displayName ?? b._id), "es-CO"),
  );

  const planCoef = [];
  const yaTenian = [];
  orden.forEach((u, i) => {
    if (typeof u.coefficient === "number" && !Number.isNaN(u.coefficient)) yaTenian.push(u);
    else planCoef.push({ u, valor: reparto[i] });
  });

  const planDuenos = [];
  const sinResponsable = [];
  for (const u of orden) {
    const yaTiene = !!u.billingResponsiblePersonId || (Array.isArray(u.ownerIds) && u.ownerIds.length > 0);
    if (yaTiene) continue;
    const propietarios = personasDe(u).filter((p) => ROLES_DE_PROPIEDAD.has(p.roleType));
    if (propietarios.length > 0) planDuenos.push({ u, ids: propietarios.map((p) => p._id) });
    else sinResponsable.push(u);
  }

  // La suma que de verdad verá R2 después de escribir.
  const sumaFinal = orden.reduce((acc, u, i) => {
    const propio = typeof u.coefficient === "number" && !Number.isNaN(u.coefficient) ? u.coefficient : reparto[i];
    return acc + propio;
  }, 0);
  const r2 = Math.abs(sumaFinal - 100) <= TOLERANCIA_SUMA;
  const r5 = sinResponsable.length === 0;

  console.log(`── ${tenantId}  (${paises[tenantId] ?? "país sin definir"} · ${termino})`);
  console.log(`   unidades activas          ${us.length}`);
  console.log(`   ${termino} por poner${" ".repeat(Math.max(1, 14 - termino.length))}${planCoef.length}${yaTenian.length ? `   (${yaTenian.length} ya lo tenían y NO se tocan)` : ""}`);
  console.log(`   propietarios por enlazar  ${planDuenos.length}`);
  console.log(`   R2 · suma = 100           ${r2 ? "✅" : "❌"}  ${sumaFinal.toFixed(6)}`);
  console.log(`   R5 · todas con responsable ${r5 ? "✅" : `❌  faltan ${sinResponsable.length}: ${sinResponsable.slice(0, 6).map((u) => u.displayName ?? u._id).join(", ")}${sinResponsable.length > 6 ? "…" : ""}`}`);
  console.log(`   → ${r2 && r5 ? "QUEDA OPERABLE para una corrida" : "SIGUE BLOQUEADO"}\n`);

  (r2 && r5 ? conjuntosOperables : conjuntosBloqueados).push(tenantId);

  if (escribir) {
    let lote = db.batch();
    let enLote = 0;
    const commit = async () => {
      if (enLote > 0) await lote.commit();
      lote = db.batch();
      enLote = 0;
    };
    for (const { u, valor } of planCoef) {
      lote.update(db.collection("units").doc(u._id), { coefficient: valor });
      if (++enLote >= 400) await commit();
    }
    for (const { u, ids } of planDuenos) {
      lote.update(db.collection("units").doc(u._id), { ownerIds: ids });
      if (++enLote >= 400) await commit();
    }
    await commit();
    totalCoef += planCoef.length;
    totalDuenos += planDuenos.length;
  }
}

if (escribir) {
  console.log(`Escrito: ${totalCoef} coeficientes y ${totalDuenos} enlaces de propietario.\n`);
} else {
  console.log("Nada escrito. Añade --escribir para aplicar.\n");
}

console.log(`Operables tras esto: ${conjuntosOperables.length ? conjuntosOperables.join(", ") : "ninguno"}`);
if (conjuntosBloqueados.length > 0) {
  console.log(`Siguen bloqueados:   ${conjuntosBloqueados.join(", ")}`);
  console.log("  — les faltan personas, no coeficiente. Un script no puede inventar a quién se le cobra.");
}
console.log("");
