import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { cuentaParaCategoriaDeEgreso, cuentaParaConcepto } from "../src/plan-de-cuentas";

/**
 * La semilla del trial escribe categorías que NADIE comprueba.
 *
 * Su helper `set()` no está tipado, así que `category: "seguridad"` —que no es un
 * valor de `ExpenseCategory`— compilaba, se escribía, y salía en pantalla: el
 * estado financiero de todo conjunto de trial mostraba «servicios» y «seguridad»
 * en crudo y en minúscula, porque `categoryLabel` devuelve la clave cuando no la
 * conoce. Estuvo así hasta el 23 de agosto de 2026.
 *
 * El typecheck no puede cazarlo y el tipo no se puede importar aquí —`functions/`
 * no comparte `tsconfig` con `src/`—, así que el guardián lee el fichero como
 * texto, igual que el espejo del plan de cuentas. Si alguien vuelve a inventarse
 * una categoría, esto se pone rojo con el valor exacto.
 */

const FUENTE = path.resolve(__dirname, "../src/trial-seed.ts");

function categoriasDeGastos(): string[] {
  const texto = fs.readFileSync(FUENTE, "utf8");
  const inicio = texto.indexOf("const gastos = [");
  if (inicio === -1) throw new Error("No encuentro el array `gastos` en trial-seed.ts");
  const cuerpo = texto.slice(inicio, texto.indexOf("];", inicio));
  return [...cuerpo.matchAll(/category:\s*"([^"]+)"/g)].map((m) => m[1]);
}

describe("la semilla del trial solo usa vocabulario que existe", () => {
  it("encuentra las categorías, o la prueba no vale nada", () => {
    const categorias = categoriasDeGastos();
    expect(categorias.length, "el extractor no encontró ninguna categoría").toBeGreaterThan(0);
  });

  it("cada egreso sembrado resuelve a una cuenta PROPIA, ninguno cae en 2.8 por defecto", () => {
    for (const categoria of categoriasDeGastos()) {
      const r = cuentaParaCategoriaDeEgreso(categoria);
      expect(
        r.porDefecto,
        `«${categoria}» no es una categoría de egreso válida: cae en la cuenta por defecto ` +
          `y el estado financiero la muestra en crudo. Usa un valor de ExpenseCategory.`,
      ).toBe(false);
    }
  });

  it("el cargo sembrado resuelve a la cuenta de cuotas, no a la de egreso", () => {
    const texto = fs.readFileSync(FUENTE, "utf8");
    expect(texto).toContain('concept: "administracion"');
    expect(cuentaParaConcepto("administracion").code).toBe("1.1");
  });
});
