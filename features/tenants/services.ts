import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";

export interface TenantBranding {
  name: string;
  color?: string;
  logoUrl?: string;
}

/** Mismo patrón que `normalizeBrandColor` en `app-shell.tsx`. */
const HEX = /^#([0-9a-fA-F]{6})$/;

/**
 * **La marca del conjunto tal y como la ve el residente.**
 *
 * Lee `tenantSettings`, que es donde el administrador la guarda de verdad
 * (`src/features/admin/services.ts`) y donde la siembra el trial
 * (`functions/src/trial-workspace.ts`).
 *
 * **Antes leía `tenants`, y por eso el residente NUNCA vio la marca de su
 * conjunto.** No fallaba: no encontraba `brandColor` y `ResidentHeader` caía a
 * su gris por defecto, así que la cabecera salía igual para todos y nadie
 * podía notar que el color configurado no llegaba. Y no era un descuido que se
 * pudiera arreglar escribiendo también en `tenants`: esa colección es
 * **solo-superadmin** por `firestore.rules` (`allow create, update, delete: if
 * superadmin()`), así que el administrador no puede escribir ahí ni queriendo.
 *
 * El residente sí puede leer `tenantSettings` — su regla es
 * `signedIn() && sameTenant(tenantId)`.
 */
export async function getTenantBranding(tenantId: string): Promise<TenantBranding | null> {
  if (!tenantId) return null;
  if (!db) throw new Error("Firestore no inicializado");

  const snap = await getDoc(doc(db, "tenantSettings", tenantId));
  if (!snap.exists()) return null;
  const data = snap.data();

  // El nombre visible manda sobre el interno: es el que el administrador
  // escribe pensando en lo que leerá el residente.
  const nombre =
    (typeof data.tenantDisplayName === "string" && data.tenantDisplayName.trim()) ||
    (typeof data.tenantName === "string" && data.tenantName.trim()) ||
    tenantId;

  // Un color inválido pintaría la cabecera de negro transparente sin avisar:
  // mejor devolverlo vacío y que el componente use su valor por defecto.
  const color =
    typeof data.brandColor === "string" && HEX.test(data.brandColor.trim())
      ? data.brandColor.trim()
      : undefined;

  const logoUrl =
    typeof data.logoUrl === "string" && data.logoUrl.trim().length > 0
      ? data.logoUrl.trim()
      : undefined;

  return { name: nombre, color, logoUrl };
}
