/**
 * migrate-billing-unit-ids.ts
 *
 * Corrige billingStatements donde unitId fue derivado como slug ("unit-apto-301")
 * en lugar del ID real de Firestore de la unidad.
 *
 * Uso:
 *   npx ts-node scripts/migrate-billing-unit-ids.ts [tenantId]
 *
 * Si no se pasa tenantId, procesa TODOS los tenants.
 * El script es idempotente: documentos con unitId ya correcto no se tocan.
 */

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import * as path from "path";

// ── Firebase Admin init ────────────────────────────────────────────────────────
const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
  ?? path.resolve(__dirname, "../service-account.json");

if (!getApps().length) {
  initializeApp({ credential: cert(serviceAccountPath) });
}
const db = getFirestore();

// ── Slug pattern that the old code produced ────────────────────────────────────
const SLUG_PATTERN = /^unit-[a-z0-9]+(-[a-z0-9]+)*$/;

function isSlugId(unitId: string): boolean {
  return SLUG_PATTERN.test(unitId);
}

// ── Build label→realId map from the units collection ──────────────────────────
async function buildUnitLabelMap(tenantId: string): Promise<Map<string, string>> {
  const snap = await db
    .collection("units")
    .where("tenantId", "==", tenantId)
    .get();

  const map = new Map<string, string>();
  for (const doc of snap.docs) {
    const data = doc.data();
    // Mirror the same label resolution logic used in the Admin billing page
    const realId: string =
      (typeof data.unitId === "string" && data.unitId.trim().length > 0
        ? data.unitId.trim()
        : doc.id);
    const label: string =
      (typeof data.displayName === "string" && data.displayName.trim().length > 0
        ? data.displayName.trim()
        : "") ||
      (typeof data.unitLabel === "string" && data.unitLabel.trim().length > 0
        ? data.unitLabel.trim()
        : "") ||
      realId;

    map.set(label.trim().toLowerCase(), realId);
  }
  return map;
}

// ── Main ────────────────────────────────────────────────────────────────────────
async function main() {
  const filterTenantId = process.argv[2] ?? null;

  let billingQuery: FirebaseFirestore.Query = db.collection("billingStatements");
  if (filterTenantId) {
    billingQuery = billingQuery.where("tenantId", "==", filterTenantId);
  }

  const snap = await billingQuery.get();
  console.log(`Total billingStatements encontrados: ${snap.size}`);

  // Group by tenantId to avoid re-fetching units per doc
  const byTenant = new Map<string, FirebaseFirestore.QueryDocumentSnapshot[]>();
  for (const doc of snap.docs) {
    const tenantId: string = doc.data().tenantId ?? "";
    if (!tenantId) continue;
    if (!byTenant.has(tenantId)) byTenant.set(tenantId, []);
    byTenant.get(tenantId)!.push(doc);
  }

  let corrected = 0;
  let alreadyOk = 0;
  let noMatch = 0;
  const noMatchLog: Array<{ docId: string; tenantId: string; unitLabel: string; slugId: string }> = [];

  for (const [tenantId, docs] of byTenant) {
    const unitMap = await buildUnitLabelMap(tenantId);
    console.log(`\nTenant ${tenantId}: ${docs.length} docs, ${unitMap.size} unidades en catálogo`);

    for (const doc of docs) {
      const data = doc.data();
      const currentUnitId: string = data.unitId ?? "";
      const unitLabel: string = data.unitLabel ?? "";

      // Skip docs that already have a real (non-slug) unitId
      if (!isSlugId(currentUnitId)) {
        alreadyOk++;
        continue;
      }

      const realId = unitMap.get(unitLabel.trim().toLowerCase());
      if (!realId) {
        noMatch++;
        noMatchLog.push({ docId: doc.id, tenantId, unitLabel, slugId: currentUnitId });
        continue;
      }

      // Idempotent: if slug matches what would be the real ID anyway, skip
      if (realId === currentUnitId) {
        alreadyOk++;
        continue;
      }

      await doc.ref.update({ unitId: realId });
      console.log(`  ✓ ${doc.id}: "${unitLabel}" ${currentUnitId} → ${realId}`);
      corrected++;
    }
  }

  console.log("\n── Resumen ──────────────────────────────────────────────");
  console.log(`  Corregidos:    ${corrected}`);
  console.log(`  Ya correctos:  ${alreadyOk}`);
  console.log(`  Sin match:     ${noMatch}`);

  if (noMatchLog.length > 0) {
    console.log("\n── Sin match — revisión manual requerida ─────────────────");
    for (const entry of noMatchLog) {
      console.log(`  docId=${entry.docId}  tenant=${entry.tenantId}  label="${entry.unitLabel}"  slugId=${entry.slugId}`);
    }
  }
}

main().catch((err) => {
  console.error("Error en migración:", err);
  process.exit(1);
});
