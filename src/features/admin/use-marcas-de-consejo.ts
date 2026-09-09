"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";

import { db } from "@/lib/firebase/client";

/**
 * `PRD-V-PLAT-004` · quién es consejo en este conjunto.
 *
 * **Por qué un hook aparte y no un campo de `PersonItem`.** El padrón vive en
 * `people` y la marca en `tenantUsers`, que son dos colecciones: una persona del
 * padrón **sin cuenta de acceso no tiene membresía**, así que no hay dónde
 * ponerle la marca. El puente es `person.authUid`.
 *
 * **La consulta filtra por `tenantId` y eso no es cosmético**: Firestore evalúa
 * una consulta de lista contra la regla **sin ejecutarla**, así que sin ese
 * `where` la rechazaría entera. Está medido contra el emulador en
 * `tests/rol-consejo.rules.test.ts`, junto con que otro conjunto se deniega.
 */
export type MarcasDeConsejo = Map<string, { desde: Date | null }>;

export function useMarcasDeConsejo(tenantId: string | undefined) {
  const [marcas, setMarcas] = useState<MarcasDeConsejo>(new Map());
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!tenantId || !db) {
      setMarcas(new Map());
      setCargando(false);
      return;
    }
    setCargando(true);
    const consulta = query(collection(db, "tenantUsers"), where("tenantId", "==", tenantId));
    return onSnapshot(
      consulta,
      (snap) => {
        const siguiente: MarcasDeConsejo = new Map();
        for (const documento of snap.docs) {
          const datos = documento.data() as {
            uid?: string;
            isCommittee?: boolean;
            committeeSince?: { toDate?: () => Date };
          };
          if (datos.isCommittee !== true || !datos.uid) continue;
          siguiente.set(datos.uid, { desde: datos.committeeSince?.toDate?.() ?? null });
        }
        setMarcas(siguiente);
        setCargando(false);
      },
      () => {
        // Sin marcas es el estado seguro: la columna dice «no es consejo» en vez
        // de mentir. **Un `catch` que deja la lista vacía convierte un fallo
        // ruidoso en un dato falso**, así que esto NO se usa para decidir
        // permisos — solo para pintar. Quien decide es el servidor.
        setMarcas(new Map());
        setCargando(false);
      },
    );
  }, [tenantId]);

  return { marcas, cargando };
}
