import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * La escala de radios: tres valores y el circulo.
 *
 * El producto tenia los seis que Tailwind trae por defecto (4·6·8·12·16·24)
 * repartidos sin regla entre 1.106 esquinas. Se unificaron cambiando los TOKENS,
 * no las clases.
 *
 * Dos cosas que hay que impedir, y ninguna la ve el typecheck:
 *  1. que la escala vuelva a dispersarse añadiendo valores sueltos;
 *  2. que el landing quede colgando de ella. Tiene su propio lenguaje visual y
 *     comparte los mismos tokens, asi que sin fijarlos aparte cualquier cambio
 *     del producto le mueve 74 esquinas de rebote.
 */
const CSS = readFileSync("src/app/globals.css", "utf8");

/** El bloque que emite variables. El `@theme inline` emite literales y no sirve. */
function bloque(inicio: RegExp): string {
  const i = CSS.search(inicio);
  expect(i, "no se encontro el bloque").toBeGreaterThan(-1);
  const desde = CSS.indexOf("{", i);
  let nivel = 0;
  for (let j = desde; j < CSS.length; j++) {
    if (CSS[j] === "{") nivel++;
    else if (CSS[j] === "}" && --nivel === 0) return CSS.slice(desde + 1, j);
  }
  throw new Error("bloque sin cerrar");
}

/** Sin comentarios: la prosa de esta escala nombra los valores que veta. */
function soloCodigo(fuente: string): string {
  return fuente.replace(/\/\*[\s\S]*?\*\//g, "");
}

function radios(fuente: string): Record<string, string> {
  const salida: Record<string, string> = {};
  for (const m of soloCodigo(fuente).matchAll(/--radius-([a-z0-9]+):\s*([^;]+);/g)) {
    salida[m[1]] = m[2].trim();
  }
  return salida;
}

const PRODUCTO = radios(bloque(/^@theme \{/m));
const LANDING = radios(bloque(/^\.marketing-theme \{/m));

describe("la escala de radios", () => {
  it("tiene TRES valores distintos, no seis", () => {
    const distintos = [...new Set(Object.values(PRODUCTO))];
    expect(distintos.sort(), `la escala se disperso: ${JSON.stringify(PRODUCTO)}`).toHaveLength(3);
  });

  it("no toca el circulo: `full` se queda como esta", () => {
    expect(PRODUCTO).not.toHaveProperty("full");
  });

  it("el landing fija TODOS los tokens que define el producto", () => {
    const colgando = Object.keys(PRODUCTO).filter((k) => !(k in LANDING));
    expect(
      colgando,
      `estos tokens del producto le moverian el landing de rebote: ${colgando.join(", ")}`,
    ).toEqual([]);
  });

  it("y los fija a OTRO valor: si coincidieran, no estaria fuera de la escala", () => {
    const iguales = Object.keys(PRODUCTO).filter((k) => LANDING[k] === PRODUCTO[k]);
    expect(iguales, `estos no distinguen landing de producto: ${iguales.join(", ")}`).toEqual([]);
  });

  it("el guardian mira el bloque bueno: el que emite variables, no el `inline`", () => {
    expect(Object.keys(PRODUCTO).length).toBeGreaterThanOrEqual(6);
    expect(radios(bloque(/^@theme inline \{/m))).not.toHaveProperty("xl");
  });
});
