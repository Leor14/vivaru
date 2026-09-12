// tests/base-de-reparto-espejo.test.ts
// Toda base de reparto que escribe el servidor está en el tipo del front.
//
// `BillingCampaign.distributionBasis` lo escribe `functions/` y lo declara `src/types/domain.ts`, y
// los dos lados no pueden importarse. Ya pasó dos veces que el servidor escribiera algo que el tipo
// no conocía: con `PLAT-001` la interfaz no declaraba el campo, y con `FEAT-008` —el cobro por
// consumo medido— el servidor escribía `consumption` y el tipo se quedó en dos valores hasta el 12
// de septiembre de 2026. Esto saca los valores del CÓDIGO del servidor, no de una lista escrita a
// mano, y exige que el tipo los declare.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = process.cwd();

function recorrer(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) return nombre === "node_modules" ? [] : recorrer(ruta);
    return /\.ts$/.test(nombre) ? [ruta] : [];
  });
}

/** Sin comentarios: uno que nombre un valor para explicarlo no es una escritura. */
const sinComentarios = (texto: string) => texto.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

const TIPO = sinComentarios(readFileSync(join(RAIZ, "src/types/domain.ts"), "utf8")).match(
  /distributionBasis\?:\s*([^;]+);/,
)?.[1] ?? "";
const DEL_TIPO = new Set([...TIPO.matchAll(/"([a-z_]+)"/g)].map((m) => m[1]));

const ESCRITOS = new Map<string, string[]>();
for (const fichero of recorrer(join(RAIZ, "functions/src"))) {
  for (const m of sinComentarios(readFileSync(fichero, "utf8")).matchAll(/distributionBasis:\s*"([a-z_]+)"/g)) {
    ESCRITOS.set(m[1], [...(ESCRITOS.get(m[1]) ?? []), relative(RAIZ, fichero)]);
  }
}

describe("la base de reparto: lo que escribe el servidor está en el tipo", () => {
  it("lee de verdad los dos lados", () => {
    expect(DEL_TIPO.size).toBeGreaterThanOrEqual(2);
    // Al 12 de septiembre de 2026 el servidor escribe `coefficient` y `consumption`.
    expect(ESCRITOS.size).toBeGreaterThanOrEqual(2);
  });

  it("cada valor que escribe functions/src lo declara src/types/domain.ts", () => {
    const fuera = [...ESCRITOS]
      .filter(([valor]) => !DEL_TIPO.has(valor))
      .map(([valor, ficheros]) => `${valor} (${ficheros.join(", ")})`);
    expect(fuera).toEqual([]);
  });
});
