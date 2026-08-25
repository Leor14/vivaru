import type { SessionUser, TenantMembership } from "@/types/domain";
import { encodeSessionCookie, SESSION_COOKIE_KEY } from "@/lib/auth/session-cookie";

const SESSION_KEY = "hogaru.session.user";

export function saveSession(user: SessionUser) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  // La cookie lleva el conjunto ACTIVO, no la lista: la lee el middleware, que
  // solo enruta por rol. Aun así se reescribe al cambiar de conjunto para que
  // no quede diciendo uno que ya no es el de la pantalla.
  const payload = encodeSessionCookie({
    uid: user.uid,
    role: user.role,
    tenantId: user.tenantId,
    mustChangePassword: user.mustChangePassword,
  });
  document.cookie = `${SESSION_COOKIE_KEY}=${payload}; path=/; SameSite=Lax`;
}

export function clearSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SESSION_KEY);
  document.cookie = `${SESSION_COOKIE_KEY}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
}

export function loadSession(): SessionUser | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(SESSION_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const status = parsed.status;

    return {
      uid: String(parsed.uid ?? ""),
      email: String(parsed.email ?? ""),
      fullName: String(parsed.fullName ?? "Usuario HOGARU"),
      photoURL: typeof parsed.photoURL === "string" ? parsed.photoURL : undefined,
      avatarId: typeof parsed.avatarId === "string" ? parsed.avatarId : undefined,
      role: parsed.role as SessionUser["role"],
      tenantId: typeof parsed.tenantId === "string" ? parsed.tenantId : undefined,
      tenantName: typeof parsed.tenantName === "string" ? parsed.tenantName : undefined,
      memberships: Array.isArray(parsed.memberships)
        ? (parsed.memberships as unknown[])
            .filter((m): m is Record<string, unknown> => typeof m === "object" && m !== null)
            .filter((m) => typeof m.tenantId === "string")
            .map((m) => ({
              tenantId: m.tenantId as string,
              tenantName: typeof m.tenantName === "string" ? m.tenantName : undefined,
              status: typeof m.status === "string" ? (m.status as TenantMembership["status"]) : undefined,
            }))
        : undefined,
      unitId: typeof parsed.unitId === "string" ? parsed.unitId : undefined,
      unitLabel: typeof parsed.unitLabel === "string" ? parsed.unitLabel : undefined,
      documentNumber: typeof parsed.documentNumber === "string" ? parsed.documentNumber : undefined,
      mustChangePassword: parsed.mustChangePassword === true,
      temporaryPassword: parsed.temporaryPassword === true,
      passwordStatus: parsed.passwordStatus === "temporary" ? "temporary" : "updated",
      status: status === "inactive" || status === "disabled" ? "inactive" : "active",
    } as SessionUser;
  } catch {
    return null;
  }
}
