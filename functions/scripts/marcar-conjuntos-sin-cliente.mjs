// Marca los conjuntos que NO tienen un cliente detrás (`PRD-V-PLAT-006`, D1).
//
// QUÉ ESCRIBE: `sinClienteDetras: true` en `tenants/{id}`. Nada más.
//
// POR QUÉ UN CAMPO EXPLÍCITO Y NO UN CRITERIO DERIVADO. `isExample` lo llevan
// los NUEVE conjuntos de producción **incluidos los dos del trial**, cuyo
// administrador es un prospecto que se registra con su correo real por diseño:
// derivar la marca de ahí rechazaría al primer cliente que llegue. Y derivarla
// de «no tiene `trialEndsAt`» sería usar un valor como sustituto de un hecho.
// La marca la pone una persona, y por eso existe este script.
//
// A QUIÉN EXCLUYE, Y ES LO ÚNICO QUE HACE FALTA ENTENDER: a los conjuntos de
// TRIAL. Se detectan por `trialEndsAt`, que es el dato que dice «aquí hay un
// prospecto», y **se excluyen aunque estén `expired`**: un trial vencido puede
// convertirse en cliente, y su administrador sigue siendo una persona real.
//
// Deliberadamente aburrido, como su hermano `sanear-correos-de-prueba.mjs`:
//   · En SECO por defecto. Escribe solo con `--escribir`.
//   · `--revertir` quita la marca. Es un campo, así que la vuelta atrás es real.
//   · El proyecto va como argumento SIEMPRE.
//
// CON LA BANDERA `producto-puerta-de-buzones` APAGADA ESTO NO HACE NADA
// VISIBLE, y es a propósito: marcar es lo que cuesta pensar, encender es un
// instante (`RN-6`). Se marca primero y se enciende después.
//
// Uso: node functions/scripts/marcar-conjuntos-sin-cliente.mjs <projectId> [--escribir] [--revertir]

import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const [projectId, ...flags] = process.argv.slice(2);
const ESCRIBIR = flags.includes("--escribir");
const REVERTIR = flags.includes("--revertir");

if (!projectId) {
  console.error("Falta el projectId. Uso: node functions/scripts/marcar-conjuntos-sin-cliente.mjs <projectId> [--escribir] [--revertir]");
  process.exit(1);
}

initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();

console.log(`Proyecto: ${projectId} · modo: ${REVERTIR ? "REVERTIR" : ESCRIBIR ? "ESCRIBIR" : "EN SECO"}\n`);

const snap = await db.collection("tenants").get();
const aMarcar = [];
const excluidos = [];

for (const d of snap.docs) {
  const x = d.data();
  const esTrial = Boolean(x.trialEndsAt);
  const ya = x.sinClienteDetras === true;
  const fila = { id: d.id, nombre: x.name ?? "(sin nombre)", status: x.status ?? "-", ya };
  if (esTrial) excluidos.push({ ...fila, motivo: `trial (vence ${String(x.trialEndsAt).slice(0, 10)})` });
  else aMarcar.push(fila);
}

if (REVERTIR) {
  const conMarca = aMarcar.filter((c) => c.ya);
  console.log(`Conjuntos con la marca puesta: ${conMarca.length}`);
  for (const c of conMarca) console.log(`  ${c.id.padEnd(34)} ${c.nombre}`);
  if (!conMarca.length) { console.log("\n  No hay nada que revertir."); process.exit(0); }
  if (!ESCRIBIR) { console.log("\nEN SECO. Añade --escribir para quitar la marca."); process.exit(0); }
  for (const c of conMarca) {
    await db.collection("tenants").doc(c.id).update({ sinClienteDetras: FieldValue.delete() });
    console.log(`  marca quitada: ${c.id}`);
  }
  process.exit(0);
}

console.log(`SE MARCAN (${aMarcar.length}):`);
for (const c of aMarcar) console.log(`  ${c.id.padEnd(34)} ${String(c.nombre).slice(0, 32).padEnd(34)} status=${c.status}${c.ya ? "  [ya marcado]" : ""}`);

console.log(`\nNO SE TOCAN (${excluidos.length}) — son de trial:`);
for (const c of excluidos) console.log(`  ${c.id.padEnd(34)} ${String(c.nombre).slice(0, 32).padEnd(34)} ${c.motivo}`);

const pendientes = aMarcar.filter((c) => !c.ya);
console.log(`\nPor escribir: ${pendientes.length} de ${aMarcar.length}`);

if (!pendientes.length) { console.log("  No hay nada que hacer."); process.exit(0); }
if (!ESCRIBIR) { console.log("\nEN SECO. Añade --escribir para aplicarlo."); process.exit(0); }

for (const c of pendientes) {
  await db.collection("tenants").doc(c.id).update({ sinClienteDetras: true });
  console.log(`  marcado: ${c.id}`);
}

// Se vuelve a LEER en vez de confiar en que la escritura cuajó.
const despues = await db.collection("tenants").where("sinClienteDetras", "==", true).get();
console.log(`\nVerificado leyendo: ${despues.size} conjuntos marcados en ${projectId}.`);
const trialMarcado = despues.docs.filter((d) => Boolean(d.data().trialEndsAt));
if (trialMarcado.length) {
  console.error(`  ¡OJO! ${trialMarcado.length} conjunto(s) de TRIAL quedaron marcados: ${trialMarcado.map((d) => d.id).join(", ")}`);
  process.exit(1);
}
console.log("  Ningún conjunto de trial quedó marcado.");
