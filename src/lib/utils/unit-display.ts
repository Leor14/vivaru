/**
 * Parses a unitLabel of the form "Torre N-unitSlug" or "T2-503" into its parts.
 * Returns a `formatted` string suitable for display in UI ("Torre N / unitSlug").
 *
 * Split rules:
 *  - Left side contains a space ("Torre 1") → tower prefix
 *  - Left side starts with uppercase ("T2")  → tower prefix
 *  - Left side starts with lowercase ("t2")  → no tower, return as-is
 */
export function splitTowerUnit(unitLabel: string | undefined): {
  tower: string;
  unit: string;
  formatted: string;
} {
  if (!unitLabel) return { tower: "-", unit: "-", formatted: "-" };
  const dashIdx = unitLabel.indexOf("-");
  if (dashIdx === -1) {
    return { tower: "-", unit: unitLabel, formatted: unitLabel };
  }
  const before = unitLabel.slice(0, dashIdx).trim();
  const after = unitLabel.slice(dashIdx + 1).trim();
  // Tower prefix: has space (e.g. "Torre 1") OR starts with uppercase (e.g. "T2")
  if (before.includes(" ") || /^[A-Z]/.test(before)) {
    return { tower: before, unit: after, formatted: `${before} / ${after}` };
  }
  // Lowercase slug (e.g. "t2-503") — no tower, return as-is
  return { tower: "-", unit: unitLabel, formatted: unitLabel };
}
