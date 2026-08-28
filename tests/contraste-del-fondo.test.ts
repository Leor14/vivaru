import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * El fondo de pagina no puede tragarse el texto que va encima.
 *
 * Al profundizar el fondo para que las tarjetas se despeguen, `--slate-500`
 * —que es el gris del texto secundario y se usa 526 veces— cayo a 4,27:1, por
 * debajo del minimo AA. La medicion paro el cambio, y la solucion no fue aclarar
 * el fondo sino oscurecer el gris: ya iba al limite (4,60) ANTES de tocar nada.
 *
 * Esta prueba calcula el contraste de verdad, asi que cualquiera de los dos
 * valores que alguien mueva la enrojece con el numero delante.
 */
const CSS = readFileSync("src/app/globals.css", "utf8");

function token(nombre: string): string {
  const m = CSS.match(new RegExp(`--${nombre}:\\s*(#[0-9a-fA-F]{6})`));
  expect(m, `falta el token --${nombre}`).not.toBeNull();
  return m![1];
}

function luminancia(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const l = c.map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2];
}

function contraste(a: string, b: string): number {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

const AA = 4.5;

describe("el contraste sobre el fondo de pagina", () => {
  const fondo = token("background");

  /** El gris mas claro que se usa para texto. Si pasa este, pasan los demas. */
  it("el texto secundario cumple AA sobre el fondo", () => {
    const r = contraste(token("slate-500"), fondo);
    expect(r, `slate-500 sobre el fondo da ${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA);
  });

  it("y tambien sobre una tarjeta blanca", () => {
    const r = contraste(token("slate-500"), "#ffffff");
    expect(r, `slate-500 sobre blanco da ${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA);
  });

  it("los grises mas oscuros, obviamente tambien", () => {
    for (const paso of ["slate-600", "slate-700", "slate-900"]) {
      const r = contraste(token(paso), fondo);
      expect(r, `${paso} sobre el fondo da ${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA);
    }
  });

  /**
   * La razon de ser del cambio: si el fondo vuelve a acercarse al blanco, la
   * sombra que las tarjetas YA tenian deja de leerse y volvemos al aspecto plano
   * sin que nada falle.
   */
  it("y la tarjeta se despega del fondo lo suficiente", () => {
    const sep = contraste("#ffffff", fondo);
    expect(sep, `la separacion tarjeta/fondo es ${sep.toFixed(3)}`).toBeGreaterThanOrEqual(1.12);
  });
});
