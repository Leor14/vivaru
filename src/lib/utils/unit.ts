/**
 * Resolve a raw unit ID coming from Firestore into a human-friendly
 * `{ torre, apto }`. Handles legacy formats: `torre1-101`, `torre 1-101`,
 * `T1-101`, `Torre1-A4`, `T-2-503`, etc.
 *
 * If the tail looks like a Firestore auto-generated document ID (long
 * mixed-case alphanumeric with no obvious apartment shape), it is dropped.
 *
 * If no torre prefix can be matched, falls back to the first 8 characters
 * of the id as the torre and an empty apartment.
 */
function looksLikeFirestoreId(value: string): boolean {
  if (value.length < 12) return false;
  if (!/^[A-Za-z0-9]+$/.test(value)) return false;
  const hasUpper = /[A-Z]/.test(value);
  const hasLower = /[a-z]/.test(value);
  const hasDigit = /\d/.test(value);
  // Firestore auto-ids mix upper, lower and digits.
  return hasUpper && hasLower && hasDigit;
}

export function resolveUnitName(unitId: string): { torre: string; apto: string } {
  if (!unitId) return { torre: "Sin torre", apto: "" };
  const trimmed = unitId.trim();
  const dashIdx = trimmed.indexOf("-");
  const head = dashIdx >= 0 ? trimmed.slice(0, dashIdx) : trimmed;
  const tail = dashIdx >= 0 ? trimmed.slice(dashIdx + 1) : "";
  const headMatch = head.match(/^t(?:orre)?\s*(\d+)$/i);
  const tailLeadMatch = !headMatch ? trimmed.match(/^t(?:orre)?\s*[-_ ]?(\d+)/i) : null;
  const towerNumber = headMatch?.[1] ?? tailLeadMatch?.[1] ?? null;
  const aptoRaw = tail.trim();
  const aptoIsId = aptoRaw ? looksLikeFirestoreId(aptoRaw) : false;
  const apto = aptoRaw && !aptoIsId
    ? (/^apt/i.test(aptoRaw) ? aptoRaw : `Apt ${aptoRaw}`)
    : "";
  if (towerNumber) {
    return { torre: `Torre ${towerNumber}`, apto };
  }
  if (looksLikeFirestoreId(trimmed)) {
    return { torre: "Sin torre", apto: "" };
  }
  return { torre: trimmed.slice(0, 8), apto };
}

/**
 * Format a unit ID for inline display, e.g. `Torre 1 · Apt 101`.
 * If only torre is known, returns just that.
 */
export function formatUnitInline(unitId: string, fallback = "Sin unidad"): string {
  if (!unitId) return fallback;
  const { torre, apto } = resolveUnitName(unitId);
  if (torre === "Sin torre" && !apto) return fallback;
  return apto ? `${torre} · ${apto}` : torre;
}
