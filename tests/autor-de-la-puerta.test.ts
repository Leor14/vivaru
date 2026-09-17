import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { autorDeLaPuerta } from "@/features/visitors/autor-de-la-puerta";

/**
 * **`L-29` — quién registró cada entrada y salida.** Lote «Análisis de la plataforma», T4.3.
 * La regla que lo hace fiable se prueba en `tests/autor-de-la-puerta.rules.test.ts`; aquí van el
 * texto que lee la administración y los guardianes de que las dos escrituras lo mandan.
 */

const leer = (p: string) => fs.readFileSync(path.resolve(p), "utf8");
const codigo = (p: string) =>
  leer(p)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

describe("L-29 · el texto que lee la administración", () => {
  const nombres = new Map([["guard-1", "Carlos Ramírez"]]);

  it("con nombre, dice quién fue", () => {
    expect(autorDeLaPuerta("guard-1", nombres)).toBe("Registró Carlos Ramírez");
  });

  it("con uid desconocido dice que fue la portería, y nunca el uid", () => {
    const texto = autorDeLaPuerta("guard-borrado", nombres);
    expect(texto).toBe("Registró la portería");
    expect(texto).not.toContain("guard-borrado");
  });

  it("sin uid no dice nada: son los 309 ingresos anteriores al arreglo", () => {
    expect(autorDeLaPuerta(undefined, nombres)).toBeNull();
    expect(autorDeLaPuerta("", nombres)).toBeNull();
    expect(autorDeLaPuerta("   ", nombres)).toBeNull();
  });
});

describe("L-29 · guardián: las dos escrituras mandan el autor", () => {
  const ESCRITURAS = "src/features/visitors/use-visitor-passes.ts";

  it("el ingreso escribe `checkInBy` con el uid recibido, y lo exige", () => {
    const c = codigo(ESCRITURAS);
    expect(c).toMatch(/status: "inside",[\s\S]{0,120}checkInBy: input\.guardiaUid/);
    expect(c).toMatch(/if \(!input\.guardiaUid\) throw new Error\("Falta la sesion de porteria para registrar el ingreso/);
  });

  it("la salida escribe `checkOutBy` igual, tanto si cierra como si vuelve a programado", () => {
    const c = codigo(ESCRITURAS);
    expect(c).toMatch(/status: nextStatus,[\s\S]{0,120}checkOutBy: input\.guardiaUid/);
    expect(c).toMatch(/if \(!input\.guardiaUid\) throw new Error\("Falta la sesion de porteria para registrar la salida/);
  });

  it("la portería pasa su propia sesión en las dos llamadas", () => {
    const c = codigo("src/components/securityGuard/GuardVisitors.tsx");
    expect(c.match(/guardiaUid: guardId \?\? ""/g) ?? []).toHaveLength(2);
  });

  it("y la administración lo enseña en el detalle del pase", () => {
    const c = codigo("src/app/(admin)/admin/visitors/page.tsx");
    expect(c).toMatch(/autorDeLaPuerta\(selectedPass\.checkInBy, nombrePorUid\)/);
    expect(c).toMatch(/autorDeLaPuerta\(selectedPass\.checkOutBy, nombrePorUid\)/);
  });
});

describe("L-29 · la regla exige que el autor sea quien firma", () => {
  it("las tres transiciones de portería comparan el autor con `request.auth.uid`", () => {
    const reglas = leer("firestore.rules");
    const bloque = reglas.slice(reglas.indexOf("match /visitorPasses/{docId}"));
    const guardia = bloque.slice(0, bloque.indexOf("allow delete"));
    expect(guardia).toContain('request.resource.data.checkInBy == request.auth.uid');
    expect(guardia.match(/request\.resource\.data\.checkOutBy == request\.auth\.uid/g) ?? []).toHaveLength(2);
  });
});
