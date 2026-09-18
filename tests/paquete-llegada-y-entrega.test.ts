import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  CONDICIONES_DE_LLEGADA,
  esCondicionDeLlegada,
  etiquetaDeCondicion,
  textoDeEntrega,
  textoDeLlegada,
} from "@/features/packages/llegada-del-paquete";

/**
 * `L-20` — «Debe incluir la fecha y condiciones en que se recibió el paquete, fecha y hora en que
 * se lo llevó el propietario. Que entidad lo deja también es importante» (pág. 8).
 */
describe("L-20 · la llegada del paquete", () => {
  it("la condición es vocabulario CERRADO: un texto libre no pasa", () => {
    expect(esCondicionDeLlegada("danado")).toBe(true);
    expect(esCondicionDeLlegada("roto")).toBe(false);
    expect(esCondicionDeLlegada("Dañado")).toBe(false);
    expect(esCondicionDeLlegada(undefined)).toBe(false);
  });

  it("las cuatro claves son distintas y todas tienen etiqueta en español", () => {
    const claves = CONDICIONES_DE_LLEGADA.map((c) => c.clave);
    expect(new Set(claves).size).toBe(claves.length);
    CONDICIONES_DE_LLEGADA.forEach((opcion) => {
      expect(opcion.etiqueta.trim().length).toBeGreaterThan(3);
      expect(etiquetaDeCondicion(opcion.clave)).toBe(opcion.etiqueta);
    });
  });

  it("los 223 paquetes anteriores no dicen nada: devuelve null, no una etiqueta inventada", () => {
    expect(textoDeLlegada({})).toBeNull();
    expect(etiquetaDeCondicion(undefined)).toBeNull();
    expect(textoDeLlegada({ carrier: "   ", condition: "" })).toBeNull();
  });

  it("junta empresa y estado, y aguanta que falte uno de los dos", () => {
    expect(textoDeLlegada({ carrier: "Servientrega", condition: "danado" })).toBe("Servientrega · Dañado");
    expect(textoDeLlegada({ carrier: " Rappi ", condition: undefined })).toBe("Rappi");
    expect(textoDeLlegada({ condition: "mojado" })).toBe("Mojado");
  });

  it("la entrega —que ya se guardaba y no se veía— dice fecha y a quién", () => {
    expect(textoDeEntrega({ fecha: "12/09/2026 14:03", quien: "María Gómez" })).toBe(
      "12/09/2026 14:03 · a María Gómez",
    );
    expect(textoDeEntrega({ fecha: "12/09/2026 14:03" })).toBe("12/09/2026 14:03");
    expect(textoDeEntrega({ quien: "María Gómez" })).toBe("a María Gómez");
    expect(textoDeEntrega({})).toBeNull();
    expect(textoDeEntrega({ fecha: null, quien: 42 })).toBeNull();
  });
});

/**
 * **El guardián: el campo tiene que llegar a la pantalla.** Se escribe porque el 17 de septiembre
 * de 2026 `checkInBy`/`checkOutBy` se escribieron bien y **no llegaban al detalle** — el
 * normalizador de la lectura los tiraba en silencio. Aquí el camino son tres sitios: lo escribe
 * `createGuardPackage`, lo pide el formulario de portería y lo pinta la tabla del administrador.
 */
describe("L-20 · los tres sitios del camino", () => {
  const raw = (ruta: string) => readFileSync(ruta, "utf-8");

  it("`createGuardPackage` escribe empresa y estado", () => {
    const fuente = raw("src/features/packages/use-packages.ts");
    expect(fuente).toContain("input.carrier");
    expect(fuente).toContain("input.condition");
  });

  it("el formulario de portería los pide, y el estado es obligatorio", () => {
    const fuente = raw("src/components/securityGuard/GuardPackageRegister.tsx");
    expect(fuente).toContain("CONDICIONES_DE_LLEGADA");
    expect(fuente).toContain("description.trim() && condition");
  });

  it("la tabla del administrador pinta la llegada y la entrega", () => {
    const fuente = raw("src/app/(admin)/admin/packages/page.tsx");
    expect(fuente).toContain("textoDeLlegada(item)");
    expect(fuente).toContain("textoDeEntrega({");
    // La columna nueva mueve el ancho de la tabla: un `colSpan` viejo descuadra los estados vacíos.
    expect(fuente).not.toContain("colSpan={6}");
    expect(fuente).toContain("colSpan={7}");
  });
});
