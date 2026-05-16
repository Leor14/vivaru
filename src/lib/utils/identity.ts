import { formatUnitInline } from "./unit";

/**
 * Canonical identity stamp for admin tables.
 *
 * Combines unit and person into a single, always-consistent string:
 *   "Torre 1 · Apt 101 — Juan Pérez"
 *
 * Rules:
 * - Prefers `unitLabel` (human string) over parsing `unitId` (slug).
 * - Person segment is omitted when not provided.
 * - Returns "—" when both are missing.
 */
export function formatIdentityStamp(opts: {
  unitId?: string | null;
  unitLabel?: string | null;
  personName?: string | null;
}): string {
  const unit =
    opts.unitLabel?.trim() ||
    (opts.unitId ? formatUnitInline(opts.unitId) : "");
  const person = opts.personName?.trim() ?? "";

  if (!unit && !person) return "—";
  if (!person) return unit;
  if (!unit) return person;
  return `${unit} — ${person}`;
}

/**
 * Two-line identity cell content for admin tables.
 * Returns `{ primary, secondary }` for consistent row rendering:
 *
 *   primary   → person name (or unit when person is unknown)
 *   secondary → formatted unit string (or null when person is the only info)
 *
 * Usage:
 *   const id = resolveIdentityCell({ unitLabel, personName });
 *   <p className="...">{id.primary}</p>
 *   {id.secondary ? <p className="...">{id.secondary}</p> : null}
 */
export function resolveIdentityCell(opts: {
  unitId?: string | null;
  unitLabel?: string | null;
  personName?: string | null;
}): { primary: string; secondary: string | null } {
  const unit =
    opts.unitLabel?.trim() ||
    (opts.unitId ? formatUnitInline(opts.unitId) : "");
  const person = opts.personName?.trim() ?? "";

  if (person && unit) return { primary: person, secondary: unit };
  if (person) return { primary: person, secondary: null };
  if (unit) return { primary: unit, secondary: null };
  return { primary: "—", secondary: null };
}
