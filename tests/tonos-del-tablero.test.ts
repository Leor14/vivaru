import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Los tonos del tablero se leen sobre su propia tarjeta.
 *
 * Cada tono es un degradado `from-[...] to-[...]`, y el texto de apoyo va encima.
 * El caso peor para texto oscuro es el extremo `to-[...]`, que es el mas oscuro
 * de los dos: comprobar contra el claro daria un aprobado falso.
 *
 * Salio de medir el tablero desplegado: `pending` daba 4,39:1, por debajo del
 * minimo AA. Era anterior a este frente y ninguna prueba podia verlo, porque el
 * color del texto y el de su fondo viven en la misma linea de un mapa y nadie
 * los relacionaba.
 */
/**
 * Desde `PRD-V-FEAT-007` entrega 2, los tonos ya NO viven en el componente: son
 * tokens, porque un color escrito en el `className` no lo alcanza el tema y en
 * oscuro dejaba la tarjeta con texto claro sobre fondo claro. La prueba sigue
 * afirmando LO MISMO —el texto de apoyo se lee sobre el extremo mas oscuro de su
 * degradado— y ahora lo comprueba en los DOS temas.
 */
const FUENTE = readFileSync("src/app/globals.css", "utf8");

function luminancia(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const l = c.map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2];
}

function contraste(a: string, b: string): number {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

const TONOS = ["alert", "finance", "neutral", "pending", "success"] as const;

/** Lee los tokens de un bloque: `--tono-<x>-panel-hasta` y `--tono-<x>-apunte`. */
function tonos(bloque: string): Record<string, { fondo: string; texto: string }> {
  const salida: Record<string, { fondo: string; texto: string }> = {};
  for (const t of TONOS) {
    const f = bloque.match(new RegExp(`--tono-${t}-panel-hasta:\\s*(#[0-9a-fA-F]{6})`));
    const x = bloque.match(new RegExp(`--tono-${t}-apunte:\\s*(#[0-9a-fA-F]{6})`));
    if (f && x) salida[t] = { fondo: f[1], texto: x[1] };
  }
  return salida;
}

function bloqueDe(inicio: RegExp): string {
  const i = FUENTE.search(inicio);
  expect(i, `no encuentro ${inicio}`).toBeGreaterThan(-1);
  let nivel = 0;
  let j = FUENTE.indexOf("{", i);
  const desde = j;
  for (; j < FUENTE.length; j++) {
    if (FUENTE[j] === "{") nivel++;
    else if (FUENTE[j] === "}" && --nivel === 0) break;
  }
  return FUENTE.slice(desde, j);
}

const MAPAS = {
  claro: tonos(bloqueDe(/^:root \{/m)),
  oscuro: tonos(bloqueDe(/\[data-tema="oscuro"\] \{/)),
};

describe.each(Object.entries(MAPAS))("los tonos del tablero · tema %s", (nombre, mapa) => {
  it("se leyeron los cinco tonos", () => {
    expect(Object.keys(mapa).sort()).toEqual([...TONOS]);
  });

  it("el texto de apoyo de cada tono cumple AA sobre su tarjeta", () => {
    const malos: string[] = [];
    for (const [tono, { fondo, texto }] of Object.entries(mapa)) {
      const r = contraste(texto, fondo);
      if (r < 4.5) malos.push(`${nombre}/${tono}: ${texto} sobre ${fondo} da ${r.toFixed(2)}:1`);
    }
    expect(malos, malos.join("\n")).toEqual([]);
  });
});
