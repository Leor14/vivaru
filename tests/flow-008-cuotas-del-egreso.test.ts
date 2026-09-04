import { describe, expect, it } from "vitest";

import {
  envejecerEgreso,
  explicarProblema,
  fundirPlan,
  pagadoDelEgreso,
  proximaCuota,
  sumaDelPlan,
  validarPlan,
} from "@/features/finanzas/cuotas-del-egreso";
import { projectCashFlow as proyectarFlujo } from "@/features/finanzas/cashflow-projection";
import { summarizePayables } from "@/features/finanzas/payables";
import { pendienteDelEgreso, sumarDeudaAProveedores } from "@/lib/finanzas/nucleo-estado-financiero";
import type { Expense, Installment } from "@/types/domain";

/**
 * `PRD-V-FLOW-008` entrega 1 — el calendario de cuotas.
 *
 * **Los números van escritos a mano**, no derivados de la función que se prueba:
 * un banco que calcula el esperado con el código que vigila pasa siempre.
 *
 * El caso que recorre casi todo es **el de verdad**: la póliza del seguro que la
 * administradora paga en **once cuotas**, y que hoy está en producción registrada
 * como un solo pago.
 */

const cuota = (n: number, dueDate: string, amount: number, status: Installment["status"] = "pendiente"): Installment =>
  ({ number: n, dueDate, amount, status });

/** La póliza: 1.100 en once cuotas de 100, de enero a noviembre. */
const once = Array.from({ length: 11 }, (_, i) =>
  cuota(i + 1, `2026-${String(i + 1).padStart(2, "0")}-15`, 100),
);

const egreso = (extra: Partial<Expense>): Expense =>
  ({
    id: "e1",
    tenantId: "t1",
    category: "seguros",
    description: "Póliza de seguro del inmueble",
    amount: 1_100,
    issueDate: "2026-01-02",
    status: "registrado",
    ...extra,
  }) as Expense;

// ── RN-01 · el plan suma la factura ──────────────────────────────────────────

describe("validarPlan — `RN-01`, la suma es el total", () => {
  it("once cuotas de 100 cuadran con una factura de 1.100", () => {
    expect(validarPlan(once, 1_100)).toEqual([]);
  });

  it("`CA1` · si no cuadra, DICE la diferencia y no solo que está mal", () => {
    // Once de 99 = 1.089. Faltan 11, y el mensaje tiene que nombrarlos.
    const plan = once.map((c) => ({ ...c, amount: 99 }));
    const problemas = validarPlan(plan, 1_100);
    expect(problemas).toEqual([{ tipo: "no_cuadra", diferencia: 11 }]);
    expect(explicarProblema(problemas[0], (n) => `$${n}`)).toBe(
      "Las cuotas no suman el total de la factura: faltan $11.",
    );
  });

  it("y también dice cuánto SOBRA, que es el error simétrico", () => {
    const plan = once.map((c) => ({ ...c, amount: 101 }));
    const problemas = validarPlan(plan, 1_100);
    expect(problemas).toEqual([{ tipo: "no_cuadra", diferencia: -11 }]);
    expect(explicarProblema(problemas[0], (n) => `$${n}`)).toContain("sobran $11");
  });

  /**
   * **El residuo de coma flotante, que en `FLOW-007` sí llegó a fallar de verdad.**
   * Once cuotas de 100,01 suman 1100,1099999… en binario. Comparar los crudos
   * rechazaría un plan correcto, y con COP —seis de los nueve conjuntos— esto
   * sería invisible hasta que alguien usara MXN o USD.
   */
  it("no rechaza un plan correcto por un residuo de coma flotante", () => {
    const plan = once.map((c) => ({ ...c, amount: 100.01 }));
    expect(validarPlan(plan, 1_100.11)).toEqual([]);
  });

  it("las cuotas ANULADAS no cuentan para la suma", () => {
    const plan = [...once.slice(0, 10), cuota(11, "2026-11-15", 100, "anulada")];
    // Quedan diez vivas: la factura que cuadra es de 1.000.
    expect(sumaDelPlan(plan)).toBe(1_000);
    expect(validarPlan(plan, 1_000)).toEqual([]);
  });
});

// ── RN-02 y RN-03 · la forma del plan ────────────────────────────────────────

describe("validarPlan — `CA2`, los cuatro casos que DEBEN FALLAR", () => {
  it("un plan VACÍO no es un plan", () => {
    expect(validarPlan([], 1_100)).toEqual([{ tipo: "vacio" }]);
  });

  it("cero cuotas NO se cuela por «cuadrar»: sobre lista vacía todo cuadra", () => {
    // El caso que motiva comprobar lo vacío PRIMERO: con total 0 y cero cuotas,
    // la suma coincide y un validador ingenuo daría el plan por bueno.
    expect(validarPlan([], 0)).toEqual([{ tipo: "vacio" }]);
  });

  it("números REPETIDOS: rechazado", () => {
    const plan = [cuota(1, "2026-01-15", 550), cuota(1, "2026-02-15", 550)];
    expect(validarPlan(plan, 1_100)).toContainEqual({ tipo: "numeracion" });
  });

  it("números con SALTO: rechazado", () => {
    const plan = [cuota(1, "2026-01-15", 550), cuota(3, "2026-02-15", 550)];
    expect(validarPlan(plan, 1_100)).toContainEqual({ tipo: "numeracion" });
  });

  it("una cuota SIN vencimiento: rechazado, y dice cuál", () => {
    const plan = [cuota(1, "2026-01-15", 550), cuota(2, "", 550)];
    expect(validarPlan(plan, 1_100)).toContainEqual({ tipo: "sin_vencimiento", numeros: [2] });
  });

  it("una cuota de importe cero o negativo: rechazado", () => {
    const plan = [cuota(1, "2026-01-15", 1_100), cuota(2, "2026-02-15", 0)];
    expect(validarPlan(plan, 1_100)).toContainEqual({ tipo: "importe_no_positivo", numeros: [2] });
  });

  it("devuelve TODOS los problemas a la vez, no el primero", () => {
    // Quien teclea once filas prefiere verlos juntos.
    const plan = [cuota(1, "", 0), cuota(3, "2026-02-15", 0)];
    expect(validarPlan(plan, 1_100).map((p) => p.tipo).sort()).toEqual([
      "importe_no_positivo",
      "no_cuadra",
      "numeracion",
      "sin_vencimiento",
    ]);
  });

  it("una sola cuota es un plan válido — equivale a un egreso con vencimiento", () => {
    expect(validarPlan([cuota(1, "2026-01-15", 1_100)], 1_100)).toEqual([]);
  });
});

// ── RN-09 · LA CORRECCIÓN DE FLOW-007 ────────────────────────────────────────

describe("`CA8` · la deuda a proveedores es LO QUE FALTA", () => {
  it("una factura de 1.100 con 5 cuotas de 100 pagadas debe 600, no 1.100", () => {
    const conPlan = egreso({
      paidAmount: 500,
      installments: once.map((c) => (c.number <= 5 ? { ...c, status: "pagada" as const } : c)),
    });
    // A mano: 1.100 − 500 = 600. Antes de esta ficha habría dicho 1.100.
    expect(pendienteDelEgreso(conPlan)).toBe(600);
    expect(sumarDeudaAProveedores([conPlan])).toBe(600);
  });

  it("`CA10` · un egreso SIN plan sigue debiendo el importe completo", () => {
    const sinPlan = egreso({});
    expect(pendienteDelEgreso(sinPlan)).toBe(1_100);
    expect(sumarDeudaAProveedores([sinPlan])).toBe(1_100);
  });

  /**
   * **El caso que la entrega 1 resolvía MAL, medido antes de escribir el pago.**
   *
   * El proveedor perdona lo que queda: cinco cuotas pagadas y seis anuladas, y la
   * factura sigue `registrado`. Con `amount − paidAmount` esto decía **600 de
   * deuda que ya nadie debe**. La deuda de una factura con plan son **sus cuotas
   * vivas**, que además es la fuente de verdad y no un acumulado que mantener.
   */
  it("anular cuotas SIN anular la factura deja de deber lo anulado", () => {
    const perdonada = egreso({
      paidAmount: 500,
      installments: once.map((c) => ({ ...c, status: c.number <= 5 ? ("pagada" as const) : ("anulada" as const) })),
    });
    expect(pendienteDelEgreso(perdonada)).toBe(0);
    expect(sumarDeudaAProveedores([perdonada])).toBe(0);
  });

  it("un egreso `pagado` o `anulado` no debe nada, con plan o sin él", () => {
    expect(sumarDeudaAProveedores([egreso({ status: "pagado" })])).toBe(0);
    expect(sumarDeudaAProveedores([egreso({ status: "anulado", paidAmount: 200 })])).toBe(0);
  });

  /**
   * **Se topa en cero POR EGRESO, no al final.** Si un `paidAmount` corrupto
   * superara al importe, ese egreso restaría deuda y **taparía la de otro
   * proveedor** — el conjunto vería menos deuda de la que tiene. Es el mismo
   * topado por documento que `sumarCuentasPorCobrar` hace con el sobrepago.
   */
  it("un `paidAmount` mayor que el importe NO resta deuda de otros", () => {
    const corrupto = egreso({ id: "malo", amount: 100, paidAmount: 5_000 });
    const normal = egreso({ id: "bueno", amount: 900 });
    expect(pendienteDelEgreso(corrupto)).toBe(0);
    expect(sumarDeudaAProveedores([corrupto, normal])).toBe(900);
  });
});

// ── El envejecimiento por cuota ──────────────────────────────────────────────

describe("envejecerEgreso — el vencimiento va POR CUOTA", () => {
  const HOY = "2026-04-01";
  const CORTE = "2026-05-01"; // horizonte de 30 días

  it("la póliza tiene tres cuotas vencidas y una próxima, no 1.100 de un lado", () => {
    const e = egreso({ installments: once });
    // Vencidas: enero, febrero y marzo (15 de cada uno) = 300.
    // Próxima: la del 15 de abril = 100. Las de mayo en adelante, ni una cosa ni otra.
    expect(envejecerEgreso(e, HOY, CORTE)).toEqual({ vencido: 300, proximo: 100 });
  });

  it("una cuota PAGADA deja de vencer, y una ANULADA deja de existir", () => {
    const plan = once.map((c) =>
      c.number === 1 ? { ...c, status: "pagada" as const }
      : c.number === 2 ? { ...c, status: "anulada" as const }
      : c,
    );
    // Solo queda vencida la de marzo.
    expect(envejecerEgreso(egreso({ installments: plan }), HOY, CORTE)).toEqual({ vencido: 100, proximo: 100 });
  });

  it("`CA10` · SIN plan se comporta igual que hasta hoy: manda el `dueDate` del egreso", () => {
    expect(envejecerEgreso(egreso({ dueDate: "2026-03-01" }), HOY, CORTE)).toEqual({ vencido: 1_100, proximo: 0 });
    expect(envejecerEgreso(egreso({ dueDate: "2026-04-20" }), HOY, CORTE)).toEqual({ vencido: 0, proximo: 1_100 });
    expect(envejecerEgreso(egreso({ dueDate: "2026-12-01" }), HOY, CORTE)).toEqual({ vencido: 0, proximo: 0 });
  });

  it("SIN vencimiento no cuenta en ninguno de los dos: no se sabe cuándo vencía", () => {
    // Es el caso de 32 de los 52 egresos de producción.
    expect(envejecerEgreso(egreso({}), HOY, CORTE)).toEqual({ vencido: 0, proximo: 0 });
  });

  it("un egreso que ya no es deuda no envejece", () => {
    expect(envejecerEgreso(egreso({ status: "pagado", installments: once }), HOY, CORTE)).toEqual({ vencido: 0, proximo: 0 });
  });
});

describe("proximaCuota — la que toca pagar", () => {
  it("es la más ANTIGUA sin pagar, no la siguiente por número", () => {
    // Se pagó la 5 antes que la 3: la vida real no siempre paga en orden.
    const plan = once.map((c) => (c.number <= 2 || c.number === 5 ? { ...c, status: "pagada" as const } : c));
    expect(proximaCuota(plan)?.number).toBe(3);
  });

  it("sin cuotas pendientes no hay próxima", () => {
    expect(proximaCuota(once.map((c) => ({ ...c, status: "pagada" as const })))).toBeUndefined();
    expect(proximaCuota(undefined)).toBeUndefined();
  });
});

// ── La tarjeta de Cartera ────────────────────────────────────────────────────

describe("summarizePayables — el total y el desglose NO pueden discrepar", () => {
  const HOY = "2026-04-01";

  it("`CA13` · cuenta lo vencido por cuota y el total es lo pendiente", () => {
    const conPlan = egreso({
      paidAmount: 200,
      installments: once.map((c) => (c.number <= 2 ? { ...c, status: "pagada" as const } : c)),
    });
    const r = summarizePayables([conPlan], { asOf: HOY });
    expect(r.totalPayable).toBe(900);      // 1.100 − 200, a mano
    expect(r.overdue).toBe(100);           // solo la de marzo sigue vencida
    expect(r.dueSoon).toBe(100);           // la del 15 de abril
  });

  /**
   * **La comprobación que importa de verdad**, y la misma que salvó al informe
   * mensual: el total y las filas salen de sitios distintos, así que podrían
   * discrepar — y entonces la tarjeta se contradiría consigo misma, que es peor
   * que estar mal.
   */
  it("las categorías SUMAN el total que la tarjeta imprime al lado", () => {
    const gastos = [
      // **Coherente a propósito**: cinco cuotas `pagada` Y `paidAmount: 500`. La
      // versión anterior de este caso llevaba el acumulado sin marcar ninguna
      // cuota, y la regla vieja —`amount − paidAmount`— lo daba por bueno. La
      // nueva no, porque deriva de las cuotas: **destapó su propio fixture**.
      egreso({
        id: "a",
        category: "seguros",
        amount: 1_100,
        paidAmount: 500,
        installments: once.map((c) => (c.number <= 5 ? { ...c, status: "pagada" as const } : c)),
      }),
      egreso({ id: "b", category: "nomina", amount: 2_000 }),
      egreso({ id: "c", category: "nomina", amount: 500, status: "pagado" }),
    ];
    const r = summarizePayables(gastos, { asOf: HOY });
    const suma = r.byCategory.reduce((a, c) => a + c.amount, 0);
    expect(suma).toBe(r.totalPayable);
    expect(r.totalPayable).toBe(2_600); // 600 + 2.000, a mano
  });
});

/**
 * **`CA11` · con la bandera APAGADA nada cambia — y el mecanismo importa.**
 *
 * La bandera gobierna **poder declarar un plan**, no la aritmética. La corrección
 * de `pendienteDelEgreso` corre siempre, **a propósito y como en `FLOW-007`**: allí
 * el arreglo del aviso falso de «Fondo insuficiente» tampoco fue detrás de bandera,
 * porque revertir una cifra a la versión equivocada es volver a mentir.
 *
 * Lo que hace que eso sea seguro es que **sin plan no hay `paidAmount`**: nadie lo
 * escribe hasta la entrega 2, y sin la bandera no se puede ni declarar el plan. Con
 * los datos de producción de hoy —52 egresos, ninguno con plan— las cifras salen
 * idénticas. Esta prueba es lo que lo sostiene.
 */
describe("`CA11` · sobre los datos de HOY, la cifra no se mueve", () => {
  /** Los 13 egresos que hoy son deuda en producción, en su forma real: sin plan. */
  const comoEnProduccion: Expense[] = [
    egreso({ id: "1", category: "mantenimiento", amount: 1_600, dueDate: "2026-07-31" }),
    egreso({ id: "2", category: "servicios_publicos", amount: 9_950, dueDate: "2026-07-05" }),
    egreso({ id: "3", category: "mantenimiento", amount: 7_800, dueDate: "2026-07-10" }),
    egreso({ id: "4", category: "administracion", amount: 12_000, dueDate: "2026-07-06" }),
    egreso({ id: "5", category: "seguros", amount: 3_400, dueDate: "2026-07-13" }),
    // Ocho de los trece NO tienen vencimiento. Es el dato medido, no un supuesto.
    egreso({ id: "6", category: "servicios_publicos", amount: 640_000 }),
    egreso({ id: "7", category: "mantenimiento", amount: 900_000 }),
    egreso({ id: "8", category: "servicios_publicos", amount: 1_250_000 }),
    egreso({ id: "9", category: "vigilancia", amount: 2_100_000 }),
    egreso({ id: "10", category: "servicios_publicos", amount: 640_000 }),
    egreso({ id: "11", category: "mantenimiento", amount: 900_000 }),
    egreso({ id: "12", category: "servicios_publicos", amount: 1_250_000 }),
    egreso({ id: "13", category: "vigilancia", amount: 2_100_000 }),
  ];

  it("la deuda a proveedores sigue siendo la suma de los importes completos", () => {
    // 9.814.750, la cifra medida en producción el 4 de septiembre de 2026.
    expect(sumarDeudaAProveedores(comoEnProduccion)).toBe(9_814_750);
  });

  it("y ningún egreso sin plan aporta un `paidAmount` que la mueva", () => {
    // El invariante que hace segura la corrección: sin plan no hay pagado.
    for (const e of comoEnProduccion) {
      expect(e.installments).toBeUndefined();
      expect(pendienteDelEgreso(e)).toBe(e.amount);
    }
  });

  it("los ocho SIN vencimiento no envejecen: no se sabe cuándo vencían", () => {
    const sinVencimiento = comoEnProduccion.filter((e) => !e.dueDate);
    expect(sinVencimiento).toHaveLength(8);
    const r = summarizePayables(sinVencimiento, { asOf: "2026-09-04" });
    expect(r.overdue).toBe(0);
    expect(r.dueSoon).toBe(0);
    // Pero SÍ cuentan como deuda: no vencer no es no deber.
    expect(r.totalPayable).toBe(9_780_000);
  });
});

/**
 * **LOS DOS DUPLICADORES QUE LA FICHA NO CONTÓ.**
 *
 * §11 decía que la cifra de deuda «la consumen TRES sitios y los tres llaman a la
 * misma función». Al pagar una cuota de verdad en staging apareció un **cuarto**
 * —la tarjeta «Por pagar» de la pantalla de Egresos— que **no llamaba a la
 * función: la duplicaba** con un bucle propio sobre `item.amount`. Y buscando el
 * concepto en vez del nombre salió un **quinto**: la proyección de flujo de caja.
 *
 * **La lección de método:** buscar *quién llama* a una función encuentra sus
 * consumidores, **no quién la reimplementa sin llamarla**. Para eso hay que
 * buscar el CONCEPTO —aquí, «sumar `amount` filtrando por `status`»—. Es
 * «buscar por nombre miente» en la dirección de dar cero para algo que sí existe.
 */
describe("los duplicadores de la deuda, que ahora derivan de lo mismo", () => {
  const HOY = "2026-04-01";
  const conPlan = egreso({
    amount: 1_100,
    paidAmount: 100,
    installments: once.map((c) => (c.number === 1 ? { ...c, status: "pagada" as const } : c)),
  });

  it("`pagadoDelEgreso` cuenta el pago PARCIAL de una factura en `registrado`", () => {
    // El bucle viejo sumaba solo los egresos `pagado`, así que esta factura
    // —diez cuotas por pagar, una saldada— contaba CERO como pagado.
    expect(pagadoDelEgreso(conPlan)).toBe(100);
    expect(pagadoDelEgreso(egreso({ status: "pagado" }))).toBe(1_100);
    expect(pagadoDelEgreso(egreso({}))).toBe(0);
    expect(pagadoDelEgreso(egreso({ status: "anulado", paidAmount: 300 }))).toBe(0);
  });

  it("la tarjeta «Por pagar» baja al pagar una cuota: 1.100 → 1.000", () => {
    // Es exactamente lo que NO pasaba en staging antes de este arreglo.
    expect(pendienteDelEgreso(conPlan)).toBe(1_000);
  });

  it("la proyección de caja cuenta solo las CUOTAS de la ventana, no la factura", () => {
    // A 30 días desde el 1 de abril: vencidas enero, febrero y marzo (la 1 está
    // pagada, así que quedan 2 y 3 = 200) más la del 15 de abril = 100.
    const r = proyectarFlujo([], [conPlan], { asOf: HOY, horizons: [30] });
    expect(r.horizons[0].outflow).toBe(300);
  });

  it("y sin plan la proyección se comporta EXACTAMENTE como antes", () => {
    const sinPlan = egreso({ dueDate: "2026-04-10" });
    expect(proyectarFlujo([], [sinPlan], { asOf: HOY, horizons: [30] }).horizons[0].outflow).toBe(1_100);
    // Fuera de la ventana, nada.
    const lejos = egreso({ dueDate: "2026-12-10" });
    expect(proyectarFlujo([], [lejos], { asOf: HOY, horizons: [30] }).horizons[0].outflow).toBe(0);
  });
});

/**
 * **EL DEFECTO QUE MÁS CERCA ESTUVO DE COSTAR DINERO, y lo cazó la pantalla.**
 *
 * Editar la descripción de una factura **deshacía sus pagos**. El formulario carga
 * las cuotas quedándose con número, fecha e importe —no reenvía lo que sella el
 * servidor—, así que al guardar sobrescribía el array y una cuota `pagada` volvía
 * a `pendiente`. Medido en staging: **`paidAmount: 100`, cero cuotas pagadas, y el
 * asiento del libro HUÉRFANO**.
 *
 * **La regla de Firestore no podía impedirlo: no itera listas** (`R8`). Por eso el
 * cuidado vive donde sí se conoce lo que había.
 */
describe("fundirPlan — editar el egreso NO puede deshacer un pago", () => {
  const guardadas: Installment[] = [
    { ...cuota(1, "2026-01-15", 100), status: "pagada", paidAt: "2026-09-04", paidBy: "admin-1", ledgerEntryId: "asiento-1" },
    { ...cuota(2, "2026-02-15", 100), status: "anulada", voidReason: "El proveedor la perdonó." },
    cuota(3, "2026-03-15", 100),
  ];
  const delFormulario = [
    { number: 1, dueDate: "2026-01-15", amount: 100 },
    { number: 2, dueDate: "2026-02-15", amount: 100 },
    { number: 3, dueDate: "2026-03-15", amount: 100 },
  ];

  it("una cuota PAGADA sobrevive entera, con su asiento", () => {
    const r = fundirPlan(guardadas, delFormulario)!;
    expect(r[0]).toEqual(guardadas[0]);
    expect(r[0].ledgerEntryId).toBe("asiento-1");
  });

  it("una cuota ANULADA conserva su motivo", () => {
    expect(fundirPlan(guardadas, delFormulario)![1]).toEqual(guardadas[1]);
  });

  it("las PENDIENTES sí se editan: es lo que sustituye al pago parcial", () => {
    const r = fundirPlan(guardadas, [...delFormulario.slice(0, 2), { number: 3, dueDate: "2026-03-31", amount: 250 }])!;
    expect(r[2]).toEqual({ number: 3, dueDate: "2026-03-31", amount: 250, status: "pendiente" });
  });

  it("`RN-07` · cambiar el importe de una PAGADA no la mueve", () => {
    const r = fundirPlan(guardadas, [{ number: 1, dueDate: "2030-01-01", amount: 99_999 }])!;
    expect(r[0].amount).toBe(100);
    expect(r[0].dueDate).toBe("2026-01-15");
  });

  it("una cuota pagada NO se borra aunque el formulario ya no la traiga", () => {
    // Quitar la fila 1 en la pantalla no puede borrar un pago del libro.
    const r = fundirPlan(guardadas, [delFormulario[2]])!;
    expect(r.map((c) => c.number)).toEqual([1, 2, 3]);
    expect(r.find((c) => c.number === 1)!.status).toBe("pagada");
  });

  it("quitar el plan entero solo se puede si no hay nada pagado ni anulado", () => {
    expect(fundirPlan([cuota(1, "2026-01-15", 100)], undefined)).toBeNull();
    // Con algo sellado, el plan se conserva.
    expect(fundirPlan(guardadas, undefined)).toHaveLength(2);
  });

  it("un egreso sin plan sigue sin plan", () => {
    expect(fundirPlan(undefined, undefined)).toBeNull();
  });

  it("y la deuda después de fundir es la correcta: solo la cuota 3", () => {
    const r = fundirPlan(guardadas, delFormulario)!;
    expect(pendienteDelEgreso({ amount: 300, paidAmount: 100, installments: r })).toBe(100);
  });
});
