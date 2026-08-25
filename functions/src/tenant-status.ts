import { getFirestore } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";

/**
 * Estados de tenant que permiten ESCRITURA. `suspended` (cliente que dejó de
 * pagar) y `expired` (prueba vencida) quedan en solo lectura: conservan sus
 * datos y pueden consultarlos, pero no operar.
 *
 * Hasta ago 2026 `tenants.status` era decorativo — se mostraba y filtraba en el
 * superadmin pero no bloqueaba nada, así que el botón "suspender" no tenía
 * ningún efecto real. El superadmin nunca queda bloqueado: necesita operar
 * sobre un tenant suspendido para reactivarlo o convertirlo.
 *
 * **Espejo de `tenantOperable()` en `firestore.rules`.** Si cambias uno, cambia
 * el otro: las reglas cubren las escrituras que hace el cliente directamente, y
 * esto cubre las que pasan por callable — que van con Admin SDK y **no evalúan
 * las reglas**. Son dos puertas al mismo sitio y las dos tienen que estar
 * cerradas.
 *
 * **Por qué vive aquí y no en `index.ts`.** Estuvo suelta dentro del índice, y
 * eso la dejaba inalcanzable para `payments.ts` y `advances.ts` sin importar el
 * índice entero (import circular). Ese fue el motivo real de `CF8`: no faltaba
 * la comprobación, faltaba poder llamarla. Mismo movimiento que se hizo con
 * `callableCorsOrigins` → `http-config.ts`.
 */
export const WRITABLE_TENANT_STATUSES = ["active", "trial"];

export async function assertTenantOperable(tenantId: string) {
  const snap = await getFirestore().collection("tenants").doc(tenantId).get();
  if (!snap.exists) return;

  const status = (snap.data() as { status?: string } | undefined)?.status;
  // Sin status explícito se asume operable (compatibilidad con datos antiguos).
  if (!status || WRITABLE_TENANT_STATUSES.includes(status)) return;

  const reason =
    status === "expired"
      ? "El período de prueba de este conjunto terminó. Contacta a un asesor de Vivaru para reactivarlo."
      : "Este conjunto está suspendido. Contacta a un asesor de Vivaru para reactivarlo.";
  throw new HttpsError("failed-precondition", reason);
}
