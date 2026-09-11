import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * `PRD-V-FEAT-010` · `RN-08`, `RN-10`, `CA14` — la caja chica no es un destino
 * de pago.
 *
 * El residente dice a qué cuenta pagó eligiendo de `bankAccounts`, y la
 * administración registra o aprueba un pago eligiendo de la misma lista. La
 * caja vive en `pettyCashFunds` precisamente para NO estar ahí. Si una de estas
 * pantallas leyera cajas, se la ofrecería como destino de una cuota. Y la
 * guarda del servidor (`aplicarPago`) solo acepta `bankAccounts`: si aprendiera
 * a leer cajas, dejaría entrar la cuota. La prueba de comportamiento es `CA17`,
 * en `functions/tests/payments.emulator.test.ts`; esto vigila la causa.
 *
 * Mide el código SIN comentarios: la explicación nombra justo lo que se vigila.
 */

const raiz = path.resolve(__dirname, "..");
const sinComentarios = (f: string) =>
  f.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const PROHIBIDO = ["pettyCashFunds", "use-cajas", "watchCajas"];

function ficherosDe(dir: string): string[] {
  return fs.readdirSync(path.join(raiz, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) return ficherosDe(rel);
    return /\.(ts|tsx)$/.test(e.name) ? [rel] : [];
  });
}

const DONDE_SE_ELIGE_A_QUE_CUENTA_SE_PAGO = [
  ...ficherosDe("src/app/(resident)"),
  "src/components/features/finanzas/RecordPaymentModal.tsx",
  "src/components/features/billing/PaymentReceiptsReviewPanel.tsx",
  "src/features/finanzas/use-bank-accounts.ts",
  "functions/src/payments.ts",
];

describe("`RN-08` · `RN-10` · la caja chica no aparece donde se elige a qué cuenta se pagó", () => {
  it("los ficheros vigilados existen, y el barrido del residente encuentra algo — si no, mide la nada", () => {
    for (const f of DONDE_SE_ELIGE_A_QUE_CUENTA_SE_PAGO) expect(fs.existsSync(path.join(raiz, f)), `${f} no existe`).toBe(true);
    expect(DONDE_SE_ELIGE_A_QUE_CUENTA_SE_PAGO.filter((f) => f.includes("(resident)")).length).toBeGreaterThan(5);
  });

  for (const f of DONDE_SE_ELIGE_A_QUE_CUENTA_SE_PAGO) {
    it(`${f} no lee cajas`, () => {
      const codigo = sinComentarios(fs.readFileSync(path.join(raiz, f), "utf8"));
      for (const p of PROHIBIDO) expect(codigo, `${f} nombra ${p}`).not.toContain(p);
    });
  }

  it("la guarda del pago sigue leyendo SOLO `bankAccounts`", () => {
    const codigo = sinComentarios(fs.readFileSync(path.join(raiz, "functions/src/payments.ts"), "utf8"));
    expect(codigo).toContain('collection("bankAccounts").doc(bankAccountIdCrudo)');
  });
});
