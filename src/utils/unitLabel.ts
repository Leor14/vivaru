/**
 * Resolución centralizada de "referencia de unidad" → nombre humano.
 *
 * Motivo: distintos registros guardan la unidad con claves distintas (doc id,
 * slug `unitId`, o un compuesto histórico `"${tower}-${docId}"` generado por
 * fallbacks de onboarding). Antes cada tabla hacía su propio `find()+?? id`, y
 * el fallback renderizaba el ID crudo de Firestore. Este helper es la única
 * fuente: nunca devuelve un ID de 20 chars a la UI, y recupera los compuestos
 * históricos extrayendo el docId final.
 */

export type UnitLike = {
  id: string;
  unitId?: string | null;
  displayName?: string | null;
};

export type UnitIndex = {
  byId: Map<string, UnitLike>;
  bySlug: Map<string, UnitLike>;
};

/** Un ID autogenerado de Firestore son 20 chars alfanuméricos contiguos. */
const FIRESTORE_ID = /[A-Za-z0-9]{20}/;
const TRAILING_ID = /([A-Za-z0-9]{20})$/;

export const UNRESOLVED_UNIT_LABEL = "Unidad no vinculada";

/** Construye el índice una sola vez (por doc id y por slug) para O(1) por fila. */
export function buildUnitIndex(units: readonly UnitLike[]): UnitIndex {
  const byId = new Map<string, UnitLike>();
  const bySlug = new Map<string, UnitLike>();
  for (const u of units) {
    if (u?.id) byId.set(u.id, u);
    if (u?.unitId) bySlug.set(u.unitId, u);
  }
  return { byId, bySlug };
}

/**
 * Resuelve una referencia de unidad a un nombre mostrable.
 * @param ref  doc id, slug, un `displayName` ya humano, o un compuesto histórico.
 * @param index índice construido con `buildUnitIndex`.
 */
export function resolveUnitName(ref: string | null | undefined, index: UnitIndex): string {
  const value = (ref ?? "").trim();
  if (!value) return UNRESOLVED_UNIT_LABEL;

  // 1) doc id exacto
  const byId = index.byId.get(value);
  if (byId?.displayName) return byId.displayName;

  // 2) slug (unitId)
  const bySlug = index.bySlug.get(value);
  if (bySlug?.displayName) return bySlug.displayName;

  // 3) compuesto histórico "torre-<docId>": recuperar por el docId final
  const trailing = value.match(TRAILING_ID);
  if (trailing) {
    const hit = index.byId.get(trailing[1]);
    if (hit?.displayName) return hit.displayName;
  }

  // 4) ya es un texto humano (no contiene un ID de Firestore) → mostrar tal cual
  if (!FIRESTORE_ID.test(value)) return value;

  // 5) parece un ID pero no se pudo resolver → fallback seguro (nunca el ID crudo)
  return UNRESOLVED_UNIT_LABEL;
}
