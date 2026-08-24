/**
 * leer-auditoria.mjs — enseña las últimas entradas de `auditLogs` de un conjunto.
 *
 * De solo lectura por construcción. Existe porque una auditoría que NO se
 * escribió es invisible: no hay error en ningún sitio, simplemente falta la
 * fila — y el 24 de agosto de 2026 esa ausencia fue la prueba de que
 * `writeAuditLog` reventaba con un campo `undefined`.
 *
 *   node scripts/leer-auditoria.mjs vivaru-staging-02 conjunto-las-playas
 *   node scripts/leer-auditoria.mjs vivaru-staging-02 conjunto-las-playas apply_payment
 */
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const [projectId, tenantId, accion] = process.argv.slice(2);
if (!projectId || !tenantId) {
  console.error("Uso: node scripts/leer-auditoria.mjs <projectId> <tenantId> [accion]");
  process.exit(1);
}
initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();

const q = await db.collection("auditLogs").where("tenantId", "==", tenantId).get();
const filas = q.docs
  .map((d) => ({ id: d.id, ...d.data() }))
  .filter((x) => !accion || x.action === accion)
  .sort((a, b) => (b.createdAt?._seconds ?? 0) - (a.createdAt?._seconds ?? 0))
  .slice(0, 25);

console.log(`${projectId} · ${tenantId}${accion ? ` · ${accion}` : ""} — ${filas.length} de ${q.size}\n`);
for (const f of filas) {
  const cuando = f.createdAt?._seconds ? new Date(f.createdAt._seconds * 1000).toISOString().slice(0, 19).replace("T", " ") : "?";
  console.log(`${cuando}  ${String(f.action).padEnd(26)} ${JSON.stringify(f.metadata ?? {})}`);
}
