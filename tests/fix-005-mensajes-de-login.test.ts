import { describe, expect, it, vi } from "vitest";

// vi.mock is hoisted — applied before any import resolves
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

import {
  MENSAJE_CREDENCIALES,
  MENSAJE_CUENTA_DESACTIVADA,
  MENSAJE_DEMASIADOS_INTENTOS,
  MENSAJE_LOGIN_GENERICO,
  mensajeDeLogin,
} from "@/lib/auth/mensajes-de-login";
import { normalizeFirebaseError } from "@/lib/utils/error-handler";

/**
 * `PRD-V-FIX-005` · H4 / R5 — los mensajes de un login fallido, en un solo sitio y sin
 * mensajes crudos de Firebase.
 */
describe("FIX-005 · el mensaje de un login fallido", () => {
  it("CF7 · correo inexistente, clave incorrecta y credencial inválida dicen lo mismo", () => {
    for (const codigo of [
      "auth/user-not-found",
      "auth/wrong-password",
      "auth/invalid-credential",
      "auth/invalid-login-credentials",
    ]) {
      expect(mensajeDeLogin(codigo)).toBe(MENSAJE_CREDENCIALES);
    }
  });

  it("la cuenta desactivada y los demasiados intentos tienen el suyo", () => {
    expect(mensajeDeLogin("auth/user-disabled")).toBe(MENSAJE_CUENTA_DESACTIVADA);
    expect(mensajeDeLogin("auth/too-many-requests")).toBe(MENSAJE_DEMASIADOS_INTENTOS);
  });

  it("un código de Auth que no conoce da el genérico en español, nunca el crudo", () => {
    expect(mensajeDeLogin("auth/internal-error")).toBe(MENSAJE_LOGIN_GENERICO);
    expect(mensajeDeLogin("auth/operation-not-allowed")).toBe(MENSAJE_LOGIN_GENERICO);
  });

  it("acepta el código con o sin el prefijo auth/", () => {
    expect(mensajeDeLogin("user-not-found")).toBe(MENSAJE_CREDENCIALES);
  });

  // Los dos mapas —el del login y el de los toasts— tienen que decir lo mismo para cada código
  // de Auth. Así divergieron: se arregló uno y el otro no.
  it("el mapa de los toasts dice lo mismo que el del login para cada código de Auth", () => {
    for (const codigo of [
      "invalid-credential",
      "invalid-login-credentials",
      "wrong-password",
      "user-not-found",
      "user-disabled",
      "too-many-requests",
      "invalid-email",
      "network-request-failed",
    ]) {
      expect(normalizeFirebaseError({ code: `auth/${codigo}` })).toBe(mensajeDeLogin(codigo));
    }
  });
});
