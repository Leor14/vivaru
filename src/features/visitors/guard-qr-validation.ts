import type { VisitorPass } from "@/types/domain";
import { combineLocalDateTime, toLocalDate } from "@/utils/date";

export type OperationalStatus = "scheduled" | "inside" | "completed" | "expired";
export type VisitorCardItem = VisitorPass & { operationalStatus: OperationalStatus };

export type ScanResultState =
  | { kind: "idle" }
  | { kind: "not-found"; code: string }
  | { kind: "found"; code: string; visitor: VisitorCardItem };

export function normalizeQrPayload(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";

  try {
    const parsedUrl = new URL(trimmed);
    const tokenFromParams =
      parsedUrl.searchParams.get("token") ||
      parsedUrl.searchParams.get("qr") ||
      parsedUrl.searchParams.get("code") ||
      parsedUrl.searchParams.get("qrToken");

    if (tokenFromParams) {
      return decodeURIComponent(tokenFromParams).trim();
    }
  } catch {
    // Not a URL payload, continue with raw value.
  }

  try {
    return decodeURIComponent(trimmed).trim();
  } catch {
    return trimmed;
  }
}

export function getVisitorSortTimestamp(item: Pick<VisitorPass, "date" | "scheduledTime">) {
  const datePart = item.date?.trim();
  const timePart = item.scheduledTime?.trim();

  if (datePart) {
    const localDateTime = combineLocalDateTime(datePart, timePart);
    if (localDateTime) return localDateTime.getTime();
  }

  if (datePart) {
    const parsed = toLocalDate(datePart);
    if (parsed) return parsed.getTime();
  }

  if (timePart) {
    const parsed = toLocalDate(timePart);
    if (parsed) return parsed.getTime();
  }

  return 0;
}

export function resolveVisitorFromQr(input: {
  rawCode: string;
  rows: VisitorCardItem[];
  tenantId?: string;
}): ScanResultState {
  const code = normalizeQrPayload(input.rawCode);

  if (!code) {
    return { kind: "idle" };
  }

  const matchedVisitor = input.rows.find((item) => {
    if (input.tenantId && item.tenantId !== input.tenantId) return false;
    return normalizeQrPayload(item.qrCodeValue || "") === code;
  });

  if (!matchedVisitor) {
    return { kind: "not-found", code };
  }

  return { kind: "found", code, visitor: matchedVisitor };
}
