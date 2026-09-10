import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * `PRD-V-FEAT-009` · `RN-01` — lo ejecutado NO se calcula en el presupuesto.
 *
 * La pantalla lo toma de `useCommitteeReport`, el mismo cálculo que el informe
 * del consejo. No es estética: el núcleo salta los ingresos por cuota de los
 * asientos y los recibe aparte, así que un ejecutado sumado desde el libro no
 * tendría la mayor partida del conjunto — y el día de la asamblea dos pantallas
 * darían dos cifras distintas del mismo dinero.
 *
 * Mide el código SIN comentarios: la explicación de la regla nombra justo lo
 * que la regla prohíbe, y un guardián que la leyera enrojecería con ella.
 */

const raiz = path.resolve(__dirname, "..");
const PAGINA = "src/app/(admin)/admin/finanzas/presupuesto/page.tsx";
const COMPARACION = "src/lib/finanzas/presupuesto.ts";

function sinComentarios(fuente: string): string {
  return fuente.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
}

const leer = (f: string) => sinComentarios(fs.readFileSync(path.join(raiz, f), "utf8"));

const LO_QUE_CALCULA_LO_EJECUTADO = [
  "buildFinancialStatement",
  "construirEstadoFinanciero",
  "repartirRecaudo",
  "watchLedger",
  "ledgerEntries",
];

describe("`RN-01` · el presupuesto no calcula lo ejecutado", () => {
  it("la página toma lo ejecutado de useCommitteeReport", () => {
    expect(leer(PAGINA)).toMatch(/useCommitteeReport\(/);
  });

  for (const f of [PAGINA, COMPARACION]) {
    it(`${f} no lo calcula por su cuenta`, () => {
      const codigo = leer(f);
      for (const pieza of LO_QUE_CALCULA_LO_EJECUTADO) {
        expect(codigo, `${f} usa ${pieza}`).not.toContain(pieza);
      }
    });
  }
});
