import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * El nombre del sitio va en la fuente de marca.
 *
 * `text-display` se usa tres veces en el producto y las tres son nombres: el de
 * la pantalla en la cabecera del admin, el de la pantalla en los otros portales
 * y el del conjunto en el tablero. Los del admin pasan por la puerta que abrio
 * la pasada 0; el de los otros portales queda para su propia pasada, porque el
 * residente es movil-primero y una serifa a 16px en una barra estrecha no es la
 * misma decision.
 *
 * Esto falla EN SILENCIO de dos maneras, y las dos van vigiladas aqui:
 *  1. pedir un peso que la fuente no carga — el navegador lo finge y nadie lo ve;
 *  2. que la regla de peso se salga de `.admin-shell` y arrastre el landing, que
 *     usa `font-display` para lo suyo.
 */
const CSS = readFileSync("src/app/globals.css", "utf8");
const LAYOUT = readFileSync("src/app/layout.tsx", "utf8");

/** Sin comentarios: la prosa de estos ficheros nombra las clases que vigila. */
function soloCodigo(fuente: string): string {
  return fuente.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
}

describe("la cabecera con serifa", () => {
  it("el nombre de la pantalla la pide", () => {
    const h = soloCodigo(readFileSync("src/components/shared/page-header.tsx", "utf8"));
    expect(h).toMatch(/<h1 className="[^"]*font-display/);
  });

  it("el nombre del conjunto la pide", () => {
    const d = soloCodigo(readFileSync("src/app/(admin)/admin/page.tsx", "utf8"));
    expect(d).toMatch(/<h2 className="[^"]*font-display[^"]*text-display/);
  });

  /** La que de verdad importa: un peso no cargado se finge y no se nota. */
  it("todo peso que pide la salida esta cargado en la fuente", () => {
    const cargados = new Set(
      (LAYOUT.match(/Playfair_Display\(\{[\s\S]*?\}\)/)?.[0].match(/"(\d{3})"/g) ?? [])
        .map((w) => w.replace(/"/g, "")),
    );
    expect(cargados.size, "no se leyeron los pesos de Playfair en layout.tsx").toBeGreaterThan(0);

    const pedidos = [...soloCodigo(CSS).matchAll(/\.font-display[^{]*\{[^}]*font-weight:\s*(\d{3})/g)]
      .map((m) => m[1]);
    expect(pedidos.length, "no se encontro ninguna regla de peso para font-display").toBeGreaterThan(0);

    const huerfanos = pedidos.filter((p) => !cargados.has(p));
    expect(
      huerfanos,
      `estos pesos se piden y NO se cargan (${[...cargados].join(", ")} si): ${huerfanos.join(", ")}`,
    ).toEqual([]);
  });

  /** Y que no se escape al landing, que usa `font-display` para lo suyo. */
  it("la regla de peso no sale de `.admin-shell`", () => {
    for (const m of soloCodigo(CSS).matchAll(/([^{}]*\.font-display[^{}]*)\{([^}]*font-weight[^}]*)\}/g)) {
      expect(m[1], `esta regla de peso alcanzaria al landing: ${m[1].trim()}`).toContain(".admin-shell");
    }
  });
});
