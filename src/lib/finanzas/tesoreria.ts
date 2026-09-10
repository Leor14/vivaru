/**
 * `PRD-V-FEAT-010` entrega 1 · el saldo por cuenta.
 *
 * Vivaru sabía cuánto dinero tiene el conjunto, pero no DÓNDE está. Esto lo
 * reparte por cuenta —saldo inicial, entradas, salidas— y añade las dos líneas
 * sin las cuales el total no cuadra con el saldo de fondos (`RN-03`, `RN-04`):
 *
 * - **Sin cuenta asignada**: los asientos que no dicen de qué cuenta salieron.
 *   En producción, 18 de 95 al medirlo; en Santa María, todos.
 * - **Cobrado en Cartera sin asiento en el libro**: el saldo de fondos toma el
 *   recaudo de Cartera, no de los asientos, y los dos coincidían en 2 de 7
 *   conjuntos. La diferencia se NOMBRA; no se reparte entre cuentas.
 *
 * **El total NO se suma aquí: sale de `computeFundPosition`**, la misma función
 * que da el saldo de fondos en «Libro y fondos». Si esta pantalla sumara por su
 * cuenta, el administrador vería dos cifras de «cuánto dinero hay».
 * `sinExplicar` es lo que quede entre las dos formas de contar, y debe ser cero:
 * si no lo es, se enseña, en vez de esconderlo.
 */

import { esRecaudoDeCartera } from "@/features/finanzas/financial-statement";
import { sumarSaldoInicial } from "@/features/finanzas/use-bank-accounts";
import { computeFundPosition, movimientoEntraAlFondo } from "@/features/finanzas/use-ledger";
import type { BankAccount, LedgerEntry } from "@/types/domain";

export type CuentaDeTesoreria = Pick<BankAccount, "id" | "label" | "bankName" | "accountType" | "active">;

export type FilaDeTesoreria = {
  id: string;
  label: string;
  detalle: string;
  activa: boolean;
  /** `null` = la cuenta no tiene saldo inicial registrado, que no es lo mismo que cero. */
  saldoInicial: number | null;
  entradas: number;
  salidas: number;
  saldo: number;
  movimientos: number;
};

export type Tesoreria = {
  cuentas: FilaDeTesoreria[];
  /** Asientos o saldos iniciales de cuentas que ya no están en el conjunto. */
  cuentasQueYaNoExisten: FilaDeTesoreria | null;
  sinCuenta: { monto: number; cantidad: number; asientos: LedgerEntry[] };
  cobradoSinAsiento: number;
  sinExplicar: number;
  /** El saldo de fondos, idéntico al de «Libro y fondos» (`RN-04`). */
  total: number;
};

const redondear = (n: number) => Math.round(n * 100) / 100;

type Acumulado = { inicial: number | null; entradas: number; salidas: number; movimientos: number };

export function saldosPorCuenta(entrada: {
  cuentas: ReadonlyArray<CuentaDeTesoreria>;
  saldosIniciales: ReadonlyArray<{ id: string; openingBalance?: number }>;
  asientos: ReadonlyArray<LedgerEntry>;
  cuotaIncome: number;
}): Tesoreria {
  const acumulado = new Map<string, Acumulado>();
  const de = (id: string) => {
    let a = acumulado.get(id);
    if (!a) {
      a = { inicial: null, entradas: 0, salidas: 0, movimientos: 0 };
      acumulado.set(id, a);
    }
    return a;
  };
  for (const c of entrada.cuentas) de(c.id);

  for (const s of entrada.saldosIniciales) {
    if (typeof s.openingBalance !== "number" || !Number.isFinite(s.openingBalance)) continue;
    const a = de(s.id);
    a.inicial = (a.inicial ?? 0) + s.openingBalance;
  }

  let sinCuentaMonto = 0;
  const sinCuentaAsientos: LedgerEntry[] = [];
  let recaudoEnLibro = 0;
  for (const e of entrada.asientos) {
    if (e.type !== "ingreso" && e.type !== "egreso") continue;
    const importe = e.amount ?? 0;
    const entra = movimientoEntraAlFondo(e.type, importe);
    if (e.type === "ingreso" && esRecaudoDeCartera(e)) recaudoEnLibro += importe;
    if (!e.bankAccountId) {
      sinCuentaMonto += entra ? Math.abs(importe) : -Math.abs(importe);
      sinCuentaAsientos.push(e);
      continue;
    }
    const a = de(e.bankAccountId);
    a.movimientos += 1;
    if (entra) a.entradas += Math.abs(importe);
    else a.salidas += Math.abs(importe);
  }

  const aFila = (id: string, a: Acumulado, cuenta?: CuentaDeTesoreria): FilaDeTesoreria => ({
    id,
    label: cuenta?.label ?? "Cuentas que ya no están en el conjunto",
    detalle: cuenta ? [cuenta.bankName, cuenta.accountType].filter(Boolean).join(" · ") : "",
    activa: cuenta ? cuenta.active !== false : false,
    saldoInicial: a.inicial === null ? null : redondear(a.inicial),
    entradas: redondear(a.entradas),
    salidas: redondear(a.salidas),
    saldo: redondear((a.inicial ?? 0) + a.entradas - a.salidas),
    movimientos: a.movimientos,
  });

  const porId = new Map(entrada.cuentas.map((c) => [c.id, c]));
  const cuentas: FilaDeTesoreria[] = [];
  const huerfano: Acumulado = { inicial: null, entradas: 0, salidas: 0, movimientos: 0 };
  let hayHuerfanos = false;
  for (const [id, a] of acumulado) {
    const cuenta = porId.get(id);
    if (cuenta) {
      cuentas.push(aFila(id, a, cuenta));
      continue;
    }
    hayHuerfanos = true;
    if (a.inicial !== null) huerfano.inicial = (huerfano.inicial ?? 0) + a.inicial;
    huerfano.entradas += a.entradas;
    huerfano.salidas += a.salidas;
    huerfano.movimientos += a.movimientos;
  }
  // `RN-13`: una cuenta desactivada sigue aquí mientras tenga dinero. Van detrás.
  cuentas.sort((x, y) => Number(y.activa) - Number(x.activa) || x.label.localeCompare(y.label));
  const cuentasQueYaNoExisten = hayHuerfanos ? aFila("(sin cuenta registrada)", huerfano) : null;

  // `RN-04`: el total ES el saldo de fondos, por la misma función.
  const total = redondear(
    computeFundPosition([...entrada.asientos], entrada.cuotaIncome, sumarSaldoInicial(entrada.saldosIniciales)).balance,
  );
  const cobradoSinAsiento = redondear(entrada.cuotaIncome - recaudoEnLibro);
  const sinCuenta = { monto: redondear(sinCuentaMonto), cantidad: sinCuentaAsientos.length, asientos: sinCuentaAsientos };
  const sumado =
    cuentas.reduce((s, f) => s + f.saldo, 0) +
    (cuentasQueYaNoExisten?.saldo ?? 0) +
    sinCuenta.monto +
    cobradoSinAsiento;

  return {
    cuentas,
    cuentasQueYaNoExisten,
    sinCuenta,
    cobradoSinAsiento,
    sinExplicar: redondear(total - sumado),
    total,
  };
}
