/**
 * Detección de conflictos de reserva (VIV-804): dos reservas de la MISMA
 * amenidad, el MISMO día, con horarios que se solapan. Sin esta validación una
 * doble reserva se guardaba en silencio. Comparación de horas "HH:MM" en
 * formato 24h — el orden lexicográfico coincide con el cronológico.
 */

export type ReservationSlot = {
  id?: string;
  amenityName?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  status?: string;
  unitId?: string;
};

/** Dos rangos [aStart, aEnd) y [bStart, bEnd) se solapan si aStart < bEnd && bStart < aEnd. */
function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Devuelve la primera reserva existente que entra en conflicto con la
 * candidata, o null. Ignora canceladas y (al editar) la propia reserva.
 * Reservas legadas sin `endTime` se tratan como de 1 hora.
 */
export function findReservationConflict(
  existing: readonly ReservationSlot[],
  candidate: { amenityName: string; date: string; startTime: string; endTime?: string },
  excludeId?: string,
): ReservationSlot | null {
  const candidateEnd = candidate.endTime || addOneHour(candidate.startTime);
  for (const item of existing) {
    if (excludeId && item.id === excludeId) continue;
    if (item.status === "cancelled") continue;
    if ((item.amenityName ?? "") !== candidate.amenityName) continue;
    if ((item.date ?? "") !== candidate.date) continue;
    const itemStart = item.startTime ?? "";
    if (!itemStart) continue;
    const itemEnd = item.endTime || addOneHour(itemStart);
    if (overlaps(candidate.startTime, candidateEnd, itemStart, itemEnd)) return item;
  }
  return null;
}

function addOneHour(time: string): string {
  const [h, m] = time.split(":").map(Number);
  if (!Number.isFinite(h)) return time;
  const nextHour = Math.min((h ?? 0) + 1, 23);
  return `${String(nextHour).padStart(2, "0")}:${String(m ?? 0).padStart(2, "0")}`;
}
