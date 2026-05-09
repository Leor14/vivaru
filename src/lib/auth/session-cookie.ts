import type { AppRole } from "@/lib/constants/roles";

export const SESSION_COOKIE_KEY = "hogaru_session";

export interface SessionCookiePayload {
  uid: string;
  role: AppRole;
  tenantId?: string;
  mustChangePassword?: boolean;
}

export function encodeSessionCookie(payload: SessionCookiePayload) {
  return encodeURIComponent(JSON.stringify(payload));
}

export function decodeSessionCookie(raw: string | undefined): SessionCookiePayload | null {
  if (!raw) return null;

  try {
    const decoded = decodeURIComponent(raw);
    return JSON.parse(decoded) as SessionCookiePayload;
  } catch {
    return null;
  }
}
