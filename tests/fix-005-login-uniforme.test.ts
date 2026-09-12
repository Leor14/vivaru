import fs from "node:fs";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

// vi.mock is hoisted — applied before any import resolves
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

import { normalizeFirebaseError } from "@/lib/utils/error-handler";

/**
 * `PRD-V-FIX-005` · H4 / R5 / `CF7` — el login da UN SOLO mensaje para credenciales
 * inválidas, con o sin la protección de enumeración de Firebase.
 *
 * Hoy esa protección está encendida y Firebase responde `auth/invalid-credential` exista o
 * no la cuenta. Pero el producto conservaba «No existe una cuenta con ese correo.» para
 * `auth/user-not-found` en DOS mapas —`normalizeLoginError` y `normalizeFirebaseError`—: el
 * día que alguien la apagara, el login volvería a delatar quién tiene cuenta.
 *
 * El guardián recorre los tres árboles que llegan al navegador **sin comentarios**, para que
 * explicar la regla no la rompa.
 */

const RAIZ = process.cwd();
const FRASE = "No existe una cuenta con ese correo";

function ficheros(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const ruta = path.join(dir, e.name);
    if (e.isDirectory()) return ficheros(ruta);
    return /\.(ts|tsx|js|jsx|mjs)$/.test(e.name) ? [ruta] : [];
  });
}

const sinComentarios = (fuente: string) =>
  fuente.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("FIX-005 · CF7 · correo inexistente y clave incorrecta dicen lo mismo", () => {
  it("en el mapa de los toasts", () => {
    const inexistente = normalizeFirebaseError({ code: "auth/user-not-found" });
    expect(inexistente).toBe(normalizeFirebaseError({ code: "auth/wrong-password" }));
    expect(inexistente).toBe(normalizeFirebaseError({ code: "auth/invalid-credential" }));
    expect(inexistente).toBe("Correo o contraseña incorrectos.");
  });

  it("y la frase que delata no está en ningún fichero del front", () => {
    const todos = ["src", "components", "features"].flatMap((a) => ficheros(path.join(RAIZ, a)));
    // El control: un guardián que recorre cero ficheros pasa siempre.
    expect(todos.length).toBeGreaterThan(200);
    const conFrase = todos
      .filter((f) => sinComentarios(fs.readFileSync(f, "utf8")).includes(FRASE))
      .map((f) => path.relative(RAIZ, f));
    expect(conFrase).toEqual([]);
  });
});
