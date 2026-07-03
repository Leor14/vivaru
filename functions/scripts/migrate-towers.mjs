// Migración one-off: consolida variantes de `tower` a su forma canónica
// (réplica de src/utils/tower.ts) en `units` y `people`, y siembra
// `tenantSettings.agrupaciones` con la lista canónica resultante por tenant.
//
// Uso:
//   DRY_RUN=true node scripts/migrate-towers.mjs <projectId>   # solo reporta
//   node scripts/migrate-towers.mjs <projectId>                # escribe
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const projectId = process.argv[2];
if (!projectId) {
  console.error("Uso: [DRY_RUN=true] node scripts/migrate-towers.mjs <projectId>");
  process.exit(1);
}
const dryRun = process.env.DRY_RUN === "true";

initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();

// ── Réplica exacta de normalizeTower (src/utils/tower.ts) ────────────────────
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

console.log(`\n=== Migración de torres · ${projectId} · ${dryRun ? "DRY RUN (sin escrituras)" : "EN VIVO"} ===\n`);

let unitChanges = 0;
let peopleChanges = 0;
const towersByTenant = new Map(); // tenantId → Set<canónico>

// ── 1. units.tower ────────────────────────────────────────────────────────────
const unitsSnap = await db.collection("units").get();
for (const docSnap of unitsSnap.docs) {
  const d = docSnap.data();
  const tenant = d.tenantId ?? "(sin tenant)";
  const raw = (d.tower ?? "").trim();
  const canonical = normalizeTower(raw);
  if (canonical) {
    if (!towersByTenant.has(tenant)) towersByTenant.set(tenant, new Set());
    towersByTenant.get(tenant).add(canonical);
  }
  if (raw && canonical && canonical !== raw) {
    console.log(`[unit]   ${tenant} · ${docSnap.id} (${d.displayName ?? "?"}): "${raw}" → "${canonical}"`);
    unitChanges++;
    if (!dryRun) {
      await docSnap.ref.update({ tower: canonical, updatedAt: FieldValue.serverTimestamp() });
    }
  }
}

// ── 2. people.tower ───────────────────────────────────────────────────────────
const peopleSnap = await db.collection("people").get();
for (const docSnap of peopleSnap.docs) {
  const d = docSnap.data();
  const tenant = d.tenantId ?? "(sin tenant)";
  const raw = (d.tower ?? "").trim();
  const canonical = normalizeTower(raw);
  if (raw && canonical && canonical !== raw) {
    console.log(`[person] ${tenant} · ${docSnap.id} (${d.fullName ?? "?"}): "${raw}" → "${canonical}"`);
    peopleChanges++;
    if (!dryRun) {
      await docSnap.ref.update({ tower: canonical, updatedAt: FieldValue.serverTimestamp() });
    }
  }
}

// ── 3. tenantSettings.agrupaciones ────────────────────────────────────────────
for (const [tenant, towers] of towersByTenant) {
  if (tenant === "(sin tenant)") continue;
  const list = [...towers].sort((a, b) => a.localeCompare(b, "es-CO", { numeric: true }));
  console.log(`[settings] ${tenant} · agrupaciones = [${list.join(", ")}]`);
  if (!dryRun) {
    await db.collection("tenantSettings").doc(tenant).set(
      {
        tenantId: tenant,
        agrupaciones: list,
        updatedBy: "migracion-torres-2026-07",
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  }
}

console.log(`\n— Resumen: ${unitChanges} unidades, ${peopleChanges} personas, ${towersByTenant.size} tenants con lista sembrada. ${dryRun ? "(dry run, nada escrito)" : "ESCRITO."}\n`);
