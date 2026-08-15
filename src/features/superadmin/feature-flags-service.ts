import {
  FieldPath,
  collection,
  deleteField,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";

import { db } from "@/lib/firebase/client";
import {
  FEATURE_FLAGS_COLLECTION,
  FEATURE_FLAG_OVERRIDES_COLLECTION,
  GLOBAL_FLAG_DOC_ID,
  type FeatureFlagKey,
} from "@/lib/feature-flags/catalog";
import type { FeatureFlagDoc, GlobalFeatureFlagDoc } from "@/lib/feature-flags/resolve";

/**
 * Escrituras de la consola de banderas. Solo superadmin — las reglas lo
 * imponen, esto no es la protección.
 *
 * OJO con las claves: llevan guion (`ai-gateway`), así que un field path de
 * texto (`flags.ai-gateway`) NO se parsea. Por eso `FieldPath("flags", key)`.
 */

function assertDb() {
  if (!db) throw new Error("Firebase no esta configurado en este entorno.");
  return db;
}

export interface FeatureFlagRow {
  id: string;
  data: FeatureFlagDoc & { updatedAt?: unknown; updatedBy?: unknown };
}

export interface TenantOverridesRow {
  tenantId: string;
  flags: Record<string, boolean>;
}

/** Todas las banderas más el documento `_global`, separado. */
export function watchFeatureFlags(
  onData: (payload: { flags: Record<string, FeatureFlagDoc>; global: GlobalFeatureFlagDoc | null }) => void,
  onError: (message: string) => void,
) {
  const firestore = assertDb();

  return onSnapshot(
    collection(firestore, FEATURE_FLAGS_COLLECTION),
    (snapshot) => {
      const flags: Record<string, FeatureFlagDoc> = {};
      let global: GlobalFeatureFlagDoc | null = null;

      for (const docSnap of snapshot.docs) {
        if (docSnap.id === GLOBAL_FLAG_DOC_ID) {
          global = docSnap.data() as GlobalFeatureFlagDoc;
          continue;
        }
        flags[docSnap.id] = docSnap.data() as FeatureFlagDoc;
      }

      onData({ flags, global });
    },
    (error) => onError(error.message),
  );
}

/** Overrides de todos los conjuntos. Solo superadmin puede listar la colección. */
export function watchFeatureFlagOverrides(
  onData: (rows: TenantOverridesRow[]) => void,
  onError: (message: string) => void,
) {
  const firestore = assertDb();

  return onSnapshot(
    collection(firestore, FEATURE_FLAG_OVERRIDES_COLLECTION),
    (snapshot) => {
      const rows = snapshot.docs.map((docSnap) => {
        const raw = (docSnap.data() as { flags?: unknown }).flags;
        const flags: Record<string, boolean> = {};

        if (raw && typeof raw === "object" && !Array.isArray(raw)) {
          for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
            if (typeof value === "boolean") flags[key] = value;
          }
        }

        return { tenantId: docSnap.id, flags };
      });

      onData(rows);
    },
    (error) => onError(error.message),
  );
}

export async function setFeatureFlagEnabled(key: FeatureFlagKey, enabled: boolean, actorUid: string) {
  const firestore = assertDb();
  await setDoc(
    doc(firestore, FEATURE_FLAGS_COLLECTION, key),
    { enabled, updatedAt: serverTimestamp(), updatedBy: actorUid },
    { merge: true },
  );
}

export async function setFeatureFlagKillSwitch(key: FeatureFlagKey, killSwitch: boolean, actorUid: string) {
  const firestore = assertDb();
  await setDoc(
    doc(firestore, FEATURE_FLAGS_COLLECTION, key),
    { killSwitch, updatedAt: serverTimestamp(), updatedBy: actorUid },
    { merge: true },
  );
}

/** Kill switch maestro: apaga todas las banderas de golpe, sin desplegar. */
export async function setMasterKillSwitch(killSwitch: boolean, reason: string, actorUid: string) {
  const firestore = assertDb();
  await setDoc(
    doc(firestore, FEATURE_FLAGS_COLLECTION, GLOBAL_FLAG_DOC_ID),
    { killSwitch, reason, updatedAt: serverTimestamp(), updatedBy: actorUid },
    { merge: true },
  );
}

/**
 * `value === null` quita el override y devuelve el conjunto al valor global.
 * «Sin override» y «override en false» son estados distintos y la consola
 * tiene que poder volver del segundo al primero.
 */
export async function setTenantFeatureFlagOverride(
  tenantId: string,
  key: FeatureFlagKey,
  value: boolean | null,
  actorUid: string,
) {
  const firestore = assertDb();
  const ref = doc(firestore, FEATURE_FLAG_OVERRIDES_COLLECTION, tenantId);

  if (value === null) {
    await updateDoc(ref, new FieldPath("flags", key), deleteField(), "updatedAt", serverTimestamp(), "updatedBy", actorUid);
    return;
  }

  await setDoc(
    ref,
    { flags: { [key]: value }, updatedAt: serverTimestamp(), updatedBy: actorUid },
    { merge: true },
  );
}
