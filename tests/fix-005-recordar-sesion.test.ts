import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * `PRD-V-FIX-005` · H4 / R6 / `CA5` — «Recordar sesión» hace lo que dice.
 *
 * La casilla estaba en el formulario, marcada por defecto, y no llegaba a ningún sitio: la
 * persistencia era siempre local. Desmarcada, la sesión tiene que morir al cerrar el navegador.
 *
 * Esto fija el CABLEADO —el formulario pasa la casilla y `login()` fija la persistencia antes de
 * entrar—. Que la sesión muera de verdad al cerrar el navegador se mira en staging con los ojos
 * (§13): ninguna prueba de aquí cierra un navegador.
 */

const RAIZ = process.cwd();
const leer = (ruta: string) => fs.readFileSync(path.join(RAIZ, ruta), "utf8");
const sinComentarios = (fuente: string) =>
  fuente.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("FIX-005 · CA5 · «Recordar sesión» llega a login()", () => {
  it("el formulario le pasa la casilla a login()", () => {
    expect(sinComentarios(leer("src/components/features/auth/login-form.tsx"))).toContain(
      "login(values.email, values.password, values.remember)",
    );
  });

  it("login() fija la persistencia ANTES de entrar, y de sesión si no se recuerda", () => {
    const contexto = sinComentarios(leer("src/features/auth/auth-context.tsx"));
    const inicio = contexto.indexOf("const login = useCallback(");
    expect(inicio).toBeGreaterThan(-1);
    const cuerpo = contexto.slice(inicio);
    const persistencia = cuerpo.indexOf("setPersistence(");
    const entrada = cuerpo.indexOf("signInWithEmailAndPassword(");
    expect(persistencia).toBeGreaterThan(-1);
    expect(entrada).toBeGreaterThan(persistencia);
    expect(cuerpo.slice(persistencia, entrada)).toContain("browserSessionPersistence");
  });
});
