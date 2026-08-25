import { getFirestore } from "firebase-admin/firestore";

/**
 * ¿Es `uid` administrador ACTIVO del conjunto `tenantId`?
 *
 * **La autoridad sobre qué conjunto puede operar alguien es el documento de
 * membresía (`tenantUsers/{tenantId}_{uid}`), nunca el claim del token.** El
 * claim `tenantId` significa «el último conjunto conocido» y es de un solo
 * valor por diseño (`PRD-V-PLAT-002` §7.4): compararlo con el conjunto pedido
 * hace imposible que un mismo administrador opere dos conjuntos aunque tenga
 * membresía válida en ambos.
 *
 * **Por qué vive aquí y no en `index.ts`.** Mismo movimiento, y por el mismo
 * motivo, que `assertTenantOperable` → `tenant-status.ts`: `payments.ts` y
 * `advances.ts` no pueden importar el índice sin un ciclo. `index.ts` tiene su
 * propio `assertActiveTenantAdmin`, que además valida el perfil de la cuenta y
 * el estado del conjunto; esto es la pieza mínima —¿membresía de admin, activa,
 * en ESTE conjunto?— para que cada llamador componga su propia secuencia y
 * lance **su** mensaje. En la ruta del dinero el orden de las comprobaciones
 * está razonado y no puede heredarse de otra función (ver `assertPuedeCobrar`).
 *
 * Devuelve un booleano y no lanza a propósito: el mensaje de denegación es del
 * llamador. Un `false` no distingue «no eres miembro» de «tu membresía está
 * inactiva», y eso es deliberado — hacia fuera las dos son «no tienes permiso».
 */
export async function esAdminActivoDelConjunto(tenantId: string, uid: string): Promise<boolean> {
  if (!tenantId || !uid) return false;

  const snap = await getFirestore().collection("tenantUsers").doc(`${tenantId}_${uid}`).get();
  if (!snap.exists) return false;

  const membresia = snap.data() as { role?: string; status?: string; tenantId?: string } | undefined;
  if (!membresia) return false;

  // El id del documento ya lleva el conjunto, pero el campo se comprueba igual:
  // es la misma defensa que hace `assertActiveTenantAdmin` y cubre un documento
  // escrito con el campo y el id discrepando.
  if (membresia.tenantId !== tenantId) return false;

  if (membresia.role !== "tenant_admin" && membresia.role !== "admin_tenant") return false;

  // Sin `status` explícito se asume activa, igual que `assertActiveTenantAdmin`
  // y que el resto del producto: hay membresías anteriores al campo.
  return (membresia.status ?? "active") === "active";
}
