import { describe, expect, it } from "vitest";

import {
  anioSinMovimientos,
  compararPresupuesto,
  cuentasPresupuestables,
  leerLineas,
  lineasDesdeFormulario,
  porcentajeDelAnio,
  valoresDesdeLineas,
  type CuentaDelPlan,
  type EjecutadoDelAnio,
} from "@/lib/finanzas/presupuesto";

/**
 * `PRD-V-FEAT-009` · la comparación, con números puestos a mano.
 *
 * Cada cifra esperada está calculada aquí, en el comentario, y no copiada de lo
 * que devuelve la función: una prueba que copia la salida consagra el defecto.
 */

const PLAN: CuentaDelPlan[] = [
  { code: "1", name: "Ingresos", type: "ingreso" },
  { code: "1.1", name: "Cuotas", type: "ingreso", parentCode: "1", status: "active" },
  { code: "1.3", name: "Zonas comunes", type: "ingreso", parentCode: "1", status: "active" },
  { code: "2", name: "Egresos", type: "egreso" },
  { code: "2.1", name: "Vigilancia", type: "egreso", parentCode: "2", status: "active" },
  { code: "2.3", name: "Mantenimiento", type: "egreso", parentCode: "2", status: "active" },
  { code: "2.10", name: "Jardinería", type: "egreso", parentCode: "2", status: "active" },
  { code: "2.4", name: "Papelería", type: "egreso", parentCode: "2", status: "inactive" },
];

// Lo que devolvería `useCommitteeReport`: filas por cajón y totales del estado.
const EJECUTADO: EjecutadoDelAnio = {
  incomeByCategory: [
    { category: "1.1", label: "Cuotas", amount: 9_000_000 },
    { category: "1.3", label: "Zonas comunes", amount: 250_000 },
  ],
  expenseByCategory: [
    { category: "2.1", label: "Vigilancia", amount: 4_800_000 },
    { category: "2.3", label: "Mantenimiento", amount: 1_500_000 },
    { category: "2.10", label: "Jardinería", amount: 300_000 },
  ],
  totalIncome: 9_250_000,
  totalExpenses: 6_600_000,
};

const PRESUPUESTO = [
  { accountCode: "1.1", amount: 12_000_000 },
  { accountCode: "2.1", amount: 4_800_000 },
  { accountCode: "2.3", amount: 1_200_000 },
];

describe("la comparación por cuenta", () => {
  const c = compararPresupuesto({ cuentas: PLAN, lineas: PRESUPUESTO, ejecutado: EJECUTADO });

  it("cuotas: 9.000.000 de 12.000.000 → −3.000.000, 75 %, y es un FALTANTE", () => {
    const cuotas = c.ingresos.find((f) => f.code === "1.1");
    expect(cuotas).toMatchObject({
      presupuestado: 12_000_000, ejecutado: 9_000_000, diferencia: -3_000_000,
      porcentaje: 75, situacion: "presupuestada", desviacion: "faltante",
    });
  });

  it("mantenimiento: 1.500.000 de 1.200.000 → +300.000, 125 %, SOBRE-EJECUCIÓN", () => {
    expect(c.egresos.find((f) => f.code === "2.3")).toMatchObject({
      diferencia: 300_000, porcentaje: 125, desviacion: "sobre_ejecucion",
    });
  });

  it("vigilancia exacta: 100 % y sin desviación", () => {
    expect(c.egresos.find((f) => f.code === "2.1")).toMatchObject({ porcentaje: 100, desviacion: null });
  });

  it("`CA4` · un egreso SIN presupuesto sale, se nombra, y es sobre-ejecución", () => {
    expect(c.egresos.find((f) => f.code === "2.10")).toMatchObject({
      presupuestado: null, ejecutado: 300_000, diferencia: null, porcentaje: null,
      situacion: "sin_presupuestar", desviacion: "sobre_ejecucion",
    });
  });

  it("un ingreso sin presupuesto sale, y NO es desviación: entró de más", () => {
    expect(c.ingresos.find((f) => f.code === "1.3")).toMatchObject({ situacion: "sin_presupuestar", desviacion: null });
  });

  it("`CA4` / `RN-02` · los totales ejecutados son los DEL ESTADO, con la cuenta sin presupuesto dentro", () => {
    // Si se sumaran solo las filas presupuestadas, egresos serían 4.800.000 + 1.500.000 = 6.300.000.
    expect(c.totales.egresos).toEqual({ presupuestado: 6_000_000, ejecutado: 6_600_000 });
    expect(c.totales.ingresos).toEqual({ presupuestado: 12_000_000, ejecutado: 9_250_000 });
  });

  it("`CA5` · resultado: presupuestado 12.000.000 − 6.000.000 = +6.000.000; ejecutado 9.250.000 − 6.600.000 = +2.650.000", () => {
    expect(c.totales.resultado).toEqual({
      presupuestado: 6_000_000, ejecutado: 2_650_000,
      veredictoPresupuestado: "superavit", veredictoEjecutado: "superavit",
    });
  });

  it("`CA5` · y el déficit se nombra como déficit", () => {
    const d = compararPresupuesto({
      cuentas: PLAN, lineas: PRESUPUESTO,
      ejecutado: { ...EJECUTADO, totalIncome: 5_000_000 },
    });
    // 5.000.000 − 6.600.000 = −1.600.000
    expect(d.totales.resultado).toMatchObject({ ejecutado: -1_600_000, veredictoEjecutado: "deficit" });
  });

  it("las filas van en el orden del plan: 2.10 detrás de 2.3, no delante", () => {
    expect(c.egresos.map((f) => f.code)).toEqual(["2.1", "2.3", "2.10"]);
  });

  it("una cuenta sin presupuesto ni movimiento no ocupa fila", () => {
    expect(c.egresos.find((f) => f.code === "2.4")).toBeUndefined();
  });
});

describe("`CA11` / `RN-03` · vacío no es cero", () => {
  it("un 0 tecleado con gasto es «presupuestado en cero», con diferencia y sin porcentaje", () => {
    const c = compararPresupuesto({
      cuentas: PLAN, lineas: [{ accountCode: "2.10", amount: 0 }], ejecutado: EJECUTADO,
    });
    expect(c.egresos.find((f) => f.code === "2.10")).toMatchObject({
      presupuestado: 0, diferencia: 300_000, porcentaje: null,
      situacion: "presupuestada_en_cero", desviacion: "sobre_ejecucion",
    });
  });

  it("el formulario: vacío NO lleva línea, y «0» sí", () => {
    expect(lineasDesdeFormulario({ "2.3": "", "2.10": "0", "2.1": "  " }).lineas).toEqual([
      { accountCode: "2.10", amount: 0 },
    ]);
  });
});

describe("`CA21` · un documento escrito saltándose el formulario", () => {
  const lineas = [
    { accountCode: "2.1", amount: "mucho" },
    { accountCode: "2.3", amount: -5 },
    { accountCode: "1.1", amount: 12_000_000 },
    { accountCode: "1.1", amount: 1 },
    { amount: 3 },
    { accountCode: "2.10", amount: Number.NaN },
  ];
  const c = compararPresupuesto({ cuentas: PLAN, lineas, ejecutado: EJECUTADO });

  it("nombra cada línea ilegible, y la repetida también", () => {
    expect(c.lineasInvalidas).toEqual(["2.1", "2.3", "1.1", "(sin código)", "2.10"]);
  });

  it("ningún total da NaN, y las ilegibles no suman", () => {
    const todos = [
      c.totales.ingresos.presupuestado, c.totales.egresos.presupuestado,
      c.totales.resultado.presupuestado, c.totales.resultado.ejecutado,
    ];
    for (const n of todos) expect(Number.isFinite(n)).toBe(true);
    expect(c.totales.egresos.presupuestado).toBe(0);
    // La primera línea de 1.1 vale; la repetida no pisa ni suma.
    expect(c.totales.ingresos.presupuestado).toBe(12_000_000);
  });

  it("la fila de una línea ilegible dice «importe inválido», no «sin presupuestar»", () => {
    expect(c.egresos.find((f) => f.code === "2.3")).toMatchObject({
      situacion: "importe_invalido", presupuestado: null, desviacion: null,
    });
  });

  it("un documento sin array de líneas no rompe nada", () => {
    expect(leerLineas({ "2.3": 5 })).toEqual({ validas: new Map(), invalidas: [] });
    expect(leerLineas(undefined).validas.size).toBe(0);
  });

  it("el formulario rechaza lo negativo y lo que no es número", () => {
    expect(lineasDesdeFormulario({ "2.3": "-1", "2.1": "abc", "2.10": "1500.555" })).toEqual({
      lineas: [{ accountCode: "2.10", amount: 1500.56 }],
      errores: ["2.1", "2.3"],
    });
  });
});

describe("las cuentas del formulario", () => {
  it("`RN-05` · sin raíces, y ordenadas por el plan", () => {
    expect(cuentasPresupuestables(PLAN).map((c) => c.code)).toEqual(["1.1", "1.3", "2.1", "2.3", "2.10"]);
  });

  it("una cuenta DESACTIVADA con línea se conserva — si no, editar la borraría en silencio", () => {
    const codigos = cuentasPresupuestables(PLAN, [{ accountCode: "2.4", amount: 80_000 }]).map((c) => c.code);
    expect(codigos).toContain("2.4");
  });

  it("ida y vuelta: las líneas legibles vuelven al formulario tal cual", () => {
    expect(valoresDesdeLineas(PRESUPUESTO)).toEqual({ "1.1": "12000000", "2.1": "4800000", "2.3": "1200000" });
  });
});

describe("`RN-07` y `RN-08` · el año", () => {
  it("un año sin movimientos se reconoce como tal", () => {
    expect(anioSinMovimientos({ totalIncome: 0, totalExpenses: 0 })).toBe(true);
    expect(anioSinMovimientos({ totalIncome: 0, totalExpenses: 1 })).toBe(false);
  });

  it("el 10 de septiembre de 2026 es el día 253 de 365 → 69 %", () => {
    // 31+28+31+30+31+30+31+31 = 243 días hasta el 31 de agosto, más 10 = 253. 253/365 = 0,693.
    expect(porcentajeDelAnio(new Date(2026, 8, 10, 22, 30), 2026)).toBe(69);
  });

  it("el 1 de enero por la noche sigue siendo el día 1, no el 2", () => {
    // 1/365 = 0,27 % → 0. Con la fecha en UTC, desde Quito, ya sería el día 2.
    expect(porcentajeDelAnio(new Date(2026, 0, 1, 23, 0), 2026)).toBe(0);
  });

  it("el año anterior está completo y el siguiente no ha empezado", () => {
    expect(porcentajeDelAnio(new Date(2026, 8, 10), 2025)).toBe(100);
    expect(porcentajeDelAnio(new Date(2026, 8, 10), 2027)).toBe(0);
  });
});
