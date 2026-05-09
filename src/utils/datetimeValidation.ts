export type DateTimeValidationType = "reservation" | "visitor";

const BUFFER_MINUTES: Record<DateTimeValidationType, number> = {
  reservation: 30,
  visitor: 15,
};

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function getNow() {
  return new Date();
}

export function isPastDate(date: Date, now = getNow()) {
  return startOfDay(date).getTime() < startOfDay(now).getTime();
}

export function isSameDay(date1: Date, date2: Date) {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

export function getMinAllowedDateTime(type: DateTimeValidationType, now = getNow()) {
  const minDateTime = new Date(now);
  minDateTime.setMinutes(minDateTime.getMinutes() + BUFFER_MINUTES[type]);
  return minDateTime;
}

export function isDateTimeValid(selectedDateTime: Date, type: DateTimeValidationType, now = getNow()) {
  return selectedDateTime.getTime() >= getMinAllowedDateTime(type, now).getTime();
}

export function getBufferMinutes(type: DateTimeValidationType) {
  return BUFFER_MINUTES[type];
}

export function combineDateAndTime(dateValue: string, timeValue: string) {
  const normalizedDate = dateValue?.trim();
  const normalizedTime = timeValue?.trim();

  if (!normalizedDate || !normalizedTime) {
    return null;
  }

  if (normalizedTime.includes("T")) {
    const parsedDateTime = new Date(normalizedTime);
    if (!Number.isNaN(parsedDateTime.getTime())) {
      return parsedDateTime;
    }
  }

  const hhmm = normalizedTime.length >= 5 ? normalizedTime.slice(0, 5) : normalizedTime;
  const parsedDateTime = new Date(`${normalizedDate}T${hhmm}:00`);
  if (Number.isNaN(parsedDateTime.getTime())) {
    return null;
  }

  return parsedDateTime;
}

export function toDateInputValue(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function toTimeInputValue(date: Date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
