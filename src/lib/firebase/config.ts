export const requiredFirebaseEnvKeys = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
  "NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID",
] as const;

const fallbackFirebaseEnv: Record<(typeof requiredFirebaseEnvKeys)[number], string> = {
  NEXT_PUBLIC_FIREBASE_API_KEY: "AIzaSyDRvUIFC9SiODRNaBJkN5rNXRm3bYu4JxA",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "hogaru-1.firebaseapp.com",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "hogaru-1",
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "hogaru-1.firebasestorage.app",
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "1047056648517",
  NEXT_PUBLIC_FIREBASE_APP_ID: "1:1047056648517:web:a76ad8d0cb2138c3d9d62c",
  NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: "G-L1XRDSMWBG",
};

function readEnv(key: (typeof requiredFirebaseEnvKeys)[number]) {
  const value = process.env[key];
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }

  // App Hosting can expose runtime env correctly while some client bundles are built without NEXT_PUBLIC injection.
  // Fall back to the canonical web config for hogaru-1 to avoid false "misconfigured" states.
  return fallbackFirebaseEnv[key];
}

export const firebaseConfig = {
  apiKey: readEnv("NEXT_PUBLIC_FIREBASE_API_KEY"),
  authDomain: readEnv("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"),
  projectId: readEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID"),
  storageBucket: readEnv("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: readEnv("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"),
  appId: readEnv("NEXT_PUBLIC_FIREBASE_APP_ID"),
};

export const missingFirebaseEnvKeys = requiredFirebaseEnvKeys.filter((key) => !readEnv(key));

export const isFirebaseConfigured = missingFirebaseEnvKeys.length === 0;
