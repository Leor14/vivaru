import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * El estado se lee como estado, y el residente se lee como escribio.
 *
 * `StatusBadge` tenia `rounded-[4px]`: un valor a pelo que ningun token alcanzaba
 * y que hacia que un estado pareciese una casilla. Ahora es una pildora.
 *
 * Y el asunto de una PQRS llevaba `text-transform: capitalize`, que en español
 * pone mayuscula a CADA palabra. En pantalla se leia «Sobre El Cajon De T3-63» y
 * «Por Que Se Esta Pagando Dos Veces El Concepto De Basura» — caja de titular
 * inglesa sobre las frases de un residente.
 */

/** Sin comentarios: la prosa de estos ficheros nombra lo que vigilan. */
function soloCodigo(fuente: string): string {
  return fuente
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\/[^\n]*/g, "");
}

const BADGE = soloCodigo(readFileSync("src/components/ui/StatusBadge.tsx", "utf8"));
const PQRS = soloCodigo(readFileSync("src/app/(admin)/admin/pqrs/page.tsx", "utf8"));
const CSS = readFileSync("src/app/globals.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

describe("el estado en pildora", () => {
  it("la placa de estado es una pildora", () => {
    expect(BADGE).toMatch(/rounded-full/);
  });

  it("y no vuelve a fijar el radio a pelo", () => {
    expect(BADGE).not.toMatch(/rounded(-[a-z]+)?-\[\d+px\]/);
  });
});

describe("el asunto de una PQRS", () => {
  it("no lleva capitalize: son las palabras del residente", () => {
    const linea = PQRS.split("\n").find((l) => l.includes("ticket.subject"));
    expect(linea, "no se encontro donde se pinta el asunto").toBeDefined();
    expect(linea).not.toMatch(/\bcapitalize\b/);
    expect(linea).not.toMatch(/pqrs-asunto/);
  });

  it("y la regla que lo hacia no vuelve a globals.css", () => {
    expect(CSS).not.toMatch(/\.pqrs-asunto/);
  });
});
