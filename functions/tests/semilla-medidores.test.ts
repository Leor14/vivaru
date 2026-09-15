import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { digitosDelTotalizador, esferaDeMedidor } from "../scripts/historias/ilustraciones.mjs";

/**
 * D2 del plan de documentos: la foto de cada lectura del medidor, una esfera con el totalizador en
 * m³ en vez de la tarjeta de texto que dejó la historia. El residente la abre a tamaño completo
 * desde «Tus consumos medidos»: es lo que hace defendible un cargo por consumo.
 */

describe("las fotos de medidor (D2)", () => {
  it("el totalizador lleva cinco tambores de m³ y uno rojo para la décima", () => {
    expect(digitosDelTotalizador(583)).toEqual(["0", "0", "5", "8", "3", "0"]);
    expect(digitosDelTotalizador(12)).toEqual(["0", "0", "0", "1", "2", "0"]);
  });

  it("la décima sale bien aunque la coma flotante diga 0.3999…", () => {
    expect(digitosDelTotalizador(583.4)).toEqual(["0", "0", "5", "8", "3", "4"]);
    expect(digitosDelTotalizador(0.9)).toEqual(["0", "0", "0", "0", "0", "9"]);
  });

  it("pasado de 99999 da la vuelta, como un contador real", () => {
    expect(digitosDelTotalizador(100583).slice(0, 5)).toEqual(["0", "0", "5", "8", "3"]);
  });

  it("es un JPEG cuadrado y ligero, y siempre el mismo para la misma lectura", async () => {
    const datos = { casa: "Encinos 03", periodo: "2026-08", lectura: 583, tomada: "2026-08-31 09:08" };
    const a = await esferaDeMedidor(datos);
    const b = await esferaDeMedidor(datos);
    const meta = await sharp(a).metadata();
    expect(meta.format).toBe("jpeg");
    expect([meta.width, meta.height]).toEqual([900, 900]);
    expect(a.length).toBeLessThan(5 * 1024 * 1024);
    expect(a.equals(b)).toBe(true);
  });

  it("dos lecturas distintas dan dos fotos distintas", async () => {
    const base = { casa: "Encinos 03", periodo: "2026-08", tomada: "2026-08-31 09:08" };
    const a = await esferaDeMedidor({ ...base, lectura: 583 });
    const b = await esferaDeMedidor({ ...base, lectura: 584 });
    expect(a.equals(b)).toBe(false);
  });
});
