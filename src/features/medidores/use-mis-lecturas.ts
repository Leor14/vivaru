"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";

import { db } from "@/lib/firebase/client";
import type { MeterReading, MeteredService } from "@/types/domain";

/**
 * `PRD-V-FEAT-008` entrega 3 · las lecturas de MI unidad.
 *
 * ## Por qué se pide sin orden y se ordena en memoria
 *
 * **No es una preferencia: está medido contra staging.** La consulta
 * `tenantId + unitId + orderBy(period)` **exige un índice compuesto**, y las
 * otras dos formas no. Y un índice que falta aquí no se manifiesta como error:
 * Firestore **rechaza la consulta entera** y el residente ve «no tienes
 * lecturas» — que es exactamente lo que le pasó a la lista de documentos del
 * residente en agosto.
 *
 * Un residente tiene doce lecturas al año por servicio. Ordenarlas en memoria
 * es gratis, y es el patrón de `watchLedger`: el único de esta familia que
 * nunca se rompió.
 *
 * ## Y por qué el `where` de `unitId` no se puede quitar
 *
 * `residentOwnUnit` compara la unidad de la membresía con la del documento, y
 * Firestore evalúa la consulta **sin ejecutarla**: sin ese filtro se deniega
 * entera aunque todas las lecturas fueran suyas.
 */
export function useMisLecturas(tenantId: string | undefined, unitId: string | undefined) {
  const [lecturas, setLecturas] = useState<MeterReading[]>([]);
  const [servicios, setServicios] = useState<MeteredService[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!tenantId || !unitId || !db) {
      setLecturas([]);
      setCargando(false);
      return;
    }
    setCargando(true);
    const consulta = query(
      collection(db, "meterReadings"),
      where("tenantId", "==", tenantId),
      where("unitId", "==", unitId),
    );
    return onSnapshot(
      consulta,
      (snap) => {
        setLecturas(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<MeterReading, "id">) })));
        setCargando(false);
      },
      () => {
        // Sin lecturas es el estado seguro para pintar. **No se usa para decidir
        // nada**: aquí solo se muestra.
        setLecturas([]);
        setCargando(false);
      },
    );
  }, [tenantId, unitId]);

  useEffect(() => {
    if (!tenantId || !db) return;
    const consulta = query(collection(db, "meteredServices"), where("tenantId", "==", tenantId));
    return onSnapshot(
      consulta,
      (snap) => setServicios(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<MeteredService, "id">) }))),
      () => setServicios([]),
    );
  }, [tenantId]);

  /** Lo más reciente arriba. El orden lo pone esta línea, no un índice. */
  const ordenadas = useMemo(
    () => [...lecturas].sort((a, b) => b.period.localeCompare(a.period)),
    [lecturas],
  );

  const porServicio = useMemo(
    () => new Map(servicios.map((s) => [s.id, s])),
    [servicios],
  );

  return { lecturas: ordenadas, porServicio, cargando };
}
