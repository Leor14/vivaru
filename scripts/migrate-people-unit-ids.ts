/**
 * migrate-people-unit-ids.ts
 *
 * Corrige people.unitId y users.unitId donde se guardó el Firestore document ID
 * (hash auto-generado por addDoc) en lugar del slug normalizado (unit.unitId).
 *
 * Contexto: IMP-01 corrigió billingStatements para usar el slug. Este script
 * corrige people y users para que coincidan, permitiendo al residente ver sus
 * cobros en Estado de Cuenta.
 *
 * Uso:
 *   npx ts-node scripts/migrate-people-unit-ids.ts [tenantId]
 *
 * Sin tenantId: procesa todos los tenants.
 * Idempotente: si person.unitId ya es un slug (no aparece como key en el mapa
 * de docId→slug), se omite sin modificar.
 */

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import * as path from "path";

// ── Firebase Admin init ────────────────────────────────────────────────────────
const serviceAccountPath =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ??
  path.resolve(__dirname, "../service-account.json");

if (!getApps().length) {
  initializeApp({ credential: cert(serviceAccountPath) });
}
const db = getFirestore();

// ── Build map: Firestore doc ID → unit.unitId (slug) ─────────────────────────
// Also captures unit.displayName for reconstructing unitLabel.
type UnitMeta = { unitId: string; displayName: string; tower: string };

async function buildDocIdToSlugMap(tenantId: string): Promise<Map<string, UnitMeta>> {
  const snap = await db.collection("units").where("tenantId", "==", tenantId).get();
  const map = new Map<string, UnitMeta>();
  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    const unitId = typeof data.unitId === "string" ? data.unitId.trim() : "";
    const displayName = typeof data.displayName === "string" ? data.displayName.trim() : "";
    const tower = typeof data.tower === "string" ? data.tower.trim() : "";
    if (unitId) {
      map.set(docSnap.id, { unitId, displayName, tower });
    }
  }
  return map;
}

// ── Process one tenant ────────────────────────────────────────────────────────
async function processTenant(tenantId: string): Promise<{ people: number; users: number; skipped: number; noMatch: number }> {
  const docIdMap = await buildDocIdToSlugMap(tenantId);
  console.log(`  [${tenantId}] units map: ${docIdMap.size} entries`);

  const peopleSnap = await db.collection("people").where("tenantId", "==", tenantId).get();

  let peopleFixed = 0;
  let usersFixed = 0;
  let skipped = 0;
  let noMatch = 0;

  const BATCH_SIZE = 400;
  let batch = db.batch();
  let batchOps = 0;

  const flush = async () => {
    if (batchOps > 0) {
      await batch.commit();
      batch = db.batch();
      batchOps = 0;
    }
  };

  for (const personDoc of peopleSnap.docs) {
    const data = personDoc.data();
    const currentUnitId: string = typeof data.unitId === "string" ? data.unitId.trim() : "";

    const meta = docIdMap.get(currentUnitId);

    if (!meta) {
      // currentUnitId is not a Firestore doc ID in the units map — already a slug or unknown
      console.log(`  skip person ${personDoc.id}: unitId="${currentUnitId}" — ya slug o no encontrado`);
      skipped++;
      continue;
    }

    // currentUnitId IS a Firestore doc ID → replace with slug
    const newUnitId = meta.unitId;
    const newTower = data.tower ?? meta.tower;
    const newUnitLabel = newTower ? `${newTower}-${newUnitId}` : newUnitId;

    if (currentUnitId === newUnitId) {
      // Edge case: doc ID happens to equal slug (idempotent guard)
      skipped++;
      continue;
    }

    console.log(`  fix person ${personDoc.id}: "${currentUnitId}" → "${newUnitId}"`);
    batch.update(personDoc.ref, { unitId: newUnitId, unitLabel: newUnitLabel, updatedAt: new Date() });
    peopleFixed++;
    batchOps++;

    // Also fix the corresponding users/{authUid} document if exists
    const authUid: string = typeof data.authUid === "string" ? data.authUid.trim() : "";
    if (authUid) {
      const userRef = db.collection("users").doc(authUid);
      const userSnap = await userRef.get();
      if (userSnap.exists) {
        const userData = userSnap.data()!;
        const userCurrentUnitId: string = typeof userData.unitId === "string" ? userData.unitId.trim() : "";
        if (userCurrentUnitId === currentUnitId) {
          // Same stale hash — fix it too
          batch.update(userRef, { unitId: newUnitId, unitLabel: newUnitLabel, updatedAt: new Date() });
          usersFixed++;
          batchOps++;
          console.log(`    fix users/${authUid}: "${userCurrentUnitId}" → "${newUnitId}"`);
        } else {
          console.log(`    skip users/${authUid}: unitId="${userCurrentUnitId}" — no stale`);
        }
      }
    }

    if (batchOps >= BATCH_SIZE) {
      await flush();
    }
  }

  // Also scan people where unitId isn't in docIdMap at all (no match scenario)
  // (Already handled above via the else-skip path)
  noMatch = peopleSnap.size - peopleFixed - skipped;

  await flush();
  return { people: peopleFixed, users: usersFixed, skipped, noMatch };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const targetTenantId = process.argv[2] ?? null;

  let tenantIds: string[];

  if (targetTenantId) {
    tenantIds = [targetTenantId];
  } else {
    // Discover all tenants from the people collection
    const allPeople = await db.collection("people").select("tenantId").get();
    const seen = new Set<string>();
    for (const doc of allPeople.docs) {
      const tid = doc.data().tenantId;
      if (typeof tid === "string" && tid.trim()) seen.add(tid.trim());
    }
    tenantIds = [...seen];
    console.log(`No tenantId specified — processing ${tenantIds.length} tenant(s): ${tenantIds.join(", ")}`);
  }

  let totalPeople = 0;
  let totalUsers = 0;
  let totalSkipped = 0;

  for (const tenantId of tenantIds) {
    console.log(`\nProcessing tenant: ${tenantId}`);
    const result = await processTenant(tenantId);
    totalPeople += result.people;
    totalUsers += result.users;
    totalSkipped += result.skipped;
    console.log(
      `  → ${result.people} people corregidos, ${result.users} users corregidos, ` +
      `${result.skipped} omitidos (ya slug / no encontrado)`,
    );
  }

  console.log(`\n=== RESUMEN ===`);
  console.log(`  people corregidos : ${totalPeople}`);
  console.log(`  users corregidos  : ${totalUsers}`);
  console.log(`  omitidos          : ${totalSkipped}`);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
