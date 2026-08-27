// Siembra el coeficiente de copropiedad de un conjunto, a partes iguales.
//
// POR QUÉ EXISTE. `PRD-V-PLAT-001` y `PRD-V-FLOW-001` están construidas, desplegadas y **quietas**
// porque la tabla que alimentan está vacía: al 27 de agosto de 2026, **0 de 93 unidades** de
// producción tienen coeficiente. Encender la bandera no las pone en marcha — es el escalón que
// nadie ve venir: `escrita → construida → desplegada → encendida → CON DATOS`.
//
// A PARTES IGUALES, Y ESO ES UNA DECISIÓN, NO UN DEFECTO. El coeficiente real de un conjunto sale
// de la escritura de propiedad horizontal y Vivaru **no verifica escrituras** (G5 de `PLAT-001`).
// Para un conjunto de demostración, partes iguales es lo único defendible: cualquier otro reparto
// sería inventarse una escritura. Para un cliente real, esto NO sirve — sus coeficientes se
// importan o se teclean.
//
// EL RESIDUO SE REPARTE POR RESTO MAYOR, en micro-porcentaje entero, que es la misma regla que usa
// `repartirPorCoeficiente` para el dinero (`PLAT-001` R6). Sin eso, 100/18 con seis decimales suma
// 100.000008 y **la corrida se niega a correr**: su guarda exige 100 exacto con tolerancia.
//
// LO QUE ESTO NO ARREGLA. La corrida tiene TRES guardas y esto cubre dos: sigue exigiendo que cada
// unidad activa tenga **responsable o propietario** (R5). Este script enlaza propietarios que YA
// existen si se le pasan, pero **no inventa personas**: una unidad sin nadie registrado se lista y
// se deja, y la corrida seguirá nombrándola.
//
// Uso: node functions/scripts/sembrar-coeficientes.mjs <projectId> <tenantId> [--escribir]

import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const [projectId, tenantId, ...flags] = process.argv.slice(2);
const ESCRIBIR = flags.includes("--escribir");

if (!projectId || !tenantId) {
  console.error("Uso: node functions/scripts/sembrar-coeficientes.mjs <projectId> <tenantId> [--escribir]");
  process.exit(1);
}

initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();

/** Seis decimales, que es lo que decidió `PLAT-001`. Se trabaja en enteros para no arrastrar coma flotante. */
const DECIMALES = 6;
const ESCALA = 10 ** DECIMALES; // 1% = 1_000_000 micro
const TOTAL_MICRO = 100 * ESCALA;

/**
 * Propietarios que YA existen y solo hay que enlazar en la unidad.
 *
 * **Enlazar no es inventar.** La persona está registrada como `owner_occupant` de esa unidad; lo
 * que falta es el `ownerIds` del lado de la unidad, que es contra lo que mira R5. Se declara aquí
 * arriba y no se deduce, porque deducir «el primer owner_occupant que aparezca» elegiría al azar
 * entre registros duplicados — y en T2-201 hay CUATRO del mismo David Carmona.
 */
const ENLACES = {
  "tenant-santa-maria": {
    // unidad (id de documento) → persona (id de documento)
    BvFyuvlOrnlxMUVY5j5t: "m8sbjGq5FZUFdpNqEvMt", // T2-201 · David Carmona (4 registros duplicados; se enlaza uno)
    "u-t1-101": "p-owner-1", // T1-101 · Marta Velasquez
  },
};

async function main() {
  console.log(`\nProyecto: ${projectId} · conjunto: ${tenantId} · modo: ${ESCRIBIR ? "ESCRIBIR" : "EN SECO"}\n`);

  const snap = await db.collection("units").where("tenantId", "==", tenantId).get();
  const activas = snap.docs.filter((d) => {
    const s = d.data().status;
    return !s || s === "active";
  });

  if (activas.length === 0) {
    console.log("  El conjunto no tiene unidades activas. No se toca nada.\n");
    return;
  }

  // Orden estable por etiqueta: el residuo tiene que caer siempre en las mismas
  // unidades, o dos pasadas del script darían repartos distintos.
  activas.sort((a, b) => String(a.data().displayName ?? a.id).localeCompare(String(b.data().displayName ?? b.id)));

  const base = Math.floor(TOTAL_MICRO / activas.length);
  let residuo = TOTAL_MICRO - base * activas.length;

  const plan = activas.map((d, i) => {
    const micro = base + (i < residuo ? 1 : 0);
    return { doc: d, etiqueta: String(d.data().displayName ?? d.id), micro, valor: micro / ESCALA };
  });

  const suma = plan.reduce((a, p) => a + p.micro, 0);
  console.log(`  Unidades activas: ${activas.length} (de ${snap.size})`);
  console.log(`  Base: ${(base / ESCALA).toFixed(DECIMALES)}%  ·  residuo repartido en las ${residuo} primeras por etiqueta`);
  console.log(`  SUMA: ${(suma / ESCALA).toFixed(DECIMALES)}%  ${suma === TOTAL_MICRO ? "✔ exacta" : "✘ NO CUADRA — no se escribe"}\n`);

  if (suma !== TOTAL_MICRO) {
    console.error("  La suma no da 100 exacto. Es un defecto del reparto, no del dato: no se escribe nada.\n");
    process.exit(1);
  }

  for (const p of plan) {
    const yaTiene = typeof p.doc.data().coefficient === "number";
    console.log(`    ${p.etiqueta.padEnd(22)} ${p.valor.toFixed(DECIMALES)}%${yaTiene ? `   (tenía ${p.doc.data().coefficient})` : ""}`);
  }

  // R5 · quién queda sin responsable DESPUÉS de aplicar los enlaces conocidos.
  const enlaces = ENLACES[tenantId] ?? {};
  const sinResponsable = [];
  const aEnlazar = [];
  for (const p of plan) {
    const m = p.doc.data();
    const tiene = Boolean(m.billingResponsiblePersonId) || (Array.isArray(m.ownerIds) && m.ownerIds.length > 0);
    if (tiene) continue;
    if (enlaces[p.doc.id]) aEnlazar.push({ ...p, personaId: enlaces[p.doc.id] });
    else sinResponsable.push(p);
  }

  // **«No hay nadie» y «hay alguien que no es propietario» son cosas distintas, y decirlas igual
  // manda a resolverlas del mismo modo.** La primera pide inventar una persona; la segunda pide
  // DECIDIR si el arrendatario es el responsable de pago, que es una decisión de negocio y no un
  // hueco de datos. Se mira quién vive en la unidad antes de imprimir.
  const gente = await db.collection("people").where("tenantId", "==", tenantId).get();
  const porUnidad = new Map();
  for (const d of gente.docs) {
    const m = d.data();
    if (m.status && m.status !== "active") continue;
    const lista = porUnidad.get(m.unitId) ?? [];
    lista.push(`${m.fullName} [${m.roleType}]`);
    porUnidad.set(m.unitId, lista);
  }

  console.log(`\n  R5 · propietarios existentes que se ENLAZAN: ${aEnlazar.length}`);
  for (const p of aEnlazar) console.log(`    ${p.etiqueta.padEnd(22)} → persona ${p.personaId}`);

  console.log(`\n  R5 · unidades que SEGUIRÁN sin responsable: ${sinResponsable.length}`);
  for (const p of sinResponsable) {
    const habitantes = porUnidad.get(p.doc.id) ?? [];
    const motivo = habitantes.length
      ? `hay ${habitantes.join(", ")} — NO es propietario: decidir si es el responsable de pago`
      : "no hay NADIE registrado — haría falta inventar una persona, y este script no lo hace";
    console.log(`    ${p.etiqueta.padEnd(10)} ${motivo}`);
  }
  if (sinResponsable.length > 0) {
    console.log(`\n  ⚠ Con esas ${sinResponsable.length}, la corrida por coeficiente seguirá negándose y las nombrará.`);
    console.log("    Eso es correcto: el dato falta de verdad. No es un defecto del reparto.");
  }

  if (!ESCRIBIR) {
    console.log("\n  EN SECO — no se ha escrito nada. Añade `--escribir` para aplicarlo.\n");
    return;
  }

  let n = 0;
  for (const p of plan) {
    await p.doc.ref.update({ coefficient: p.valor, coefficientSembradoEn: new Date().toISOString() });
    n++;
  }
  let e = 0;
  for (const p of aEnlazar) {
    await p.doc.ref.update({ ownerIds: [p.personaId] });
    e++;
  }
  console.log(`\n  Hecho: ${n} coeficiente(s) y ${e} propietario(s) enlazado(s).\n`);
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
