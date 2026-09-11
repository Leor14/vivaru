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
import type { BankAccount, LedgerEntry, PettyCashFund, TreasuryTransfer } from "@/types/domain";

export type CuentaDeTesoreria = Pick<BankAccount, "id" | "label" | "bankName" | "accountType" | "active">;

/** Entrega 3. La caja chica es una cuenta más de la tesorería, sin saldo inicial. */
export type CajaDeTesoreria = Pick<PettyCashFund, "id" | "name" | "limit" | "status">;

export type FilaDeTesoreria = {
  id: string;
  label: string;
  detalle: string;
  activa: boolean;
  /** `null` = la cuenta no tiene saldo inicial registrado, que no es lo mismo que cero. */
  saldoInicial: number | null;
  entradas: number;
  salidas: number;
  /** Neto de los traspasos: lo que entró de otra cuenta propia menos lo que salió a otra. */
  traspasos: number;
  saldo: number;
  movimientos: number;
  /** Solo en las cajas chicas (entrega 3): su fondo fijo. */
  caja?: { limite: number };
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

type Acumulado = { inicial: number | null; entradas: number; salidas: number; traspasos: number; movimientos: number };

export function saldosPorCuenta(entrada: {
  cuentas: ReadonlyArray<CuentaDeTesoreria>;
  saldosIniciales: ReadonlyArray<{ id: string; openingBalance?: number }>;
  asientos: ReadonlyArray<LedgerEntry>;
  cuotaIncome: number;
  /** Entrega 2a. Solo cuentan los `registrado` (`RN-05`). */
  traspasos?: ReadonlyArray<Pick<TreasuryTransfer, "fromAccountId" | "toAccountId" | "amount" | "status">>;
  /**
   * Entrega 3. Sin ellas, lo gastado desde una caja caería en «cuentas que ya no
   * están»: el id de la caja no es el de ninguna cuenta bancaria.
   */
  cajas?: ReadonlyArray<CajaDeTesoreria>;
}): Tesoreria {
  const acumulado = new Map<string, Acumulado>();
  const de = (id: string) => {
    let a = acumulado.get(id);
    if (!a) {
      a = { inicial: null, entradas: 0, salidas: 0, traspasos: 0, movimientos: 0 };
      acumulado.set(id, a);
    }
    return a;
  };
  for (const c of entrada.cuentas) de(c.id);
  for (const c of entrada.cajas ?? []) de(c.id);

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

  // `RN-02`: un traspaso baja una cuenta y sube otra en el mismo importe. El
  // total no se entera, porque nunca entra en `computeFundPosition` (`RN-01`).
  for (const tr of entrada.traspasos ?? []) {
    if (tr.status !== "registrado") continue;
    const importe = Number(tr.amount);
    if (!Number.isFinite(importe) || importe <= 0) continue;
    de(tr.fromAccountId).traspasos -= importe;
    de(tr.toAccountId).traspasos += importe;
  }

  const aFila = (id: string, a: Acumulado, cuenta?: CuentaDeTesoreria): FilaDeTesoreria => ({
    id,
    label: cuenta?.label ?? "Cuentas que ya no están en el conjunto",
    detalle: cuenta ? [cuenta.bankName, cuenta.accountType].filter(Boolean).join(" · ") : "",
    activa: cuenta ? cuenta.active !== false : false,
    saldoInicial: a.inicial === null ? null : redondear(a.inicial),
    entradas: redondear(a.entradas),
    salidas: redondear(a.salidas),
    traspasos: redondear(a.traspasos),
    saldo: redondear((a.inicial ?? 0) + a.entradas - a.salidas + a.traspasos),
    movimientos: a.movimientos,
  });

  const porId = new Map(entrada.cuentas.map((c) => [c.id, c]));
  const cajaPorId = new Map((entrada.cajas ?? []).map((c) => [c.id, c]));
  const cuentas: FilaDeTesoreria[] = [];
  const huerfano: Acumulado = { inicial: null, entradas: 0, salidas: 0, traspasos: 0, movimientos: 0 };
  let hayHuerfanos = false;
  for (const [id, a] of acumulado) {
    const cuenta = porId.get(id);
    if (cuenta) {
      cuentas.push(aFila(id, a, cuenta));
      continue;
    }
    const caja = cajaPorId.get(id);
    if (caja) {
      const fila: FilaDeTesoreria = {
        ...aFila(id, a),
        label: caja.name,
        activa: caja.status === "abierta",
        caja: { limite: caja.limit },
      };
      // Una caja cerrada y en cero ya no dice nada. Con saldo, sigue (`RN-13`).
      if (fila.activa || fila.saldo !== 0) cuentas.push(fila);
      continue;
    }
    hayHuerfanos = true;
    if (a.inicial !== null) huerfano.inicial = (huerfano.inicial ?? 0) + a.inicial;
    huerfano.entradas += a.entradas;
    huerfano.salidas += a.salidas;
    huerfano.traspasos += a.traspasos;
    huerfano.movimientos += a.movimientos;
  }
  // `RN-13`: una cuenta desactivada sigue aquí mientras tenga dinero. Van detrás.
  // Los bancos primero y las cajas detrás.
  cuentas.sort(
    (x, y) =>
      Number(Boolean(x.caja)) - Number(Boolean(y.caja)) ||
      Number(y.activa) - Number(x.activa) ||
      x.label.localeCompare(y.label),
  );
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

// ── Entrega 2a · el formulario del traspaso ─────────────────────────────────

const FORMA_DE_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;

function fechaDeHoy(hoy: Date): string {
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;
}

/**
 * Lo que el formulario exige antes de mandar nada. Las reglas comprueban lo
 * mismo salvo la fecha futura, que no decide dinero.
 */
export function errorDeTraspaso(
  t: { fromAccountId: string; toAccountId: string; amount: string; date: string },
  hoy: Date,
): string | null {
  if (!t.fromAccountId || !t.toAccountId) return "Elige la cuenta de origen y la de destino.";
  if (t.fromAccountId === t.toAccountId) return "El origen y el destino tienen que ser cuentas distintas.";
  const importe = Number(t.amount);
  if (!t.amount.trim() || !Number.isFinite(importe) || importe <= 0) return "El valor tiene que ser un número mayor que cero.";
  return errorDeFecha(t.date, hoy, "Falta la fecha del traspaso.");
}

function errorDeFecha(fecha: string, hoy: Date, siFalta: string): string | null {
  const m = FORMA_DE_FECHA.exec(fecha);
  if (!m) return siFalta;
  const [y, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const f = new Date(y, mes - 1, dia);
  if (f.getFullYear() !== y || f.getMonth() !== mes - 1 || f.getDate() !== dia) return "Esa fecha no existe.";
  if (fecha > fechaDeHoy(hoy)) return "La fecha no puede ser posterior a hoy.";
  return null;
}

/**
 * `RN-09`: el saldo con el que quedaría el origen, si queda en negativo. Avisa y
 * deja continuar: el saldo calculado puede estar incompleto (sin cuenta,
 * cobrado sin asiento), y bloquear por él frenaría operaciones legítimas.
 */
export function saldoNegativoTrasTraspaso(origen: Pick<FilaDeTesoreria, "saldo"> | undefined, importe: number): number | null {
  if (!origen || !Number.isFinite(importe) || importe <= 0) return null;
  const queda = Math.round((origen.saldo - importe) * 100) / 100;
  return queda < 0 ? queda : null;
}

// ── Entrega 3 · la caja chica ────────────────────────────────────────────────

/** Lo que el formulario de apertura exige. La apertura mete el límite entero. */
export function errorDeApertura(
  t: { name: string; limit: string; sourceAccountId: string; date: string },
  hoy: Date,
): string | null {
  if (!t.name.trim()) return "Ponle un nombre a la caja.";
  if (!t.sourceAccountId) return "Elige la cuenta de la que sale el dinero.";
  const limite = Number(t.limit);
  if (!t.limit.trim() || !Number.isFinite(limite) || limite <= 0) return "El límite tiene que ser un número mayor que cero.";
  return errorDeFecha(t.date, hoy, "Falta la fecha de la apertura.");
}

/**
 * `RN-11` · lo que propone «Reponer»: **lo que devuelve la caja a su límite**.
 *
 * Con fondo fijo, el límite menos lo que queda **es** lo gastado desde la
 * última reposición, cuando esa reposición la dejó llena —que es lo normal—.
 * Si la anterior fue parcial, la propuesta cubre también lo que faltó: la regla
 * existe para que la caja vuelva a su límite, no para repetir una cifra.
 */
export function propuestaDeReposicion(fila: Pick<FilaDeTesoreria, "saldo" | "caja">): number {
  if (!fila.caja) return 0;
  return redondear(Math.max(0, fila.caja.limite - fila.saldo));
}

/**
 * `RN-09` · `RN-11`: cuánto pasaría del límite la caja tras reponer ese
 * importe, si pasa. **Avisa, no bloquea.**
 */
export function excesoSobreElLimite(fila: Pick<FilaDeTesoreria, "saldo" | "caja"> | undefined, importe: number): number | null {
  if (!fila?.caja || !Number.isFinite(importe) || importe <= 0) return null;
  const exceso = redondear(fila.saldo + importe - fila.caja.limite);
  return exceso > 0 ? exceso : null;
}

/**
 * §6 · cerrar exige saldo cero. Con dinero dentro, el cierre lo devuelve a una
 * cuenta en el mismo lote: esto dice cuánto. **En negativo no se cierra**
 * (`null`): falta registrar un ingreso o reponer, y cerrar escondería la
 * diferencia.
 */
export function devolucionAlCerrar(fila: Pick<FilaDeTesoreria, "saldo">): number | null {
  return fila.saldo < 0 ? null : redondear(fila.saldo);
}
