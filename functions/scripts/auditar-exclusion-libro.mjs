// SOLO LECTURA: ¿es inocua hoy la corrección de la exclusión del libro?
//
// `PLAT-003` entrega 1b-i cambia la exclusión que evita el doble conteo del
// recaudo (`use-ledger.ts` y `financial-statement.ts`) para que mire el ORIGEN
// del asiento —`sourceType: "billingStatement"`— y no su categoría, aceptando
// además `category === "alicuota"` durante la convivencia (regla R12 de la PRD).
//
// El cambio es inocuo SOLO si los dos conjuntos coinciden hoy. Se rompe por dos
// lados y hay que mirar los dos:
//
//   · Un asiento `billingStatement` con categoría distinta de `alicuota`
//     empezaría a EXCLUIRSE y hoy no se excluye → el ingreso del libro BAJA.
//   · Un asiento `alicuota` de otro origen sigue excluyéndose por la cláusula
//     de convivencia, así que no mueve nada — pero se cuenta para saber cuánto
//     depende todavía de esa cláusula.
//
// No imprime concepto, unidad ni monto de ningún asiento: solo conteos por
// (sourceType × category), tenantId e ids cuando hay un caso que mover números.
//
// Uso: node functions/scripts/auditar-exclusion-libro.mjs <projectId>
//      node functions/scripts/auditar-exclusion-libro.mjs hogaru-1
//      node functions/scripts/auditar-exclusion-libro.mjs vivaru-staging-02

import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const projectId = process.argv[2];
if (!projectId) {
  console.error("Uso: node auditar-exclusion-libro.mjs <projectId>");
  process.exit(1);
}

initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();

const snap = await db.collection("ledgerEntries").get();

const cross = new Map(); // "sourceType|category|type" → conteo
const rompen = [];       // billingStatement con categoría != alicuota
const alicuotaDeOtroOrigen = new Map(); // sourceType → conteo
let ingresos = 0;

for (const doc of snap.docs) {
  const d = doc.data();
  const sourceType = d.sourceType ?? "(sin sourceType)";
  const category = d.category ?? "(sin category)";
  const type = d.type ?? "(sin type)";
  const key = `${sourceType}|${category}|${type}`;
  cross.set(key, (cross.get(key) ?? 0) + 1);

  if (type !== "ingreso") continue;
  ingresos += 1;

  if (d.sourceType === "billingStatement" && d.category !== "alicuota") {
    rompen.push({ id: doc.id, tenantId: d.tenantId ?? "(sin tenantId)", category });
  }
  if (d.category === "alicuota" && d.sourceType !== "billingStatement") {
    alicuotaDeOtroOrigen.set(sourceType, (alicuotaDeOtroOrigen.get(sourceType) ?? 0) + 1);
  }
}

console.log(`\nProyecto: ${projectId}`);
console.log(`Asientos en ledgerEntries: ${snap.size} (de ingreso: ${ingresos})\n`);

console.log("Reparto (sourceType × category × type):");
for (const [key, n] of [...cross.entries()].sort((a, b) => b[1] - a[1])) {
  const [sourceType, category, type] = key.split("|");
  console.log(`  ${String(n).padStart(5)}  ${type.padEnd(8)} ${sourceType.padEnd(18)} ${category}`);
}

console.log("\n── Lo que decide si el cambio es inocuo ──");
console.log(`Ingresos con sourceType="billingStatement" y category!="alicuota": ${rompen.length}`);
if (rompen.length > 0) {
  console.log("  ⚠️  El cambio MOVERÍA NÚMEROS. Deja de ser inocuo:");
  for (const r of rompen.slice(0, 50)) {
    console.log(`    ${r.id}  tenant=${r.tenantId}  category=${r.category}`);
  }
  if (rompen.length > 50) console.log(`    … y ${rompen.length - 50} más`);
} else {
  console.log("  ✅ Ninguno. La exclusión por origen y la exclusión por categoría");
  console.log("     seleccionan hoy exactamente el mismo conjunto de asientos.");
}

console.log(`\nIngresos con category="alicuota" de OTRO origen (siguen excluidos por la cláusula de convivencia):`);
if (alicuotaDeOtroOrigen.size === 0) {
  console.log("  (ninguno)");
} else {
  for (const [sourceType, n] of [...alicuotaDeOtroOrigen.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(5)}  ${sourceType}`);
  }
}
console.log("");
