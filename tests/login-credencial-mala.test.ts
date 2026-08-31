/**
 * El fallo de login llega a la pantalla con su mensaje, no con el genérico.
 *
 * **El defecto, verificado en producción el 31 de agosto de 2026.** `login()`
 * normalizaba bien («Correo o contraseña incorrectos.», «Perfil no encontrado
 * en users/{uid}…») y lanzaba un `Error` PLANO; el catch del formulario lo
 * pasaba por `toastFirebaseError`, que sin `code` ni marca `CallableError`
 * caía al genérico «Ocurrió un error inesperado. Intenta de nuevo.» — TODO
 * fallo de login, contraseña mala incluida, salía con ese banner. Es la misma
 * clase de defecto que `CallableError` cerró para las callables el 24 de
 * agosto: el mensaje se compone bien y se tira después.
 *
 * La cadena tiene tres eslabones y aquí se fijan los tres: (1) lo que lanza
 * `login()` es un `CallableError`, (2) su mensaje lleva la ortografía que ve
 * el usuario, y (3) `toastFirebaseError` lo respeta en vez de tirarlo.
 */

import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

// vi.mock is hoisted — applied before any import resolves
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

import { toast } from "sonner";
import { CallableError, toastFirebaseError } from "@/lib/utils/error-handler";

const ROOT = path.resolve(__dirname, "..");
const authContext = fs.readFileSync(path.join(ROOT, "src/features/auth/auth-context.tsx"), "utf8");
const loginForm = fs.readFileSync(path.join(ROOT, "src/components/features/auth/login-form.tsx"), "utf8");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("una credencial mala pinta su mensaje", () => {
  it("el toast enseña «Correo o contraseña incorrectos.» tal cual lo lanza login()", () => {
    // Exactamente lo que hace el catch del formulario con lo que login() lanza.
    toastFirebaseError(new CallableError("Correo o contraseña incorrectos."));
    expect(toast.error).toHaveBeenCalledWith("Correo o contraseña incorrectos.");
  });

  it("el gemelo que motivó el arreglo: el mismo mensaje en un Error plano se tira", () => {
    // Si login() volviera a lanzar `Error`, esto es lo que vería el usuario.
    toastFirebaseError(new Error("Correo o contraseña incorrectos."));
    expect(toast.error).toHaveBeenCalledWith("Ocurrió un error inesperado. Intenta de nuevo.");
  });
});

describe("el cableado que sostiene la cadena", () => {
  it("login() lanza CallableError, no un Error plano", () => {
    expect(authContext).toContain("throw new CallableError(message)");
    expect(authContext).not.toContain("throw new Error(message)");
  });

  it("normalizeLoginError escribe la contraseña con eñe", () => {
    expect(authContext).toContain('"Correo o contraseña incorrectos."');
    expect(authContext).not.toContain("contrasena incorrectos");
  });

  it("el catch del formulario pinta por toastFirebaseError", () => {
    expect(loginForm).toContain("toastFirebaseError(error)");
  });
});
