import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Las cifras del producto son de ancho fijo.
 *
 * Manrope trae cifras proporcionales —medido: seis unos ocupan 37,45px y seis
 * ceros 58,56—, asi que una columna de pesos no alinea. Se corrige por herencia
 * desde `body`, porque los importes se pintan en 117 sitios y no pasan por
 * ningun componente comun.
 *
 * Lo delicado no es ponerlo: es que NO se herede dentro del SVG. Los ejes de
 * Recharts son `<text>` calculados a pixel fijo y el Reporte de Comite imprime
 * este mismo DOM, asi que ensancharles los digitos desalinearia el PDF.
 */
const CSS = readFileSync("src/app/globals.css", "utf8");

/** Sin comentarios: la prosa de este bloque nombra las reglas que vigila. */
const CODIGO = CSS.replace(/\/\*[\s\S]*?\*\//g, "");

function posicionDe(regla: RegExp): number {
  const i = CODIGO.search(regla);
  expect(i, `no se encontro la regla ${regla}`).toBeGreaterThan(-1);
  return i;
}

describe("las cifras de ancho fijo", () => {
  it("el producto las pide desde `body`", () => {
    expect(CODIGO).toMatch(/(^|\n)body\s*\{[^}]*font-variant-numeric:\s*tabular-nums/);
  });

  it("el SVG las anula, o los ejes de los graficos se moverian", () => {
    expect(CODIGO).toMatch(/svg[^{]*\{[^}]*font-variant-numeric:\s*normal/);
  });

  /**
   * `svg` a secas es (0,0,1), lo mismo que `body`: sin `svg text` —que es
   * (0,0,2)— la proteccion dependeria SOLO del orden, y una reordenacion del
   * fichero la desharia sin que nada fallara.
   */
  it("la proteccion no depende solo del orden: incluye `svg text`", () => {
    const bloque = CODIGO.match(/svg[^{]*\{[^}]*font-variant-numeric:\s*normal[^}]*\}/)?.[0] ?? "";
    expect(bloque, "sin `svg text` la proteccion es fragil").toContain("svg text");
  });

  it("y ademas va DESPUES de la regla que anula", () => {
    expect(posicionDe(/(^|\n)svg[,\s]/)).toBeGreaterThan(posicionDe(/(^|\n)body\s*\{[^}]*font-variant-numeric/));
  });

  it("el landing queda fuera, como en la escala de radios", () => {
    expect(CODIGO).toMatch(/\.marketing-theme[^{]*\{[^}]*font-variant-numeric:\s*normal/);
  });
});
