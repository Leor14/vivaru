import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { terminoCoeficiente, terminoCuotaMensual, terminoPazYSalvo } from "../src/vocabulario-pais";

/**
 * El vocabulario vive DUPLICADO a propósito (src/ no puede importar de
 * functions/), y hasta el 30 ago 2026 nada comprobaba que los dos lados
 * dijeran lo mismo — el mismo hueco que tuvo el catálogo de avisos. Se
 * compara como texto, igual que notification-catalog-espejo: el fichero del
 * front se lee crudo y cada término del servidor tiene que aparecer en él.
 */

const FRONT = readFileSync(
  join(__dirname, "..", "..", "src", "lib", "config", "vocabulario-pais.ts"),
  "utf8",
);

describe("espejo del vocabulario: lo que dice el servidor está escrito en el front", () => {
  it("el documento de no deuda, en los tres países y el neutro", () => {
    for (const pais of ["CO", "EC", "MX", undefined]) {
      const t = terminoPazYSalvo(pais);
      expect(FRONT).toContain(`"${t.nombre}"`);
      expect(t.nombre.length).toBeGreaterThan(3); // la recolección encontró algo
    }
  });

  it("el género mexicano es femenino en los dos lados", () => {
    expect(terminoPazYSalvo("MX").articulo).toBe("la");
    expect(FRONT).toContain('pazYSalvoArticulo: "la"');
  });

  it("coeficiente y cuota mensual — el hueco viejo, cubierto de paso", () => {
    for (const pais of ["CO", "EC", "MX"]) {
      expect(FRONT).toContain(`"${terminoCoeficiente(pais)}"`);
      expect(FRONT).toContain(`"${terminoCuotaMensual(pais)}"`);
    }
  });
});
