import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * El radio de las esquinas tiene que obedecer a un token.
 *
 * Tailwind 4 declara la utilidad escueta dentro de `@theme default inline`, asi
 * que emite un valor literal (`border-radius:.25rem`) en vez de una variable.
 * Noventa esquinas del producto quedaban fuera del sistema: cambiar la escala no
 * las alcanzaba, y no habia forma de notarlo mirando el codigo.
 *
 * `rounded-sm` resuelve a `var(--radius-sm)`, que vale los mismos .25rem, asi que
 * la migracion no movio un pixel. Lo que cambia es que ahora se pueden mover todas
 * a la vez.
 */
const DIRECTORIOS = ["src", "components", "features"];
const ESCUETO = /(?<![\w-])rounded(?![\w\-[])/;

function ficheros(dir: string): string[] {
  const salida: string[] = [];
  for (const entrada of readdirSync(dir)) {
    if (entrada === "node_modules" || entrada === ".next") continue;
    const ruta = join(dir, entrada);
    if (statSync(ruta).isDirectory()) salida.push(...ficheros(ruta));
    else if (ruta.endsWith(".tsx")) salida.push(ruta);
  }
  return salida;
}

/** Sin comentarios: la prosa de este mismo guardian nombra la clase que veta. */
function soloCodigo(fuente: string): string {
  return fuente.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

describe("el radio de las esquinas pasa por un token", () => {
  it("ningun .tsx usa la clase `rounded` escueta", () => {
    const culpables: string[] = [];
    for (const dir of DIRECTORIOS) {
      for (const fichero of ficheros(dir)) {
        soloCodigo(readFileSync(fichero, "utf8"))
          .split("\n")
          .forEach((linea, i) => {
            if (ESCUETO.test(linea)) culpables.push(`${fichero}:${i + 1}`);
          });
      }
    }
    expect(culpables, `usa \`rounded-sm\`, que vale lo mismo y obedece al token:\n${culpables.join("\n")}`).toEqual([]);
  });

  it("ningun .tsx del producto fija un radio en pixeles a pelo", () => {
    // El landing queda fuera, como en la escala de radios: tiene su propio
    // lenguaje visual y sus tokens estan anclados aparte.
    const culpables: string[] = [];
    for (const dir of DIRECTORIOS) {
      for (const fichero of ficheros(dir)) {
        if (fichero.includes("marketing")) continue;
        soloCodigo(readFileSync(fichero, "utf8"))
          .split("\n")
          .forEach((linea, i) => {
            if (/rounded(-[a-z]+)?-\[\d+px\]/.test(linea)) culpables.push(`${fichero}:${i + 1}`);
          });
      }
    }
    expect(culpables, `usa un token de la escala:\n${culpables.join("\n")}`).toEqual([]);
  });

  it("el guardian mira ficheros de verdad", () => {
    expect(DIRECTORIOS.flatMap(ficheros).length).toBeGreaterThan(150);
  });
});
