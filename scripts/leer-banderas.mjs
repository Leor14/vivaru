/**
 * leer-banderas.mjs — enseña el estado REAL de las banderas en un proyecto.
 *
 * POR QUÉ EXISTE: `mover-bandera.mjs` solo escribe, y antes de un despliegue hay
 * que poder LEER sin arriesgarse a mover nada. Es de solo lectura por
 * construcción: no hay ninguna escritura en este fichero.
 *
 *   node scripts/leer-banderas.mjs hogaru-1
 *   node scripts/leer-banderas.mjs hogaru-1 producto-      # filtra por prefijo
 */
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const [projectId, prefijo = ""] = process.argv.slice(2);
if (!projectId) {
  console.error("Falta el proyecto. Ej: node scripts/leer-banderas.mjs hogaru-1 producto-");
  process.exit(1);
}
initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();

console.log(`Proyecto: ${projectId}${projectId === "hogaru-1" ? " (PRODUCCIÓN)" : ""}\n`);

const global = await db.collection("featureFlags").doc("_global").get();
console.log("Kill switch maestro:", global.exists ? JSON.stringify(global.data()) : "(sin documento)");

const flags = await db.collection("featureFlags").get();
const docs = flags.docs.filter((d) => d.id !== "_global" && d.id.startsWith(prefijo));
console.log(`\nBanderas globales (${docs.length}):`);
for (const d of docs) console.log(`  ${d.id.padEnd(34)} enabled=${d.data().enabled}`);
if (docs.length === 0) console.log("  (ninguna con ese prefijo — vale el default del catálogo, que es apagado)");

// Se cuentan los overrides QUE COINCIDEN, no los documentos que existen.
// Decir «(2)» y no listar ninguno se lee como «no pude leerlos», que es la
// clase de pantalla que hace desconfiar de la herramienta justo cuando hay que
// fiarse de ella.
const ov = await db.collection("featureFlagOverrides").get();
const coincidencias = ov.docs
  .map((d) => [d.id, Object.entries(d.data().flags ?? {}).filter(([k]) => k.startsWith(prefijo))])
  .filter(([, f]) => f.length > 0);

console.log(`\nOverrides por conjunto con este prefijo (${coincidencias.length} de ${ov.size} conjuntos con overrides):`);
if (coincidencias.length === 0) console.log("  (ninguno — todos siguen la bandera global)");
for (const [id, f] of coincidencias) {
  console.log(`  ${id}: ${f.map(([k, v]) => `${k}=${v}`).join(" · ")}`);
}
