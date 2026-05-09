import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";

export interface TenantBranding {
  name: string;
  color?: string;
  logoUrl?: string;
}

export async function getTenantBranding(tenantId: string): Promise<TenantBranding | null> {
  if (!tenantId) return null;
  if (!db) throw new Error("Firestore no inicializado");
  const ref = doc(db, "tenants", tenantId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    name: data.name || tenantId,
    color: data.brandColor || data.color || undefined,
    logoUrl: data.logoUrl || undefined,
  };
}
