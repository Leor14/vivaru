/**
 * verificar-reservas-por-servidor.mjs — la PUERTA del paso 3 de `PRD-V-FIX-001`.
 *
 * POR QUÉ EXISTE
 * --------------
 * §13 dice: «con la bandera encendida en todos los conjuntos, comprobar que
 * **ninguna reserva se crea ya por escritura directa**» antes de cerrar la
 * regla. Eso era una instrucción sin instrumento: nadie tenía forma de mirarlo.
 * Esto lo convierte en un número.
 *
 * **Y el número no es «cuántas no llevan marca».** El administrador crea
 * reservas por escritura directa y **va a seguir haciéndolo**: el paso 4 solo
 * retira la rama del RESIDENTE de la regla, no la suya. Contar las del
 * administrador como escritura directa haría que la puerta no se abriera nunca.
 *
 * Así que se separan tres cosas:
 *   · con `createdVia: "callable"`  → por el servidor. Lo que se quiere.
 *   · sin marca, creadas por un ADMIN → legítimo hoy y después. No bloquea.
 *   · sin marca, creadas por un RESIDENTE → **esto es lo que bloquea la puerta.**
 *
 * DE SOLO LECTURA. No hay ninguna escritura en este fichero.
 *
 * USO
 * ---
 *   gcloud auth application-default login
 *   node scripts/verificar-reservas-por-servidor.mjs hogaru-1
 *   node scripts/verificar-reservas-por-servidor.mjs hogaru-1 2026-08-25
 *
 * El segundo argumento es **desde cuándo mirar**, y normalmente es el día en que
 * se encendió la bandera: lo de antes es historia y no dice nada de si la vía
 * nueva funciona.
 */

import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const [projectId, desde] = process.argv.slice(2);
if (!projectId) {
  console.error("Uso: node scripts/verificar-reservas-por-servidor.mjs <projectId> [desde YYYY-MM-DD]");
  process.exit(1);
}
initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();

const corte = desde ? new Date(`${desde}T00:00:00Z`).getTime() / 1000 : 0;

console.log(`Proyecto: ${projectId}${projectId === "hogaru-1" ? " (PRODUCCIÓN)" : ""}`);
console.log(`Desde   : ${desde ?? "el principio"}\n`);

const [reservas, usuarios] = await Promise.all([
  db.collection("reservations").get(),
  db.collection("tenantUsers").get(),
]);

/** `tenantId_uid` → rol. Es como se identifica a quien escribió. */
const rol = new Map(usuarios.docs.map((d) => [d.id, d.data().role]));

const porConjunto = new Map();
let fueraDeRango = 0;

for (const d of reservas.docs) {
  const r = d.data();
  const ts = r.createdAt?._seconds ?? r.createdAt?.seconds ?? 0;
  if (corte && ts < corte) {
    fueraDeRango += 1;
    continue;
  }
  const t = r.tenantId ?? "(sin conjunto)";
  if (!porConjunto.has(t)) porConjunto.set(t, { servidor: 0, adminDirecto: 0, residenteDirecto: 0, ejemplos: [] });
  const c = porConjunto.get(t);

  if (r.createdVia === "callable") {
    c.servidor += 1;
    continue;
  }
  const quien = rol.get(`${t}_${r.createdBy}`) ?? "(desconocido)";
  if (quien === "tenant_admin" || quien === "admin_tenant" || quien === "superadmin") {
    c.adminDirecto += 1;
  } else {
    c.residenteDirecto += 1;
    if (c.ejemplos.length < 3) c.ejemplos.push(`${d.id} · ${r.date ?? "?"} · rol=${quien}`);
  }
}

console.log(`Reservas en el rango: ${reservas.size - fueraDeRango} (de ${reservas.size})\n`);
console.log("conjunto".padEnd(34) + "servidor".padStart(10) + "admin".padStart(9) + "RESIDENTE".padStart(12));
console.log("-".repeat(65));

let bloquean = 0;
for (const [t, c] of [...porConjunto].sort()) {
  bloquean += c.residenteDirecto;
  console.log(
    t.padEnd(34) + String(c.servidor).padStart(10) + String(c.adminDirecto).padStart(9) + String(c.residenteDirecto).padStart(12),
  );
  for (const e of c.ejemplos) console.log(`    ↳ ${e}`);
}

console.log("\n" + "=".repeat(65));
if (bloquean === 0) {
  console.log("PUERTA ABIERTA: ninguna reserva de residente por escritura directa.");
  console.log("Se puede cerrar la rama del residente en firestore.rules (paso 4).");
} else {
  console.log(`PUERTA CERRADA: ${bloquean} reserva(s) de residente creadas por escritura directa.`);
  console.log("NO cerrar la regla todavía: cerrarla ahora deja a esos residentes sin poder reservar.");
}
