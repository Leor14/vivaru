export type DateTimeValidationType = "reservation" | "visitor";

const BUFFER_MINUTES: Record<DateTimeValidationType, number> = {
  reservation: 30,
  visitor: 15,
};

export function getNow() {
  return new Date();
}

export function getMinAllowedDateTime(type: DateTimeValidationType, now = getNow()) {
  const minDateTime = new Date(now);
  minDateTime.setMinutes(minDateTime.getMinutes() + BUFFER_MINUTES[type]);
  return minDateTime;
}

export function isDateTimeValid(selectedDateTime: Date, type: DateTimeValidationType, now = getNow()) {
  return selectedDateTime.getTime() >= getMinAllowedDateTime(type, now).getTime();
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
