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
const FUENTE = readFileSync(
  "src/components/features/admin/dashboard/executive-kpi-card.tsx",
  "utf8",
);

function luminancia(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const l = c.map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2];
}

function contraste(a: string, b: string): number {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** Lee el mapa del componente: tono → { fondoMasOscuro, textoDeApoyo }. */
function tonos(): Record<string, { fondo: string; texto: string }> {
  const bloque = FUENTE.slice(FUENTE.indexOf("TONE_STYLES"), FUENTE.indexOf("};", FUENTE.indexOf("TONE_STYLES")));
  const salida: Record<string, { fondo: string; texto: string }> = {};
  for (const m of bloque.matchAll(
    /(\w+):\s*\{\s*shell:\s*"[^"]*to-\[(#[0-9a-fA-F]{6})\][^"]*"[\s\S]*?insight:\s*"text-\[(#[0-9a-fA-F]{6})\]"/g,
  )) {
    salida[m[1]] = { fondo: m[2], texto: m[3] };
  }
  return salida;
}

describe("los tonos del tablero", () => {
  const mapa = tonos();

  it("se leyeron los cinco tonos del componente", () => {
    expect(Object.keys(mapa).sort()).toEqual(["alert", "finance", "neutral", "pending", "success"]);
  });

  it("el texto de apoyo de cada tono cumple AA sobre su tarjeta", () => {
    const malos: string[] = [];
    for (const [tono, { fondo, texto }] of Object.entries(mapa)) {
      const r = contraste(texto, fondo);
      if (r < 4.5) malos.push(`${tono}: ${texto} sobre ${fondo} da ${r.toFixed(2)}:1`);
    }
    expect(malos, malos.join("\n")).toEqual([]);
  });
});
