export type TicketSlaLevel = "green" | "yellow" | "red";

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isBusinessDay(date: Date) {
  const day = date.getDay();
  return day !== 0 && day !== 6;
}

export function parseTicketDate(value?: string) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export function addBusinessDays(startDate: Date, businessDays: number) {
  let remaining = Math.max(0, businessDays);
  const cursor = startOfDay(startDate);

  while (remaining > 0) {
    cursor.setDate(cursor.getDate() + 1);
    if (isBusinessDay(cursor)) {
      remaining -= 1;
    }
  }

  return startOfDay(cursor);
}

export function businessDaysUntil(fromDate: Date, dueDate: Date) {
  const from = startOfDay(fromDate);
  const due = startOfDay(dueDate);

  if (from.getTime() === due.getTime()) return 0;
  if (from.getTime() > due.getTime()) return -1;

  let count = 0;
  const cursor = new Date(from);

  while (cursor.getTime() < due.getTime()) {
    cursor.setDate(cursor.getDate() + 1);
    if (isBusinessDay(cursor)) {
      count += 1;
    }
  }

  return count;
}

export function getTicketSla(input: { radicationDate?: string; status?: string; responseDate?: string }) {
  const status = (input.status || "").toLowerCase();
  const isClosed = ["resolved", "responded", "closed"].includes(status);

  const radication = parseTicketDate(input.radicationDate);
  if (!radication) {
    return {
      dueDate: null,
      businessDaysRemaining: null,
      level: "green" as TicketSlaLevel,
      isClosed,
    };
  }

  const dueDate = addBusinessDays(radication, 15);
  const referenceDate = parseTicketDate(input.responseDate) || new Date();
  const remaining = businessDaysUntil(referenceDate, dueDate);

  let level: TicketSlaLevel = "green";
  if (remaining <= 0) {
    level = "red";
  } else if (remaining <= 5) {
    level = "yellow";
  }

  return {
    dueDate,
    businessDaysRemaining: remaining,
    level,
    isClosed,
  };
}

export function formatTicketDate(value?: string | Date | null) {
  if (!value) return "-";
  const parsed = value instanceof Date ? value : parseTicketDate(value);
  if (!parsed) return "-";

  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(parsed);
}
