import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * `PRD-V-FIX-005` · H1 / R1 — la pantalla del alta de prueba es la MISMA exista o no la cuenta.
 *
 * El servidor ya responde igual en los dos casos. Si la pantalla dijera «Creamos el ambiente…»,
 * mentiría al que ya tenía cuenta —a él no se le crea nada: le llega un correo— y, sobre todo,
 * obligaría a distinguir los dos casos para no mentir, que es justo lo que no se puede hacer.
 */

const pagina = fs
  .readFileSync(path.join(process.cwd(), "src/app/(auth)/registro/page.tsx"), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "");

describe("FIX-005 · la pantalla de «Revisa tu correo» vale para los dos casos", () => {
  it("no afirma que se creó un ambiente", () => {
    expect(pagina).not.toContain("Creamos el ambiente");
  });

  it("sigue diciendo que revise su correo", () => {
    expect(pagina).toContain("Revisa tu correo");
  });
});
