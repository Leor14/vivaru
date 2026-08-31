// Corrige los `billingStatements.concept` que llevan la ETIQUETA donde va la CLAVE.
//
// POR QUÉ EXISTE. `seed-data-co.mjs` sembró `concept: "Parqueadero"` —con mayúscula— en los dos
// ambientes, y el catálogo tiene la clave `parqueadero`. Fallaba por una letra y en tres sitios a
// la vez: el rótulo de la pantalla decía «Mantenimiento y Administración», y el asiento del cobro
// caía en «otros ingresos» en vez de en «Parqueaderos».
//
// El código ya normaliza al leer (31 ago 2026), así que **esto ya no cambia ninguna conducta**: es
// dejar el dato coincidiendo con el catálogo, para que nadie que compare en crudo vuelva a caer.
//
// **NO clava ningún id: DERIVA los candidatos.** Un valor solo se toca si, normalizado, existe en
// el catálogo. Uno que no exista —«Cuota de piscina»— se lista y **no se toca**: eso no es un
// problema de mayúsculas, es un concepto que alguien tiene que decidir.
//
// SECO por defecto. Escribe solo con `--escribir`.
//
// Uso: node functions/scripts/normalizar-concepto-de-cobro.mjs <projectId> [--escribir]

import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

const [, , projectId, ...resto] = process.argv;
const escribir = resto.includes("--escribir");
if (!projectId) {
  console.error("Uso: node functions/scripts/normalizar-concepto-de-cobro.mjs <projectId> [--escribir]");
  process.exit(1);
}

// El catálogo, copiado a propósito y no importado: este script corre con Node suelto y
// `src/` es TypeScript. Si el catálogo crece, esta lista se queda corta y el script
// **lista de más** en vez de tocar de menos — que es el lado seguro del error.
const CLAVES = ["administracion", "extraordinaria", "multa", "reparacion", "interes_mora", "parqueadero", "vigilancia", "otro"];

initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();

const snap = await db.collection("billingStatements").get();
const aCorregir = [];
const sinCatalogo = [];

for (const d of snap.docs) {
  const crudo = d.data().concept;
  if (typeof crudo !== "string" || !crudo.trim()) continue;
  const limpio = crudo.trim().toLowerCase();
  if (limpio === crudo) continue;               // ya está en forma canónica
  if (CLAVES.includes(limpio)) aCorregir.push({ ref: d.ref, id: d.id, de: crudo, a: limpio, tenant: d.data().tenantId });
  else sinCatalogo.push({ id: d.id, valor: crudo, tenant: d.data().tenantId });
}

console.log(`\n${projectId} · ${snap.size} cobros`);
console.log(`\n  A CORREGIR (normalizado existe en el catálogo): ${aCorregir.length}`);
for (const x of aCorregir) console.log(`     ${x.id}  ${x.tenant}  ${JSON.stringify(x.de)} → ${JSON.stringify(x.a)}`);
console.log(`\n  SE LISTAN Y NO SE TOCAN (no existen ni normalizados): ${sinCatalogo.length}`);
for (const x of sinCatalogo) console.log(`     ${x.id}  ${x.tenant}  ${JSON.stringify(x.valor)}`);

if (!escribir) {
  console.log(`\n  MODO SECO. Con --escribir se aplicarían ${aCorregir.length} cambio(s).\n`);
  process.exit(0);
}
if (aCorregir.length === 0) {
  console.log(`\n  Nada que corregir.\n`);
  process.exit(0);
}

const lote = db.batch();
for (const x of aCorregir) lote.update(x.ref, { concept: x.a, updatedAt: Timestamp.now() });
await lote.commit();
console.log(`\n  ${aCorregir.length} cobro(s) corregido(s).\n`);
