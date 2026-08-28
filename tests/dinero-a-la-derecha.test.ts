import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Una columna de dinero se alinea a la derecha.
 *
 * Es lo que deja las unidades una debajo de otra y permite comparar dos
 * importes de un vistazo. Sin ello, `$ 430.000` y `$ 2.250.000` empiezan en el
 * mismo sitio y hay que leerlos enteros.
 *
 * El producto se contradecia a si mismo: de trece celdas con importe, SIETE ya
 * estaban a la derecha y seis no. El camino bueno ya existia en el mismo
 * repositorio; solo habia que seguirlo en las que faltaban.
 *
 * Ojo con el alcance: esto vale para CELDAS DE TABLA. Los mismos importes en
 * tarjetas, indicadores y resumenes van en el flujo del texto y ahi la
 * alineacion a la derecha no aplica — por eso el guardian mira `<td>` y columnas
 * de `DataTable`, no toda llamada a `formatAmount`.
 */
const DINERO = /format(Currency|Amount|AmountCompact)\w*\(/;

function ficheros(dir: string): string[] {
  const salida: string[] = [];
  for (const e of readdirSync(dir)) {
    if (e === "node_modules" || e === ".next") continue;
    const ruta = join(dir, e);
    if (statSync(ruta).isDirectory()) salida.push(...ficheros(ruta));
    else if (ruta.endsWith(".tsx")) salida.push(ruta);
  }
  return salida;
}

const TSX = ["src", "components", "features"].flatMap(ficheros);

/** Sin comentarios: la prosa de un fichero puede nombrar `formatAmount`. */
function soloCodigo(fuente: string): string {
  return fuente.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
}

/** Trocea `{ key: "..." ... }` contando llaves: una regex de una pasada no sabe. */
function* columnas(texto: string): Generator<[string, string]> {
  for (const m of texto.matchAll(/\{\s*key:\s*"([^"]+)"/g)) {
    const i = m.index!;
    let nivel = 0;
    for (let j = i; j < Math.min(i + 4000, texto.length); j++) {
      if (texto[j] === "{") nivel++;
      else if (texto[j] === "}" && --nivel === 0) {
        yield [m[1], texto.slice(i, j + 1)];
        break;
      }
    }
  }
}

describe("el dinero de una tabla va a la derecha", () => {
  it("ninguna celda `<td>` con importe queda a la izquierda", () => {
    const culpables: string[] = [];
    for (const f of TSX) {
      const t = soloCodigo(readFileSync(f, "utf8"));
      for (const m of t.matchAll(/<td\b([^>]*)>([\s\S]*?)<\/td>/g)) {
        if (!DINERO.test(m[2])) continue;
        if (/text-right/.test(m[1])) continue;
        culpables.push(`${f}:${t.slice(0, m.index!).split("\n").length}`);
      }
    }
    expect(culpables, `celdas con importe sin alinear:\n${culpables.join("\n")}`).toEqual([]);
  });

  it("ninguna columna de `DataTable` con importe queda a la izquierda", () => {
    const culpables: string[] = [];
    for (const f of TSX) {
      const t = soloCodigo(readFileSync(f, "utf8"));
      if (!t.includes("key:")) continue;
      for (const [clave, cuerpo] of columnas(t)) {
        if (!DINERO.test(cuerpo)) continue;
        if (/className:\s*"[^"]*text-right/.test(cuerpo)) continue;
        culpables.push(`${f} · columna "${clave}"`);
      }
    }
    expect(culpables, `columnas con importe sin alinear:\n${culpables.join("\n")}`).toEqual([]);
  });

  it("el guardian encuentra celdas de dinero de verdad", () => {
    let n = 0;
    for (const f of TSX) {
      for (const m of soloCodigo(readFileSync(f, "utf8")).matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)) {
        if (DINERO.test(m[1])) n++;
      }
    }
    expect(n, "si esto baja a cero, el guardian dejo de mirar nada").toBeGreaterThanOrEqual(10);
  });
});
