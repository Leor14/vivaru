import {
  cert,
  getApps,
  initializeApp,
  applicationDefault,
  type App,
  type ServiceAccount,
} from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

/**
 * Admin SDK para rutas de servidor (`runtime = "nodejs"`).
 *
 * En App Hosting el backend corre con su propia service account, así que las
 * credenciales por defecto (ADC) funcionan sin gestionar llaves. En local, si
 * no hay ADC ni `FIREBASE_SERVICE_ACCOUNT`, `getAdminDb()` devuelve `null` en
 * vez de lanzar: quien lo use debe degradar con elegancia, nunca romper la
 * petición del usuario.
 *
 * OJO: esto NO es `functions/` — es la dependencia `firebase-admin` de la raíz.
 * Importar código de `functions/` desde `src/` sí rompe el build (ver CLAUDE.md).
 */

let cachedDb: Firestore | null = null;
let initAttempted = false;

function resolveApp(): App | null {
  const existing = getApps();
  if (existing.length > 0) return existing[0];

  const projectId =
    process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  // Credencial explícita por JSON (útil fuera de Google Cloud).
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as ServiceAccount & { project_id?: string };
      return initializeApp({
        credential: cert(parsed),
        projectId: parsed.projectId ?? parsed.project_id ?? projectId,
      });
    } catch (error) {
      console.error("[firebase-admin] FIREBASE_SERVICE_ACCOUNT inválido", error);
      return null;
    }
  }

  try {
    return initializeApp({ credential: applicationDefault(), projectId });
  } catch (error) {
    console.error("[firebase-admin] no se pudo inicializar con ADC", error);
    return null;
  }
}

/** Firestore con permisos de admin, o `null` si no hay credenciales disponibles. */
export function getAdminDb(): Firestore | null {
  if (cachedDb) return cachedDb;
  if (initAttempted) return null;
  initAttempted = true;

  const app = resolveApp();
  if (!app) return null;

  try {
    cachedDb = getFirestore(app);
    return cachedDb;
  } catch (error) {
    console.error("[firebase-admin] no se pudo obtener Firestore", error);
    return null;
  }
}
