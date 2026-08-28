import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getStatusLabel } from "@/utils/statusMapper";

/**
 * **Este guardián mide el código, no una lista escrita a mano.**
 *
 * Si vigilara una lista fija, la próxima clave nueva no la vería — que es exactamente cómo
 * llegaron a acumularse diez sin traducir hasta el 28 de agosto de 2026. Recorre los ficheros,
 * saca cada `status: "..."` literal y exige que el mapa lo conozca.
 */
function ficherosDeCodigo(base: string): string[] {
  const salida: string[] = [];
  const visitar = (dir: string) => {
    for (const nombre of readdirSync(dir)) {
      if (nombre === "node_modules" || nombre.startsWith(".")) continue;
      const ruta = join(dir, nombre);
      if (statSync(ruta).isDirectory()) visitar(ruta);
      else if (/\.tsx?$/.test(nombre)) salida.push(ruta);
    }
  };
  visitar(base);
  return salida;
}

describe("cobertura del mapa de estados", () => {
  it("todo estado literal del código tiene etiqueta en español", () => {
    const claves = new Set<string>();
    for (const base of ["src", "components", "features"]) {
      for (const fichero of ficherosDeCodigo(base)) {
        const texto = readFileSync(fichero, "utf-8");
        for (const m of texto.matchAll(/status:\s*"([a-zA-Z_]+)"/g)) claves.add(m[1]);
        
      }
    }

    // Que haya encontrado algo: un conjunto vacío pasaría esta prueba sin verificar nada.
    expect(claves.size).toBeGreaterThan(20);

    const sinTraducir = [...claves].filter((clave) => getStatusLabel(clave) === clave);
    expect(sinTraducir).toEqual([]);
  });

  it("una clave desconocida sigue devolviendo algo legible, no un vacío", () => {
    expect(getStatusLabel("")).toBe("Sin estado");
    expect(getStatusLabel("critical")).toBe("Crítico");
  });
});
