/**
 * leer-monedas.mjs — la moneda de cada conjunto. De solo lectura.
 *
 * POR QUÉ EXISTE: los defectos de coma flotante en el dinero solo se ven con
 * monedas de DOS decimales. Saber qué conjuntos son COP (enteros) y cuáles
 * MXN/USD (centavos) es lo que dice si un defecto latente está al alcance.
 */
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
const [projectId] = process.argv.slice(2);
if (!projectId) { console.error("Uso: node scripts/leer-monedas.mjs <projectId>"); process.exit(1); }
initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();
const q = await db.collection("tenants").get();
console.log(`${projectId}${projectId === "hogaru-1" ? " (PRODUCCIÓN)" : ""} — ${q.size} conjuntos\n`);
console.log("conjunto".padEnd(34) + "moneda".padEnd(9) + "decimales  estado    ejemplo");
console.log("-".repeat(78));
for (const d of q.docs.sort((a, b) => a.id.localeCompare(b.id))) {
  const x = d.data();
  const m = x.currency ?? "(sin moneda)";
  const dec = m === "COP" ? 0 : m === "MXN" || m === "USD" ? 2 : "?";
  console.log(d.id.padEnd(34) + String(m).padEnd(9) + String(dec).padEnd(11) + String(x.status ?? "?").padEnd(10) + (x.isExample ? "sí" : "NO"));
}
