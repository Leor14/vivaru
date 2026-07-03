// SOLO LECTURA: inventario de valores de `tower` en units, por tenant.
// Uso: node audit-towers.mjs <projectId>
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const projectId = process.argv[2];
if (!projectId) {
  console.error("Uso: node audit-towers.mjs <projectId>");
  process.exit(1);
}

initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();

// Réplica de normalizeTower (src/utils/tower.ts) para proponer el mapeo.
const PREFIXES = [
  { pattern: /^t(?:orre)?[\s\-_]*(\d+)$/i, label: "Torre" },
  { pattern: /^b(?:loque)?[\s\-_]*([a-z0-9]+)$/i, label: "Bloque" },
  { pattern: /^m(?:anzana)?[\s\-_]*([a-z0-9]+)$/i, label: "Manzana" },
];
const CONNECTORS = new Set(["de", "del", "la", "las", "los", "el", "y", "e"]);
function titleCase(v) {
  return v.toLocaleLowerCase("es-CO").split(" ").map((w, i) =>
    !w ? w : i > 0 && CONNECTORS.has(w) ? w : w.charAt(0).toLocaleUpperCase("es-CO") + w.slice(1)
  ).join(" ");
}
function normalizeTower(value) {
  const trimmed = (value ?? "").trim().replace(/\s+/g, " ");
  if (!trimmed) return "";
  for (const { pattern, label } of PREFIXES) {
    const m = trimmed.match(pattern);
    if (m) {
      const s = m[1];
      return `${label} ${/^\d+$/.test(s) ? s : s.toLocaleUpperCase("es-CO")}`;
    }
  }
  return titleCase(trimmed);
}

const snap = await db.collection("units").get();
const byTenant = new Map();
for (const doc of snap.docs) {
  const d = doc.data();
  const tenant = d.tenantId ?? "(sin tenant)";
  if (!byTenant.has(tenant)) byTenant.set(tenant, new Map());
  const towers = byTenant.get(tenant);
  const raw = (d.tower ?? "").trim() || "(vacío)";
  if (!towers.has(raw)) towers.set(raw, { count: 0, sample: [] });
  const entry = towers.get(raw);
  entry.count++;
  if (entry.sample.length < 3) entry.sample.push(d.displayName ?? doc.id);
}

console.log(`\n=== ${projectId} · ${snap.size} unidades ===`);
for (const [tenant, towers] of byTenant) {
  console.log(`\n■ Tenant: ${tenant}`);
  const rows = [...towers.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  for (const [raw, { count, sample }] of rows) {
    const canonical = raw === "(vacío)" ? "(vacío)" : normalizeTower(raw);
    const marker = canonical !== raw ? "  →  CAMBIA A: " + canonical : "  (ya canónica)";
    console.log(`  "${raw}" · ${count} unidad(es)${marker}   [ej: ${sample.join(", ")}]`);
  }
}
