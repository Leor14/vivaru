#!/usr/bin/env node

/**
 * Limpieza dirigida de unidades de prueba en Firestore.
 *
 * Borra registros en `units` donde:
 *  - `displayName` o `name` es un valor obviamente de prueba
 *    ("t1", "tr", "test", "x", solo 1-2 caracteres, etc.)
 *  - `tower` es no numérico y no parece "Torre N" / "T N"
 *  - El id del documento parece basura (auto-id sin tower asociado)
 *
 * Uso:
 *  - Simulación (default):
 *    node functions/scripts/clean-test-units.js
 *  - Borrado real (requiere ambas):
 *    DRY_RUN=false CONFIRM_DELETE=YES_I_UNDERSTAND \
 *    node functions/scripts/clean-test-units.js
 *
 * Para limitar a un tenant específico:
 *    TENANT_ID=hogaru node functions/scripts/clean-test-units.js
 */

const admin = require("firebase-admin");

const PROJECT_ID =
  process.env.FIREBASE_PROJECT_ID ||
  process.env.GOOGLE_CLOUD_PROJECT ||
  process.env.GCLOUD_PROJECT ||
  "hogaru-1";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: PROJECT_ID,
  });
}

const db = admin.firestore();

const DRY_RUN = process.env.DRY_RUN !== "false";
const CONFIRM_DELETE = process.env.CONFIRM_DELETE === "YES_I_UNDERSTAND";
const TENANT_ID = process.env.TENANT_ID || null;

const TEST_NAME_PATTERNS = [
  /^t\d?$/i,         // "t", "t1", "t2"
  /^tr$/i,           // "tr"
  /^x+$/i,           // "x", "xx"
  /^test/i,          // "test", "testing"
  /^prueba/i,        // "prueba"
  /^demo/i,          // "demo"
  /^foo|^bar|^baz/i, // placeholder
  /^.{1,2}$/,        // any 1-2 character value
];

function isTestValue(value) {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return true;
  return TEST_NAME_PATTERNS.some((rx) => rx.test(trimmed));
}

function looksLikeFirestoreAutoId(value) {
  if (typeof value !== "string" || value.length < 16) return false;
  if (!/^[A-Za-z0-9]+$/.test(value)) return false;
  return /[A-Z]/.test(value) && /[a-z]/.test(value) && /\d/.test(value);
}

function shouldDelete(unit) {
  const data = unit.data || {};
  const displayName = data.displayName || data.name || "";
  const tower = data.tower || "";
  const reasons = [];

  if (isTestValue(displayName)) {
    reasons.push(`displayName="${displayName}"`);
  }
  if (typeof tower === "string" && tower.trim()) {
    const t = tower.trim().toLowerCase();
    const looksLikeTorre = /^t(orre)?\s*\d+$/i.test(t);
    if (!looksLikeTorre && (isTestValue(tower) || /^[a-z]{2,3}$/.test(t))) {
      reasons.push(`tower="${tower}"`);
    }
  }
  if (looksLikeFirestoreAutoId(displayName)) {
    reasons.push(`displayName looks like auto-id`);
  }

  return reasons.length > 0 ? reasons : null;
}

async function run() {
  console.log(`Project: ${PROJECT_ID}`);
  console.log(`Mode: ${DRY_RUN ? "DRY-RUN (no writes)" : "LIVE DELETE"}`);
  if (TENANT_ID) console.log(`Filter tenantId=${TENANT_ID}`);

  let snap;
  if (TENANT_ID) {
    snap = await db.collection("units").where("tenantId", "==", TENANT_ID).get();
  } else {
    snap = await db.collection("units").get();
  }

  console.log(`Loaded ${snap.size} unit documents.`);

  const toDelete = [];
  snap.forEach((doc) => {
    const reasons = shouldDelete({ id: doc.id, data: doc.data() });
    if (reasons) {
      toDelete.push({ id: doc.id, data: doc.data(), reasons });
    }
  });

  console.log(`Candidates: ${toDelete.length}`);
  for (const u of toDelete) {
    console.log(
      `  - ${u.id}  tenant=${u.data.tenantId || "?"}  ` +
        `display="${u.data.displayName || u.data.name || ""}"  ` +
        `tower="${u.data.tower || ""}"  ` +
        `reasons=[${u.reasons.join(", ")}]`,
    );
  }

  if (DRY_RUN) {
    console.log("DRY-RUN: no writes performed. Set DRY_RUN=false to delete.");
    return;
  }
  if (!CONFIRM_DELETE) {
    console.log(
      "Refusing to delete without CONFIRM_DELETE=YES_I_UNDERSTAND.",
    );
    return;
  }

  let deleted = 0;
  for (const u of toDelete) {
    await db.collection("units").doc(u.id).delete();
    deleted++;
  }
  console.log(`Deleted ${deleted} unit documents.`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
