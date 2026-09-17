"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";

import { db } from "@/lib/firebase/client";

/**
 * **Quién es cada uid dentro del conjunto**, para las pantallas que guardan un uid y tienen que
 * enseñar una persona.
 *
 * Nació con `L-21d` (el residente de un PQRS sin nombre) y a los diez minutos hizo falta otra vez
 * con `L-29` (el guarda que registró una entrada). Vive aquí y no dentro de cada página para que no
 * acaben siendo dos suscripciones que un día digan cosas distintas.
 *
 * Lee `tenantUsers` del propio conjunto, que es lo que ya hace la pantalla de Usuarios: la regla se
 * la concede a la administración. Si falla, devuelve un mapa vacío y quien llama enseña su relleno
 * —nunca un uid crudo—.
 */
export function useNombresPorUid(tenantId?: string): ReadonlyMap<string, string> {
  const [nombres, setNombres] = useState<ReadonlyMap<string, string>>(new Map());

  useEffect(() => {
    if (!tenantId || !db) {
      setNombres(new Map());
      return;
    }
    const dejar = onSnapshot(
      query(collection(db, "tenantUsers"), where("tenantId", "==", tenantId)),
      (snapshot) => {
        const mapa = new Map<string, string>();
        for (const documento of snapshot.docs) {
          const fila = documento.data() as { uid?: string; fullName?: string };
          const nombre = (fila.fullName ?? "").trim();
          if (fila.uid && nombre) mapa.set(fila.uid, nombre);
        }
        setNombres(mapa);
      },
      () => setNombres(new Map()),
    );
    return dejar;
  }, [tenantId]);

  return nombres;
}
