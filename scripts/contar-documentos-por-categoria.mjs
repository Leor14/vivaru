/**
 * contar-documentos-por-categoria.mjs — cuántos documentos hay de cada categoría, por conjunto,
 * y cuáles ve el residente. De solo lectura.
 *
 * POR QUÉ EXISTE: `D-3` (lote «Análisis de la plataforma», 15 sep 2026). La pantalla de Documentos
 * sube por defecto con la categoría «otro», que está en la lista blanca del residente. Antes de
 * decidir el arreglo —obligar a elegir categoría, o sacar «otro» de la lista— hay que saber cuántos
 * documentos «otro» existen y de qué son: es el radio. Sacar «otro» de la lista quitaría el acceso
 * a los que ya lo usan.
 *
 * Uso: node scripts/contar-documentos-por-categoria.mjs <projectId> [--detalle]
 *   --detalle  lista los documentos «otro» con su nombre y descripción
 */
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const [projectId, ...banderas] = process.argv.slice(2);
if (!projectId) {
  console.error("Uso: node scripts/contar-documentos-por-categoria.mjs <projectId> [--detalle]");
  process.exit(1);
}
const detalle = banderas.includes("--detalle");

// Espejo de `CATEGORIAS_VISIBLES_PARA_RESIDENTE` (src/features/documents/use-documents.ts) y de la
// regla de `documents` en `firestore.rules`. Si cambia allí, cambia aquí.
const VISIBLES = new Set(["asamblea", "comunicado", "acuerdo", "reglamento", "plano", "memoria", "otro"]);

initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();
const q = await db.collection("documents").get();

const porConjunto = new Map();
for (const d of q.docs) {
  const x = d.data();
  const t = x.tenantId ?? "(sin conjunto)";
  const c = x.category ?? "(sin categoría)";
  if (!porConjunto.has(t)) porConjunto.set(t, new Map());
  const m = porConjunto.get(t);
  m.set(c, (m.get(c) ?? 0) + 1);
}

console.log(`${projectId}${projectId === "hogaru-1" ? " (PRODUCCIÓN)" : ""} — ${q.size} documentos\n`);
let totalOtro = 0;
for (const [t, m] of [...porConjunto].sort((a, b) => a[0].localeCompare(b[0]))) {
  const partes = [...m].sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c}${VISIBLES.has(c) ? "*" : ""} ${n}`);
  totalOtro += m.get("otro") ?? 0;
  console.log(`${t.padEnd(34)} ${partes.join(" · ")}`);
}
console.log(`\n* = la ve el residente. Documentos «otro» en total: ${totalOtro}`);

if (detalle) {
  console.log("\nDocumentos «otro»:");
  for (const d of q.docs.filter((d) => d.data().category === "otro")) {
    const x = d.data();
    console.log(`  ${String(x.tenantId).padEnd(30)} ${String(x.fileName ?? x.name ?? d.id).slice(0, 50).padEnd(52)} ${String(x.description ?? "").slice(0, 60)}`);
  }
}
