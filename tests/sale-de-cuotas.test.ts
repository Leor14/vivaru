// tests/sale-de-cuotas.test.ts
// `PRD-V-FEAT-010` — «Sale de» también al pagar una cuota.
//
// El panel de cuotas no mandaba cuenta: toda cuota pagada quedaba «sin cuenta» en la tesorería,
// mientras el egreso normal sí la elegía. Lo que se puede elegir es UNA regla, compartida por el
// formulario de egresos, el panel de cuotas y el servidor (`comprobarCuentaDeSalida`).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { cuentasDeSalida } from "@/features/finanzas/cuentas-de-salida";
import type { BankAccount, PettyCashFund } from "@/types/domain";

const banco = (id: string, active: boolean) => ({ id, label: id, bankName: "Banco", active }) as BankAccount;
const caja = (id: string, status: "abierta" | "cerrada") => ({ id, name: id, status }) as PettyCashFund;
const ids = (xs: { id: string }[]) => xs.map((x) => x.id);

describe("cuentasDeSalida — lo que ofrece «Sale de»", () => {
  const bancos = [banco("activa", true), banco("vieja", false)];
  const cajas = [caja("abierta", "abierta"), caja("cerrada", "cerrada")];

  it("cuentas activas y cajas abiertas; nada dado de baja ni cerrado", () => {
    const r = cuentasDeSalida(bancos, cajas);
    expect(ids(r.bancos)).toEqual(["activa"]);
    expect(ids(r.cajas)).toEqual(["abierta"]);
  });

  it("la que el egreso ya lleva se conserva aunque esté de baja o cerrada", () => {
    expect(ids(cuentasDeSalida(bancos, cajas, "vieja").bancos)).toEqual(["activa", "vieja"]);
    expect(ids(cuentasDeSalida(bancos, cajas, "cerrada").cajas)).toEqual(["abierta", "cerrada"]);
  });
});

describe("el panel de cuotas y el formulario de egresos usan la misma regla", () => {
  const sinComentarios = (s: string) =>
    s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  const leer = (ruta: string) => sinComentarios(readFileSync(resolve(process.cwd(), ruta), "utf8"));
  const panel = leer("src/components/features/finanzas/CuotasDelEgresoPanel.tsx");
  const pagina = leer("src/app/(admin)/admin/finanzas/egresos/page.tsx");

  it("el panel manda la cuenta elegida al pagar la cuota", () => {
    expect(panel).toMatch(/payExpenseInstallmentCallable\(\{[^}]*bankAccountId[^}]*\}\)/);
  });

  it("los dos filtran con `cuentasDeSalida`", () => {
    expect(panel).toMatch(/cuentasDeSalida\(/);
    expect(pagina).toMatch(/cuentasDeSalida\(/);
  });

  it("y ninguno reescribe el filtro a mano: dos copias acaban ofreciendo cosas distintas", () => {
    for (const codigo of [panel, pagina]) {
      expect(codigo).not.toMatch(/\.active !== false/);
      expect(codigo).not.toMatch(/status === "abierta"/);
    }
  });
});
