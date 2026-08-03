import type { Reservation } from "@/types/domain";

/**
 * Decides whether a reservation belongs to a given amenity.
 *
 * This existed inline, character for character, in two places: the resident
 * reservations page and the guard panel. The copies drifted — the guard one
 * grew a `if (!reservation.amenity) return false` guard, the resident one never
 * did — and on 2 Aug 2026 that gap took down `/resident/reservations` in
 * production for Las Playas with:
 *
 *     TypeError: Cannot read properties of undefined (reading 'trim')
 *
 * It ran inside a `useMemo` during render, so the throw escaped to
 * `src/app/error.tsx` and residents got «Algo salió mal» instead of their
 * reservations. One shared function, tested, so the two call sites cannot
 * disagree again.
 *
 * Why the field can be missing at all: `Reservation.amenity` is declared
 * required in `src/types/domain.ts`, but a TypeScript type is a claim about
 * data, not a constraint on it — Firestore stores whatever was written, and
 * documents predating `amenityId` do not all carry a name either.
 */
export function reservationMatchesAmenity(
  reservation: Pick<Reservation, "amenityId" | "amenity">,
  amenity: { id: string; name: string },
): boolean {
  // `amenityId` is the reliable link. Everything below is the fallback for
  // documents written before it existed.
  if (reservation.amenityId) {
    return reservation.amenityId === amenity.id;
  }

  const reservationName = asComparableName(reservation.amenity);
  const amenityName = asComparableName(amenity.name);

  // An unnamed reservation matches nothing. Without this, two records that both
  // normalize to "" would compare equal, and every orphan reservation would
  // attach itself to whichever amenity happens to be selected.
  return reservationName !== "" && reservationName === amenityName;
}

function asComparableName(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}
