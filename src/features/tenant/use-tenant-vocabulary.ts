"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";

import { db } from "@/lib/firebase/client";
import { terminosDePais, type TerminosPais } from "@/lib/config/vocabulario-pais";
import { useAuth } from "@/features/auth/auth-context";

/**
 * Términos de propiedad horizontal del conjunto activo.
 *
 * Mismo patrón que `useTenantCurrency`, y por la misma razón: el dato que
 * manda vive en el documento del conjunto y puede cambiar sin recargar. Se
 * suscribe en vivo en lugar de leer una vez.
 *
 * **Sigue al conjunto, no al usuario** — ver `src/lib/config/vocabulario-pais.ts`.
 * Mientras no se sabe el país, devuelve los términos neutros: nunca los de un
 * país concreto, que sería adivinar en la pantalla de alguien.
 */
export function useTenantVocabulary(): TerminosPais & { country?: string } {
  const { user } = useAuth();
  const [country, setCountry] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!user?.tenantId || !db) return;
    return onSnapshot(doc(db, "tenants", user.tenantId), (snap) => {
      setCountry((snap.data() as { country?: string } | undefined)?.country);
    });
  }, [user?.tenantId]);

  return { ...terminosDePais(country), country };
}
