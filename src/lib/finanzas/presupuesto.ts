/**
 * `PRD-V-FEAT-009` · el presupuesto contra lo ejecutado.
 *
 * **Esta función NO calcula lo ejecutado: lo recibe** (`RN-01`). Lo ejecutado sale
 * de `useCommitteeReport`, el mismo cálculo que el informe del consejo, y no es
 * estética: el núcleo salta los ingresos por cuota de los asientos y los recibe
 * aparte, así que un ejecutado sumado aquí desde el libro **no tendría la mayor
 * partida del conjunto**.
 *
 * Y **nada ejecutado se esconde** (`RN-02`): una fila ejecutada sale tenga
 * presupuesto o no, y los totales ejecutados son los del estado, no la suma de
 * las filas presupuestadas. Un gasto fuera del presupuesto es justo el déficit
 * que la asamblea busca.
 */

import { compararCodigos } from "@/lib/finanzas/nucleo-estado-financiero";

export type TipoDeCuenta = "ingreso" | "egreso";

export type CuentaDelPlan = {
  code: string;
  name: string;
  type: TipoDeCuenta;
  parentCode?: string;
  status?: "active" | "inactive";
};

export type LineaDelPresupuesto = { accountCode: string; amount: number };

export type EjecutadoDelAnio = {
  incomeByCategory: ReadonlyArray<{ category: string; label: string; amount: number }>;
  expenseByCategory: ReadonlyArray<{ category: string; label: string; amount: number }>;
  totalIncome: number;
  totalExpenses: number;
};

export type SituacionDeLaFila =
  | "presupuestada"
  | "sin_presupuestar"
  | "presupuestada_en_cero"
  | "importe_invalido";

export type Desviacion = "sobre_ejecucion" | "faltante" | null;

export type FilaDeComparacion = {
  code: string;
  label: string;
  tipo: TipoDeCuenta;
  /** `null` es «sin presupuestar» y NO cero (`RN-03`). */
  presupuestado: number | null;
  ejecutado: number;
  diferencia: number | null;
  porcentaje: number | null;
  situacion: SituacionDeLaFila;
  desviacion: Desviacion;
};

export type Veredicto = "superavit" | "deficit" | "equilibrio";

export type ComparacionDelPresupuesto = {
  ingresos: FilaDeComparacion[];
  egresos: FilaDeComparacion[];
  totales: {
    ingresos: { presupuestado: number; ejecutado: number };
    egresos: { presupuestado: number; ejecutado: number };
    resultado: {
      presupuestado: number;
      ejecutado: number;
      veredictoPresupuestado: Veredicto;
      veredictoEjecutado: Veredicto;
    };
  };
  /** Códigos cuya línea no se pudo leer: importe no numérico, negativo o repetido (`CA21`). */
  lineasInvalidas: string[];
};

const redondear = (n: number) => Math.round(n * 100) / 100;

/** El primer nivel del plan es la estructura del libro: `1` ingresos, `2` egresos. */
function tipoPorCodigo(code: string): TipoDeCuenta | null {
  if (code === "1" || code.startsWith("1.")) return "ingreso";
  if (code === "2" || code.startsWith("2.")) return "egreso";
  return null;
}

function veredicto(n: number): Veredicto {
  if (n > 0) return "superavit";
  if (n < 0) return "deficit";
  return "equilibrio";
}

/**
 * Las líneas tal como vienen del documento, que las escribe el cliente y las
 * reglas no pueden iterar. Por eso aquí se desconfía: una línea ilegible sale
 * nombrada y **no entra en ningún total** — la alternativa es un `NaN` en el
 * resultado del año.
 */
export function leerLineas(lineas: unknown): { validas: Map<string, number>; invalidas: string[] } {
  const validas = new Map<string, number>();
  const invalidas: string[] = [];
  if (!Array.isArray(lineas)) return { validas, invalidas };
  for (const bruta of lineas) {
    const linea = (bruta ?? {}) as Partial<LineaDelPresupuesto>;
    const code = typeof linea.accountCode === "string" && linea.accountCode ? linea.accountCode : null;
    if (!code) {
      invalidas.push("(sin código)");
      continue;
    }
    const amount = linea.amount;
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0 || validas.has(code)) {
      invalidas.push(code);
      continue;
    }
    validas.set(code, amount);
  }
  return { validas, invalidas };
}

export function compararPresupuesto(entrada: {
  cuentas: ReadonlyArray<CuentaDelPlan>;
  lineas: unknown;
  ejecutado: EjecutadoDelAnio;
}): ComparacionDelPresupuesto {
  const { validas, invalidas } = leerLineas(entrada.lineas);
  const invalidasSet = new Set(invalidas);
  const plan = new Map(entrada.cuentas.map((c) => [c.code, c]));
  const tipoDe = (code: string) => plan.get(code)?.type ?? tipoPorCodigo(code);

  const ejecutadoPor: Record<TipoDeCuenta, Map<string, { label: string; amount: number }>> = {
    ingreso: new Map(entrada.ejecutado.incomeByCategory.map((f) => [f.category, f])),
    egreso: new Map(entrada.ejecutado.expenseByCategory.map((f) => [f.category, f])),
  };

  const construir = (tipo: TipoDeCuenta): FilaDeComparacion[] => {
    const codigos = new Set<string>();
    for (const [code, fila] of ejecutadoPor[tipo]) if (fila.amount) codigos.add(code);
    for (const code of validas.keys()) if (tipoDe(code) === tipo) codigos.add(code);
    for (const code of invalidasSet) if (tipoDe(code) === tipo) codigos.add(code);

    return [...codigos].sort(compararCodigos).map((code) => {
      const ejecutadoFila = ejecutadoPor[tipo].get(code);
      const ejecutado = redondear(ejecutadoFila?.amount ?? 0);
      const invalida = invalidasSet.has(code) && !validas.has(code);
      const presupuestado = invalida ? null : validas.get(code) ?? null;
      const situacion: SituacionDeLaFila = invalida
        ? "importe_invalido"
        : presupuestado === null
          ? "sin_presupuestar"
          : presupuestado === 0
            ? "presupuestada_en_cero"
            : "presupuestada";

      let desviacion: Desviacion = null;
      if (!invalida && tipo === "egreso" && ejecutado > (presupuestado ?? 0)) desviacion = "sobre_ejecucion";
      if (!invalida && tipo === "ingreso" && presupuestado !== null && ejecutado < presupuestado) desviacion = "faltante";

      return {
        code,
        label: plan.get(code)?.name ?? ejecutadoFila?.label ?? code,
        tipo,
        presupuestado,
        ejecutado,
        diferencia: presupuestado === null ? null : redondear(ejecutado - presupuestado),
        porcentaje: presupuestado ? Math.round((ejecutado / presupuestado) * 1000) / 10 : null,
        situacion,
        desviacion,
      };
    });
  };

  let presupuestoIngresos = 0;
  let presupuestoEgresos = 0;
  for (const [code, amount] of validas) {
    const tipo = tipoDe(code);
    if (tipo === "ingreso") presupuestoIngresos += amount;
    if (tipo === "egreso") presupuestoEgresos += amount;
  }
  presupuestoIngresos = redondear(presupuestoIngresos);
  presupuestoEgresos = redondear(presupuestoEgresos);

  // `RN-02`: los totales ejecutados son los DEL ESTADO.
  const ejecutadoIngresos = redondear(entrada.ejecutado.totalIncome);
  const ejecutadoEgresos = redondear(entrada.ejecutado.totalExpenses);
  const resultadoPresupuestado = redondear(presupuestoIngresos - presupuestoEgresos);
  const resultadoEjecutado = redondear(ejecutadoIngresos - ejecutadoEgresos);

  return {
    ingresos: construir("ingreso"),
    egresos: construir("egreso"),
    totales: {
      ingresos: { presupuestado: presupuestoIngresos, ejecutado: ejecutadoIngresos },
      egresos: { presupuestado: presupuestoEgresos, ejecutado: ejecutadoEgresos },
      resultado: {
        presupuestado: resultadoPresupuestado,
        ejecutado: resultadoEjecutado,
        veredictoPresupuestado: veredicto(resultadoPresupuestado),
        veredictoEjecutado: veredicto(resultadoEjecutado),
      },
    },
    lineasInvalidas: invalidas,
  };
}

/**
 * Las cuentas del formulario: las activas con cuenta madre (`RN-05`: las raíces
 * son la suma), **más las desactivadas que ya tienen línea** — lo presupuestado
 * se respeta, y sin esto editar el borrador borraría esa línea en silencio.
 */
export function cuentasPresupuestables(
  cuentas: ReadonlyArray<CuentaDelPlan>,
  lineas: unknown = [],
): CuentaDelPlan[] {
  const conLinea = leerLineas(lineas).validas;
  return cuentas
    .filter((c) => c.parentCode && (c.status !== "inactive" || conLinea.has(c.code)))
    .sort((a, b) => compararCodigos(a.code, b.code));
}

/** Un año sin ningún movimiento no se compara (`RN-07`): un 0 % se leería como «nos sobró todo». */
export function anioSinMovimientos(ejecutado: Pick<EjecutadoDelAnio, "totalIncome" | "totalExpenses">): boolean {
  return !ejecutado.totalIncome && !ejecutado.totalExpenses;
}

/**
 * Cuánto del año ha transcurrido, contando el día de hoy. Es una referencia y no
 * un veredicto (`RN-08`). Se cuenta con las partes LOCALES de la fecha: con
 * `toISOString` el 1 de enero a las ocho de la noche en Quito ya es día 2 en UTC.
 */
export function porcentajeDelAnio(hoy: Date, anio: number): number {
  const y = hoy.getFullYear();
  if (anio < y) return 100;
  if (anio > y) return 0;
  const inicio = Date.UTC(y, 0, 1);
  const transcurrido = Date.UTC(y, hoy.getMonth(), hoy.getDate()) - inicio + 86_400_000;
  return Math.round((transcurrido / (Date.UTC(y + 1, 0, 1) - inicio)) * 100);
}

/**
 * Del formulario al documento. **Vacío no es cero** (`RN-03`): la cuenta vacía
 * no lleva línea, y un `0` tecleado sí.
 */
export function lineasDesdeFormulario(valores: Readonly<Record<string, string>>): {
  lineas: LineaDelPresupuesto[];
  errores: string[];
} {
  const lineas: LineaDelPresupuesto[] = [];
  const errores: string[] = [];
  for (const [code, bruto] of Object.entries(valores)) {
    const texto = bruto.trim();
    if (!texto) continue;
    const n = Number(texto);
    if (!Number.isFinite(n) || n < 0) {
      errores.push(code);
      continue;
    }
    lineas.push({ accountCode: code, amount: redondear(n) });
  }
  lineas.sort((a, b) => compararCodigos(a.accountCode, b.accountCode));
  errores.sort(compararCodigos);
  return { lineas, errores };
}

/** Del documento al formulario. Solo las líneas legibles. */
export function valoresDesdeLineas(lineas: unknown): Record<string, string> {
  const valores: Record<string, string> = {};
  for (const [code, amount] of leerLineas(lineas).validas) valores[code] = String(amount);
  return valores;
}
