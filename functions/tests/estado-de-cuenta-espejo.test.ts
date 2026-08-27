import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { construirEstadoDeCuenta } from "../src/estado-de-cuenta";

/**
 * **El estado de cuenta vive DUPLICADO, y esta es la guarda.**
 *
 * `src/features/billing/estado-de-cuenta.ts` es lo que el residente VE en pantalla.
 * `functions/src/estado-de-cuenta.ts` es lo que se imprime en el PDF que viaja ADJUNTO en el
 * correo de cobranza. No pueden importarse: `CLAUDE.md` prohíbe que `src/` toque `functions/`
 * porque App Hosting hace `npm ci` solo en la raíz y romperlo tumba el `next build`.
 *
 * **El precedente de por qué esto no puede ser solo un comentario está en este mismo repositorio.**
 * El catálogo de avisos llevaba desde siempre una cabecera que decía «las cadenas deben mantenerse
 * en sincronía», y nada lo comprobaba: era una frase. Se le puso guardián en agosto de 2026
 * (`notification-catalog-espejo.test.ts`) al construir CA13, que tocaba los dos lados.
 *
 * **Aquí el síntoma de la divergencia sería el peor de todos:** la pantalla enseñándole un saldo al
 * residente y el papel que se le manda diciendo otro. Ninguno de los dos daría error.
 */

const RAIZ = path.resolve(__dirname, "../..");
const FRONT = path.join(RAIZ, "src/features/billing/estado-de-cuenta.ts");
const SERVIDOR = path.join(RAIZ, "functions/src/estado-de-cuenta.ts");

/**
 * El núcleo comparable: desde `function cubierto` hasta el final de `construirEstadoDeCuenta`.
 *
 * Se compara **el cálculo**, no el fichero entero: las cabeceras difieren a propósito (una explica
 * el front y otra el espejo) y los tipos también — en el front el cargo viene de `@/types/domain`
 * y en el servidor es estructural, porque no puede importar de `src/`.
 */
function nucleo(ruta: string): string {
  const s = fs.readFileSync(ruta, "utf8");
  const i = s.indexOf("function cubierto(");
  expect(i, `no se encontró el núcleo en ${ruta}`).toBeGreaterThan(-1);
  const fin = s.indexOf("\n}", s.indexOf("export function construirEstadoDeCuenta"));
  expect(fin, `no se encontró el fin del núcleo en ${ruta}`).toBeGreaterThan(-1);
  return (
    s
      .slice(i, fin + 2)
      // La ÚNICA diferencia tolerada: el nombre del tipo del cargo.
      .replace(/\bBillingStatement\b/g, "CargoDeCartera")
      .replace(/\r\n/g, "\n")
      .trim()
  );
}

describe("FEAT-004 / FLOW-003 · el espejo del estado de cuenta", () => {
  it("el cálculo del servidor es idéntico al del front", () => {
    expect(nucleo(SERVIDOR)).toBe(nucleo(FRONT));
  });

  /**
   * **Y una comprobación de conducta, no solo de texto.** Comparar cadenas caza el 99% —alguien
   * edita un lado—, pero pasaría en verde si los dos ficheros fueran idénticos y estuvieran los
   * dos mal. Esto ancla el resultado contra los datos reales de `T2-503` del 26 de agosto de 2026:
   * siete cargos, y el saldo final que la cartera del administrador enseña en pantalla.
   */
  it("y sobre los datos reales de T2-503 da los 4.160.000 que enseña la cartera", () => {
    const cargo = (id: string, period: string, amount: number, balance: number, dueDate?: string) => ({
      id,
      period,
      amount,
      balance,
      ...(dueDate ? { dueDate } : {}),
    });

    const e = construirEstadoDeCuenta([
      cargo("abr", "2026-04", 400_000, 0, "2026-05-28"),
      cargo("may", "2026-05", 400_000, 400_000),
      cargo("jun1", "2026-06", 1_120_000, 1_120_000, "2026-06-26"),
      cargo("jun2", "2026-06", 1_120_000, 1_120_000, "2026-06-25"),
      cargo("jun3", "2026-06", 1_120_000, 1_120_000),
      cargo("mar", "2026-03", 400_000, 400_000, "2026-05-28"),
      cargo("jun0", "2026-06", 0, 0),
    ]);

    expect(e.lineas).toHaveLength(7);
    expect(e.saldoFinal).toBe(4_160_000);
    // Y en el orden que se decidió el 26 de agosto: por período, no por vencimiento.
    expect(e.lineas.map((l) => l.periodo)).toEqual([
      "2026-03",
      "2026-04",
      "2026-05",
      "2026-06",
      "2026-06",
      "2026-06",
      "2026-06",
    ]);
  });
});
