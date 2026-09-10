import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * `PRD-V-FEAT-010` · `RN-01` — un traspaso NO es un asiento.
 *
 * Vive en su propia colección, y ningún consumidor del libro puede leerla: ni
 * el núcleo del estado financiero (los dos espejos), ni el informe mensual, ni
 * el informe del consejo, ni el presupuesto, ni el saldo de fondos. Si uno la
 * leyera, un traspaso inflaría ingresos y egresos — o se colaría en el total.
 *
 * Mide el código SIN comentarios: la explicación nombra justo lo que se vigila.
 */

const raiz = path.resolve(__dirname, "..");
const sinComentarios = (f: string) =>
  f.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const CONSUMIDORES_DEL_LIBRO = [
  "functions/src/nucleo-estado-financiero.ts",
  "src/lib/finanzas/nucleo-estado-financiero.ts",
  "functions/src/informe-mensual.ts",
  "src/features/reports/use-committee-report.ts",
  "src/features/finanzas/financial-statement.ts",
  "src/features/finanzas/use-ledger.ts",
  "src/lib/finanzas/presupuesto.ts",
];

describe("`RN-01` · ningún consumidor del libro lee los traspasos", () => {
  it("los ficheros vigilados existen — si no, este guardián mide la nada", () => {
    for (const f of CONSUMIDORES_DEL_LIBRO) expect(fs.existsSync(path.join(raiz, f)), `${f} no existe`).toBe(true);
  });

  for (const f of CONSUMIDORES_DEL_LIBRO) {
    it(`${f} no nombra treasuryTransfers`, () => {
      expect(sinComentarios(fs.readFileSync(path.join(raiz, f), "utf8"))).not.toContain("treasuryTransfers");
    });
  }
});
