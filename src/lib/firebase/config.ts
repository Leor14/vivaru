export const requiredFirebaseEnvKeys = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
  "NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID",
] as const;

/**
 * Respaldo SOLO para desarrollo, y apuntando a STAGING.
 *
 * Estuvo apuntando a `hogaru-1` hasta agosto de 2026, y como este repo no
 * trae las variables en `.env.local`, cualquiera que arrancara `npm run dev`
 * se conectaba a **producción** sin enterarse. Se descubrió al ir a automatizar
 * capturas de pantalla: el script habría hecho login contra datos reales.
 *
 * Mover el respaldo a staging no basta por sí solo: si a un build de producción
 * le faltaran las variables, serviría datos de staging, que es peor que no
 * arrancar. Por eso el respaldo **no existe en producción**: allí App Hosting
 * siempre las inyecta, y si no lo hiciera es preferible que la pantalla de
 * `setup-error` lo grite a que la app funcione con el proyecto equivocado.
 */
const stagingFallback: Record<(typeof requiredFirebaseEnvKeys)[number], string> = {
  NEXT_PUBLIC_FIREBASE_API_KEY: "AIzaSyChPlJL3WESeNggGXBPMiHzIAAicEH8J6c",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "vivaru-staging-02.firebaseapp.com",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "vivaru-staging-02",
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "vivaru-staging-02.firebasestorage.app",
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "765613061037",
  NEXT_PUBLIC_FIREBASE_APP_ID: "1:765613061037:web:37c450d7c1a20b4812a724",
  NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: "G-L1XRDSMWBG",
};

let avisado = false;

function pick(envValue: string | undefined, key: (typeof requiredFirebaseEnvKeys)[number]) {
  if (typeof envValue === "string" && envValue.trim().length > 0) {
    return envValue;
  }
  // En producción no se respalda: mejor romper visiblemente que servir el
  // proyecto equivocado.
  if (process.env.NODE_ENV === "production") return "";

  if (!avisado) {
    avisado = true;
    // eslint-disable-next-line no-console
    console.warn(
      "[firebase] Faltan las variables NEXT_PUBLIC_FIREBASE_*. Usando STAGING " +
        "(vivaru-staging-02). Copia .env.example a .env.local para fijarlo.",
    );
  }
  return stagingFallback[key];
}

// IMPORTANTE: cada variable se lee con CLAVE LITERAL (process.env.NEXT_PUBLIC_*).
// Next.js solo inyecta en el bundle del cliente los accesos literales; un acceso
// dinámico (process.env[key]) queda undefined en el navegador y siempre caería al
// respaldo de desarrollo, ignorando la config inyectada por App Hosting.
export const firebaseConfig = {
  apiKey: pick(process.env.NEXT_PUBLIC_FIREBASE_API_KEY, "NEXT_PUBLIC_FIREBASE_API_KEY"),
  authDomain: pick(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"),
  projectId: pick(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, "NEXT_PUBLIC_FIREBASE_PROJECT_ID"),
  storageBucket: pick(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET, "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: pick(process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID, "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"),
  appId: pick(process.env.NEXT_PUBLIC_FIREBASE_APP_ID, "NEXT_PUBLIC_FIREBASE_APP_ID"),
};

// En desarrollo el respaldo las rellena; en producción quedan vacías si App
// Hosting no las inyectó, y `setup-error` lo muestra.
export const missingFirebaseEnvKeys = (
  [firebaseConfig.apiKey, firebaseConfig.authDomain, firebaseConfig.projectId, firebaseConfig.appId].some(
    (v) => !v || v.trim().length === 0,
  )
    ? requiredFirebaseEnvKeys
    : []
) as (typeof requiredFirebaseEnvKeys)[number][];

export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
