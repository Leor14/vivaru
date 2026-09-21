"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";

import { db } from "@/lib/firebase/client";
import { normalizarContactos, type ContactoDeEmergencia } from "@/features/tenant/contactos-de-emergencia";

/**
 * Los números de emergencia del conjunto, en vivo (`L-32`).
 *
 * Lo usan el residente y la portería, que solo leen. La administración los edita desde Ajustes con
 * `saveContactosDeEmergencia`.
 *
 * **Un conjunto sin lista devuelve `[]` y la pantalla no pinta la tarjeta**: es lo correcto mientras
 * nadie los haya escrito, y evita enseñar un bloque vacío que parece un error. El error de lectura
 * se traga a propósito, por lo mismo: si `tenantSettings` no se puede leer, el inicio del residente
 * sigue funcionando sin una sección que no es la razón por la que entró.
 */
export function useContactosDeEmergencia(tenantId?: string): ContactoDeEmergencia[] {
  const [contactos, setContactos] = useState<ContactoDeEmergencia[]>([]);

  useEffect(() => {
    if (!tenantId || !db) return;
    return onSnapshot(
      doc(db, "tenantSettings", tenantId),
      (snap) => {
        const data = snap.exists() ? (snap.data() as Record<string, unknown>) : null;
        setContactos(normalizarContactos(data?.contactosDeEmergencia));
      },
      () => setContactos([]),
    );
  }, [tenantId]);

  return contactos;
}
