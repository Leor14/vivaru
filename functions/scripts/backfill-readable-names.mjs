import admin from "firebase-admin";

const cliArgs = process.argv.slice(2);
const hasWriteFlag = cliArgs.includes("--write");
const tenantArg = cliArgs.find((arg) => arg.startsWith("--tenant="));

const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || "hogaru-1";
const targetTenantId = tenantArg
  ? tenantArg.slice("--tenant=".length).trim()
  : process.env.TENANT_ID?.trim() || "";
const dryRun = process.env.DRY_RUN === "0" ? false : !hasWriteFlag;

const TECHNICAL_ID_PATTERNS = [
  /^[a-z0-9]{20,}$/i,
  /^usr[-_]/i,
  /^user[-_]/i,
  /^uid[-_]/i,
  /^auth[-_]/i,
];

function initAdmin() {
  if (admin.apps.length) return;
  admin.initializeApp({ projectId });
}

function normalizeName(value) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function isTechnicalIdentifier(value) {
  const normalized = normalizeName(value);
  if (!normalized) return true;
  return TECHNICAL_ID_PATTERNS.some((pattern) => pattern.test(normalized));
}

function shouldBackfillField(value) {
  const normalized = normalizeName(value);
  if (!normalized) return true;
  return isTechnicalIdentifier(normalized);
}

function normalizeUnitLookupKey(value) {
  const normalized = normalizeName(value).toLowerCase();
  if (!normalized) return "";
  return normalized.replace(/^unit-/, "").replace(/^u-/, "");
}

const tenantUserNameCache = new Map();
const appUserNameCache = new Map();
const residentNamesByTenantUnitCache = new Map();

async function resolveNameFromTenantUser(db, tenantId, uid) {
  const normalizedTenantId = normalizeName(tenantId);
  const normalizedUid = normalizeName(uid);
  if (!normalizedTenantId || !normalizedUid) return "";

  const cacheKey = `${normalizedTenantId}_${normalizedUid}`;
  if (tenantUserNameCache.has(cacheKey)) {
    return tenantUserNameCache.get(cacheKey) || "";
  }

  const snap = await db.collection("tenantUsers").doc(cacheKey).get();
  const fullName = snap.exists ? normalizeName(snap.data()?.fullName) : "";
  tenantUserNameCache.set(cacheKey, fullName);
  return fullName;
}

async function resolveNameFromUsersCollection(db, tenantId, uid) {
  const normalizedTenantId = normalizeName(tenantId);
  const normalizedUid = normalizeName(uid);
  if (!normalizedTenantId || !normalizedUid) return "";

  if (appUserNameCache.has(normalizedUid)) {
    const cached = appUserNameCache.get(normalizedUid);
    if (!cached) return "";
    return cached.tenantId === normalizedTenantId ? cached.fullName : "";
  }

  const userSnap = await db.collection("users").doc(normalizedUid).get();
  if (!userSnap.exists) {
    appUserNameCache.set(normalizedUid, null);
    return "";
  }

  const userData = userSnap.data() || {};
  const fullName = normalizeName(userData.fullName || userData.displayName);
  const userTenantId = normalizeName(userData.tenantId);

  const cached = {
    fullName,
    tenantId: userTenantId,
  };

  appUserNameCache.set(normalizedUid, cached);
  if (!fullName || userTenantId !== normalizedTenantId) {
    return "";
  }

  return fullName;
}

async function loadResidentDirectoryForTenant(db, tenantId) {
  const normalizedTenantId = normalizeName(tenantId);
  if (!normalizedTenantId) return new Map();

  if (residentNamesByTenantUnitCache.has(normalizedTenantId)) {
    return residentNamesByTenantUnitCache.get(normalizedTenantId);
  }

  const byUnit = new Map();
  const peopleSnap = await db.collection("people").where("tenantId", "==", normalizedTenantId).get();

  for (const doc of peopleSnap.docs) {
    const data = doc.data() || {};
    const status = normalizeName(data.status || "active").toLowerCase();
    if (status && status !== "active") {
      continue;
    }

    const unitId = normalizeName(data.unitId);
    const fullName = normalizeName(data.fullName);
    if (!unitId || !fullName) {
      continue;
    }

    const current = byUnit.get(unitId) || [];
    if (!current.includes(fullName)) {
      current.push(fullName);
    }
    byUnit.set(unitId, current);
  }

  for (const [unitId, names] of byUnit.entries()) {
    byUnit.set(unitId, [...names].sort((a, b) => a.localeCompare(b, "es")));
  }

  residentNamesByTenantUnitCache.set(normalizedTenantId, byUnit);
  return byUnit;
}

function resolveNamesByUnit(directory, unitId) {
  const exact = directory.get(unitId) || [];
  if (exact.length > 0) {
    return exact;
  }

  const targetKey = normalizeUnitLookupKey(unitId);
  if (!targetKey) {
    return [];
  }

  const merged = new Set();
  for (const [candidateUnitId, names] of directory.entries()) {
    if (normalizeUnitLookupKey(candidateUnitId) !== targetKey) {
      continue;
    }

    for (const name of names) {
      merged.add(name);
    }
  }

  return [...merged].sort((a, b) => a.localeCompare(b, "es"));
}

async function resolveResidentNameForDoc(db, data) {
  const tenantId = normalizeName(data.tenantId);
  const unitId = normalizeName(data.unitId);
  const createdBy = normalizeName(data.createdBy);

  const fromMembership = await resolveNameFromTenantUser(db, tenantId, createdBy);
  if (fromMembership) {
    return fromMembership;
  }

  const fromUserDoc = await resolveNameFromUsersCollection(db, tenantId, createdBy);
  if (fromUserDoc) {
    return fromUserDoc;
  }

  if (!tenantId || !unitId) {
    return "";
  }

  const directory = await loadResidentDirectoryForTenant(db, tenantId);
  const names = resolveNamesByUnit(directory, unitId);
  if (names.length === 0) {
    return "";
  }

  return names.join(", ");
}

function getWritePayload(existingData, resolvedResidentName) {
  if (!resolvedResidentName) {
    return null;
  }

  const currentCreatedByName = normalizeName(existingData.createdByName);
  const currentResidentName = normalizeName(existingData.residentName);

  const payload = {};

  if (shouldBackfillField(currentCreatedByName)) {
    payload.createdByName = resolvedResidentName;
  }

  if (shouldBackfillField(currentResidentName)) {
    payload.residentName = resolvedResidentName;
  }

  if (Object.keys(payload).length === 0) {
    return null;
  }

  payload.updatedAt = admin.firestore.FieldValue.serverTimestamp();
  return payload;
}

async function processCollection(db, collectionName) {
  let queryRef = db.collection(collectionName);
  if (targetTenantId) {
    queryRef = queryRef.where("tenantId", "==", targetTenantId);
  }

  const snap = await queryRef.get();

  let reviewed = 0;
  let matched = 0;
  let updated = 0;
  let skippedWithoutName = 0;

  for (const doc of snap.docs) {
    reviewed += 1;
    const data = doc.data() || {};

    const writeCandidate =
      shouldBackfillField(data.createdByName) || shouldBackfillField(data.residentName);

    if (!writeCandidate) {
      continue;
    }

    matched += 1;

    const resolvedName = await resolveResidentNameForDoc(db, data);
    const payload = getWritePayload(data, resolvedName);

    if (!payload) {
      skippedWithoutName += 1;
      console.warn(
        `[${collectionName}] SKIPPED ${doc.id} -> no resolvable name`,
        JSON.stringify({
          tenantId: normalizeName(data.tenantId),
          createdBy: normalizeName(data.createdBy),
          unitId: normalizeName(data.unitId),
          createdByName: normalizeName(data.createdByName),
          residentName: normalizeName(data.residentName),
        }),
      );
      continue;
    }

    if (!dryRun) {
      await doc.ref.set(payload, { merge: true });
    }

    updated += 1;
    console.log(
      `[${collectionName}] ${dryRun ? "DRY-RUN" : "UPDATED"} ${doc.id} -> ${JSON.stringify(payload)}`,
    );
  }

  return {
    collectionName,
    reviewed,
    matched,
    updated,
    skippedWithoutName,
  };
}

async function run() {
  initAdmin();
  const db = admin.firestore();

  console.log("[backfill-readable-names] start", {
    projectId,
    targetTenantId: targetTenantId || null,
    dryRun,
  });

  const reservations = await processCollection(db, "reservations");
  const visitorPasses = await processCollection(db, "visitorPasses");

  const totals = {
    reviewed: reservations.reviewed + visitorPasses.reviewed,
    matched: reservations.matched + visitorPasses.matched,
    updated: reservations.updated + visitorPasses.updated,
    skippedWithoutName: reservations.skippedWithoutName + visitorPasses.skippedWithoutName,
  };

  console.log("[backfill-readable-names] summary", {
    reservations,
    visitorPasses,
    totals,
    mode: dryRun ? "dry-run" : "write",
  });
}

run().catch((error) => {
  console.error("[backfill-readable-names] failed", error);
  process.exitCode = 1;
});
