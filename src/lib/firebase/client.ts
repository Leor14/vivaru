import { getApp, getApps, initializeApp } from "firebase/app";
import { browserLocalPersistence, getAuth, indexedDBLocalPersistence, initializeAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import { getMessaging, isSupported } from "firebase/messaging";
import { getStorage } from "firebase/storage";

import { firebaseConfig, isFirebaseConfigured } from "@/lib/firebase/config";

function ensureFirebaseDefaults() {
  if (typeof globalThis === "undefined") return;

  // Firebase SDK can auto-connect to emulators from install-time defaults.
  // Keep production config as default unless emulator mode is explicitly requested.
  if (process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true") return;

  (globalThis as typeof globalThis & { __FIREBASE_DEFAULTS__?: unknown }).__FIREBASE_DEFAULTS__ = {
    config: {
      ...firebaseConfig,
      measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID ?? "G-L1XRDSMWBG",
      projectNumber: "1047056648517",
      version: "2",
    },
  };
}

ensureFirebaseDefaults();

function createAuthInstance() {
  if (!app) return null;
  try {
    return initializeAuth(app, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence],
    });
  } catch {
    return getAuth(app);
  }
}

const app = isFirebaseConfigured
  ? getApps().length
    ? getApp()
    : initializeApp(firebaseConfig)
  : null;

export const auth = createAuthInstance();
export const db = app ? getFirestore(app) : null;
export const functions = app ? getFunctions(app, "us-central1") : null;
export const storage = app ? getStorage(app) : null;

export async function getMessagingIfSupported() {
  if (!app) return null;
  const supported = await isSupported().catch(() => false);
  return supported ? getMessaging(app) : null;
}
