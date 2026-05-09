type TimestampLike = { toDate?: () => Date; seconds?: number };

function isValidDate(value: Date) {
  return !Number.isNaN(value.getTime());
}

export function parseLocalDateString(value: string) {
  const normalized = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;

  const [yearRaw, monthRaw, dayRaw] = normalized.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  const parsed = new Date(year, month - 1, day, 12, 0, 0, 0);
  return isValidDate(parsed) ? parsed : null;
}

export function toLocalDate(input: unknown): Date | null {
  if (!input) return null;

  if (input instanceof Date) {
    return isValidDate(input) ? input : null;
  }

  if (typeof input === "string") {
    const localDate = parseLocalDateString(input);
    if (localDate) return localDate;

    const parsed = new Date(input);
    return isValidDate(parsed) ? parsed : null;
  }

  if (typeof input === "object") {
    const candidate = input as TimestampLike;
    if (typeof candidate.toDate === "function") {
      const parsed = candidate.toDate();
      return isValidDate(parsed) ? parsed : null;
    }

    if (typeof candidate.seconds === "number") {
      const parsed = new Date(candidate.seconds * 1000);
      return isValidDate(parsed) ? parsed : null;
    }
  }

  return null;
}

export function combineLocalDateTime(datePart: string, timePart?: string) {
  const date = parseLocalDateString(datePart);
  if (!date) return null;

  if (!timePart) return date;

  const normalizedTime = timePart.trim();
  if (!/^\d{2}:\d{2}/.test(normalizedTime)) return date;

  const [hoursRaw, minutesRaw] = normalizedTime.slice(0, 5).split(":");
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);
  date.setHours(hours, minutes, 0, 0);
  return isValidDate(date) ? date : null;
}

export function toDateKeyLocal(input: unknown) {
  const parsed = toLocalDate(input);
  if (!parsed) return "";

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatDateSafe(input: unknown, locale = "es-CO") {
  const parsed = toLocalDate(input);
  if (!parsed) return "-";

  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(parsed);
}

export function formatDateTimeSafe(input: unknown, locale = "es-CO") {
  const parsed = toLocalDate(input);
  if (!parsed) return "-";

  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(parsed);
}
