/**
 * Aritmética de rangos horarios para reservas, en minutos desde medianoche.
 *
 * ESPEJO de `src/features/reservations/time-range.ts` — solo la parte pura que
 * el servidor necesita para decidir. `functions/` no puede importar de `src/`
 * (se despliega standalone, con su propio `npm ci`), así que la copia es
 * deliberada, igual que `utils/datetimeValidation.ts`. Si cambias uno, cambia
 * el otro; el que manda es ESTE, porque es el que decide si una reserva se
 * crea (PRD-V-FIX-001 §11.1).
 */

export const SLOT_GRANULARITY_MINUTES = 30;
export const DEFAULT_AMENITY_WINDOW = { start: 6 * 60, end: 22 * 60 };

export type TimeRange = {
  start: number;
  end: number;
};

const HOUR_MINUTES = 60;

function parseMeridiemToken(value: string) {
  return value
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/\./g, "");
}

export function parseClockTime(value: string) {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;

  const hour = Number(match[1]);
  const minutes = Number(match[2]);
  if (Number.isNaN(hour) || Number.isNaN(minutes)) return null;
  if (hour < 0 || hour > 23 || minutes < 0 || minutes > 59) return null;

  return hour * HOUR_MINUTES + minutes;
}

export function parseClockWithMeridiem(value: string) {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})\s*([ap]\.\s*m\.?|[ap]m)$/i);
  if (!match) return null;

  let hour = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = parseMeridiemToken(match[3]);

  if (Number.isNaN(hour) || Number.isNaN(minutes)) return null;
  if (hour < 1 || hour > 12 || minutes < 0 || minutes > 59) return null;

  if (meridiem === "pm" && hour < 12) {
    hour += 12;
  }

  if (meridiem === "am" && hour === 12) {
    hour = 0;
  }

  return hour * HOUR_MINUTES + minutes;
}

export function parseFlexibleTime(value: string) {
  return parseClockTime(value) ?? parseClockWithMeridiem(value);
}

export function formatClockTime(minutes: number) {
  const safeMinutes = Math.max(0, Math.min(23 * HOUR_MINUTES + 59, minutes));
  const hour = Math.floor(safeMinutes / HOUR_MINUTES);
  const minute = safeMinutes % HOUR_MINUTES;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function formatRangeLabel(start: number, end: number) {
  return `${formatClockTime(start)} - ${formatClockTime(end)}`;
}

export function parseSlotRange(value: string): TimeRange | null {
  const parts = value
    .split("-")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  if (parts.length !== 2) {
    return null;
  }

  const start = parseFlexibleTime(parts[0]);
  const end = parseFlexibleTime(parts[1]);
  if (start === null || end === null || end <= start) return null;

  return { start, end };
}

function mergeRanges(ranges: TimeRange[]) {
  if (ranges.length === 0) return [];

  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const merged: TimeRange[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i += 1) {
    const current = sorted[i];
    const last = merged[merged.length - 1];

    if (current.start <= last.end) {
      last.end = Math.max(last.end, current.end);
      continue;
    }

    merged.push({ ...current });
  }

  return merged;
}

export function normalizeAmenityWindows(slotLabels?: string[]) {
  const parsed = (slotLabels ?? [])
    .map((value) => parseSlotRange(value))
    .filter((value): value is TimeRange => value !== null);

  if (parsed.length === 0) {
    return [DEFAULT_AMENITY_WINDOW];
  }

  return mergeRanges(parsed);
}

export function isRangeAvailable(input: {
  candidate: TimeRange;
  existing: TimeRange[];
  maxConcurrent: number;
  stepMinutes?: number;
}) {
  const step = input.stepMinutes ?? SLOT_GRANULARITY_MINUTES;
  const maxConcurrent = Math.max(1, input.maxConcurrent);

  for (let minute = input.candidate.start; minute < input.candidate.end; minute += step) {
    let active = 0;

    for (const reservation of input.existing) {
      if (reservation.start < minute + step && reservation.end > minute) {
        active += 1;
      }

      if (active >= maxConcurrent) {
        return false;
      }
    }
  }

  return true;
}
