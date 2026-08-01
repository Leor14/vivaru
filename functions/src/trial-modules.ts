import { getFirestore } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";

/**
 * Gate de módulos del trial — **la única capa que protege de verdad**.
 *
 * El candado tiene tres capas (ver docs/plan-self-service-trial.md §5): el
 * sidebar con 🔒 y la pantalla de upgrade son marketing —se saltan escribiendo
 * la URL o llamando la callable directo—; esta es la que impide operar.
 *
 * Generaliza `assertFinanceManagementEnabled`, que ya hacía justo esto para una
 * variante de módulo.
 *
 * ESPEJO de `src/lib/config/trial-modules.ts`. `src/` no puede importar de
 * `functions/` (rompe el build de App Hosting, ver CLAUDE.md), así que la
 * matriz vive duplicada a propósito. Si cambias una, cambia la otra.
 */

export type TrialModuleKey =
  | "residents" | "visitors" | "packages" | "communications" | "pqrs"
  | "reservations" | "surveys" | "services" | "documents"
  | "regulations" | "billing" | "finanzas" | "reports" | "users" | "settings";

/** Módulos que durante la prueba son SOLO vista previa: se ven, no se operan. */
const PREVIEW_MODULES: ReadonlySet<TrialModuleKey> = new Set<TrialModuleKey>([
  "billing",
  "finanzas",
  "reports",
  "regulations",
]);

const RESTRICTED_STATUSES = new Set(["trial", "expired"]);

/**
 * Lanza si el módulo está bajo llave para el estado actual del tenant.
 * Los clientes (`active`) nunca se bloquean.
 */
export async function assertModuleAllowed(tenantId: string, moduleKey: TrialModuleKey): Promise<void> {
  if (!PREVIEW_MODULES.has(moduleKey)) return;

  const snap = await getFirestore().collection("tenants").doc(tenantId).get();
  if (!snap.exists) return;

  const status = (snap.data() as { status?: string } | undefined)?.status ?? "active";
  if (!RESTRICTED_STATUSES.has(status)) return;

  throw new HttpsError(
    "permission-denied",
    "Este módulo está disponible con tu plan. Habla con un asesor de Vivaru para activarlo.",
  );
}

/**
 * Bloquea la invitación de PERSONAS REALES durante la prueba (Regla B del plan).
 *
 * Tres razones: protege la reputación de `noreply@notificaciones.grupovivaru.com`
 * —el remitente de los clientes que sí pagan— de listas frías; evita meter datos
 * personales de terceros en un ambiente que expira; y no hace falta para vender,
 * porque el admin recorre los otros portales con sus cuentas de prueba.
 */
export async function assertCanInviteRealPeople(tenantId: string): Promise<void> {
  const snap = await getFirestore().collection("tenants").doc(tenantId).get();
  if (!snap.exists) return;
  const status = (snap.data() as { status?: string } | undefined)?.status ?? "active";
  if (!RESTRICTED_STATUSES.has(status)) return;

  throw new HttpsError(
    "failed-precondition",
    "Durante la prueba no se envían invitaciones a residentes reales. Usa tus cuentas de prueba (Configuración → Mis cuentas de prueba) para recorrer el portal del residente y el de portería.",
  );
}
