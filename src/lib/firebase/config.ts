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

function pick(envValue: string | undefined, key: (typeof requiredFirebaseEnvKeys)[number]) {
  if (typeof envValue === "string" && envValue.trim().length > 0) {
    return envValue;
  }
  // Fallback al config canónico (hogaru-1) para evitar estados "misconfigured".
  return fallbackFirebaseEnv[key];
}

// IMPORTANTE: cada variable se lee con CLAVE LITERAL (process.env.NEXT_PUBLIC_*).
// Next.js solo inyecta en el bundle del cliente los accesos literales; un acceso
// dinámico (process.env[key]) queda undefined en el navegador y siempre caería al
// fallback (hogaru-1), ignorando la config inyectada por App Hosting (p. ej. staging).
export const firebaseConfig = {
  apiKey: pick(process.env.NEXT_PUBLIC_FIREBASE_API_KEY, "NEXT_PUBLIC_FIREBASE_API_KEY"),
  authDomain: pick(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"),
  projectId: pick(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, "NEXT_PUBLIC_FIREBASE_PROJECT_ID"),
  storageBucket: pick(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET, "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: pick(process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID, "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"),
  appId: pick(process.env.NEXT_PUBLIC_FIREBASE_APP_ID, "NEXT_PUBLIC_FIREBASE_APP_ID"),
};

// Con los fallbacks, las claves de config nunca quedan vacías; se mantiene el export
// por compatibilidad con quienes lo consumen (pantalla de setup-error).
export const missingFirebaseEnvKeys = (
  [firebaseConfig.apiKey, firebaseConfig.authDomain, firebaseConfig.projectId, firebaseConfig.appId].some(
    (v) => !v || v.trim().length === 0,
  )
    ? requiredFirebaseEnvKeys
    : []
) as (typeof requiredFirebaseEnvKeys)[number][];

export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
