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

const ov = await db.collection("featureFlagOverrides").get();
console.log(`\nOverrides por conjunto (${ov.size}):`);
for (const d of ov.docs) {
  const f = d.data().flags ?? {};
  const filtradas = Object.entries(f).filter(([k]) => k.startsWith(prefijo));
  if (filtradas.length) console.log(`  ${d.id}: ${filtradas.map(([k, v]) => `${k}=${v}`).join(" · ")}`);
}
