import { describe, expect, it } from "vitest";

import {
  aplicarAjustes,
  avisoDelSobrante,
  motivoDeNoCuadrar,
  deudaDelCargo,
  repartoCuadra,
  type CargoParaReparto,
} from "@/features/billing/reparto";
import { saldoAFavor, crucesVigentes } from "@/features/finanzas/use-advances";
import type { Advance, AdvanceApplication } from "@/types/domain";

const cargo = (over: Partial<CargoParaReparto> & { id: string }): CargoParaReparto => ({
  amount: 0,
  paymentAmount: 0,
  advanceAppliedAmount: 0,
  ...over,
});

/**
 * **Lo que queda del reparto en el cliente.** R7 —el orden y la aritmética de la
 * propuesta— se mudó al servidor el 24 de agosto de 2026 (§11.3), y sus pruebas
 * viven ahora en `functions/tests/reparto-r7.test.ts`. Aquí solo lo que es de la
 * pantalla: qué cargos ofrecer, y validar lo que el administrador editó a mano.
 */
describe("deudaDelCargo — qué cargos ofrecer, y cuánto debe cada uno", () => {
  it("descuenta lo pagado", () => {
    expect(deudaDelCargo(cargo({ id: "a", amount: 140_000, paymentAmount: 40_000 }))).toBe(100_000);
  });

  /**
   * R4. Lo cubierto con anticipos NO está en `paymentAmount` y sí salda. Si esta
   * resta se hubiera escrito a mano, un cargo saldado con anticipo se seguiría
   * ofreciendo como pendiente.
   */
  it("lo cubierto con un anticipo cruzado también salda", () => {
    expect(deudaDelCargo(cargo({ id: "a", amount: 140_000, advanceAppliedAmount: 140_000 }))).toBe(0);
    expect(
      deudaDelCargo(cargo({ id: "a", amount: 140_000, paymentAmount: 40_000, advanceAppliedAmount: 60_000 })),
    ).toBe(40_000);
  });

  it("nunca es negativa: un sobrepago viejo no genera deuda al revés", () => {
    expect(deudaDelCargo(cargo({ id: "a", amount: 100_000, paymentAmount: 150_000 }))).toBe(0);
  });
});

describe("avisoDelSobrante — la pantalla no puede anunciar lo que todavía no sabe", () => {
  /**
   * **REPRO del defecto que motiva esta función.** El sobrante se calcula contra
   * la propuesta del servidor, y antes de que llegue la lista está VACÍA, así que
   * el sobrante es el importe entero. Al abrir el cobro, durante el viaje de red,
   * la pantalla anunciaba que el pago completo quedaría como saldo a favor.
   */
  it("mientras la propuesta no ha llegado NO anuncia sobrante, aunque el sobrante sea todo", () => {
    expect(avisoDelSobrante({ estado: "pendiente", sobrante: 140_000, seraAnticipo: true, vaPorReparto: false }))
      .toEqual({ tipo: "calculando" });
  });

  /** Y si la llamada falla, `sugerido` se quedaba vacío para siempre con el aviso puesto. */
  it("si la propuesta falla lo dice, en vez de dejar el aviso viejo colgado", () => {
    expect(avisoDelSobrante({ estado: "error", sobrante: 140_000, seraAnticipo: true, vaPorReparto: false }))
      .toEqual({ tipo: "error" });
  });

  /**
   * **La contraparte imprescindible: una propuesta vacía RECIBIDA sí anuncia.**
   * Es CA8 —un pago sin cargos pendientes se convierte íntegro en anticipo—, y es
   * exactamente por lo que «la lista está vacía» no servía como señal.
   */
  it("recibida y vacía sí anuncia: es CA8, no es que no haya llegado", () => {
    expect(avisoDelSobrante({ estado: "recibida", sobrante: 140_000, seraAnticipo: true, vaPorReparto: false }))
      .toEqual({ tipo: "a-favor", sobrante: 140_000 });
  });

  it("sin sobrante no dice nada", () => {
    expect(avisoDelSobrante({ estado: "recibida", sobrante: 0, seraAnticipo: true, vaPorReparto: false }))
      .toEqual({ tipo: "ninguno" });
  });

  it("con anticipos apagados y un solo cargo, el sobrante va contra el cargo", () => {
    expect(avisoDelSobrante({ estado: "recibida", sobrante: 60_000, seraAnticipo: false, vaPorReparto: false }))
      .toEqual({ tipo: "contra-el-cargo", sobrante: 60_000 });
  });

  /** Con anticipos apagados y reparto, el servidor lo rechaza: no hay dónde guardarlo. */
  it("con anticipos apagados y reparto, avisa de que no hay destino", () => {
    expect(avisoDelSobrante({ estado: "recibida", sobrante: 60_000, seraAnticipo: false, vaPorReparto: true }))
      .toEqual({ tipo: "sin-destino", sobrante: 60_000 });
  });
});

describe("aplicarAjustes — lo escrito a mano encima de lo que propuso el servidor", () => {
  const sugerido = [
    { statementId: "junio", amount: 100_000 },
    { statementId: "julio", amount: 50_000 },
  ];

  it("sin ajustes devuelve la propuesta tal cual", () => {
    expect(aplicarAjustes(sugerido, 150_000, {})).toEqual({ lineas: sugerido, sobrante: 0 });
  });

  /**
   * **Una casilla vacía no es un cero: significa «deja la sugerencia».**
   * Tratarla como cero borraría la línea en cuanto alguien seleccionara y
   * borrara el contenido para reescribirlo, y el dinero de esa cuota se iría al
   * sobrante sin que nadie lo pidiera.
   */
  it("una casilla vacía deja la sugerencia, no la pone a cero", () => {
    const r = aplicarAjustes(sugerido, 150_000, { junio: "", julio: "   " });
    expect(r.lineas).toEqual(sugerido);
    expect(r.sobrante).toBe(0);
  });

  it("un ajuste manda sobre la sugerencia, y lo que libera queda a favor", () => {
    const r = aplicarAjustes(sugerido, 150_000, { junio: "20000" });
    expect(r.lineas).toEqual([
      { statementId: "junio", amount: 20_000 },
      { statementId: "julio", amount: 50_000 },
    ]);
    // **No se reparte solo al siguiente cargo**: queda como sobrante, que es lo
    // que el servidor va a hacer con ello.
    expect(r.sobrante).toBe(80_000);
  });

  it("un ajuste que se pasa deja el sobrante en cero, no en negativo", () => {
    const r = aplicarAjustes([{ statementId: "junio", amount: 50_000 }], 50_000, { junio: "90000" });
    expect(r.sobrante).toBe(0);
    expect(repartoCuadra(r.lineas, 50_000)).toBe(false);
  });

  /**
   * **REPRO — el ajuste de un cargo SIN línea propuesta.** La pantalla pinta la
   * casilla para **todo** cargo marcado, tenga línea o no —cuando el importe se
   * agotó en los anteriores no la hay—, así que escribir ahí es un gesto que el
   * producto ofrece. Y `aplicarAjustes` recorre `sugerido`: lo escrito sobre un
   * cargo que no está en la propuesta **no aparece en `lineas`**, así que se
   * acepta en pantalla y se tira al enviar.
   */
  it("un ajuste sobre un cargo que la propuesta no incluye TIENE que viajar", () => {
    const r = aplicarAjustes(sugerido, 200_000, { agosto: "40000" });
    expect(r.lineas).toEqual([
      { statementId: "junio", amount: 100_000 },
      { statementId: "julio", amount: 50_000 },
      { statementId: "agosto", amount: 40_000 },
    ]);
    expect(r.sobrante).toBe(10_000);
  });

  /** Una casilla vacía sobre un cargo sin línea sigue sin crear línea: no es un cero. */
  it("una casilla vacía sobre un cargo sin línea no inventa una línea", () => {
    const r = aplicarAjustes(sugerido, 150_000, { agosto: "   " });
    expect(r.lineas).toEqual(sugerido);
    expect(r.sobrante).toBe(0);
  });

  /** Ni un cero: el servidor rechaza toda línea que no sea mayor que cero. */
  it("un cero sobre un cargo sin línea tampoco crea línea", () => {
    const r = aplicarAjustes(sugerido, 150_000, { agosto: "0" });
    expect(r.lineas).toEqual(sugerido);
  });

  it("basura escrita en la casilla vale cero y queda detectable por repartoCuadra", () => {
    const r = aplicarAjustes([{ statementId: "junio", amount: 100_000 }], 100_000, { junio: "abc" });
    expect(r.lineas).toEqual([{ statementId: "junio", amount: 0 }]);
    expect(repartoCuadra(r.lineas, 100_000)).toBe(false);
  });
});

describe("repartoCuadra — CF5", () => {
  it("rechaza un reparto que se pasa del importe", () => {
    expect(repartoCuadra([{ statementId: "a", amount: 120 }], 100)).toBe(false);
  });

  /**
   * **La suma PUEDE ser menor, y esto es la mitad que se escribe mal.** La
   * diferencia es sobrante y se convierte en anticipo (R2). Exigir igualdad
   * exacta dejaría al administrador sin poder repartir 100 entre dos cargos de
   * 30 dejando 40 a favor, que es un caso normal.
   */
  it("acepta que sume MENOS: la diferencia es anticipo", () => {
    expect(repartoCuadra([{ statementId: "a", amount: 30 }, { statementId: "b", amount: 30 }], 100)).toBe(true);
  });

  it("acepta la igualdad exacta", () => {
    expect(repartoCuadra([{ statementId: "a", amount: 100 }], 100)).toBe(true);
  });

  it("rechaza una línea de cero o negativa", () => {
    expect(repartoCuadra([{ statementId: "a", amount: 0 }], 100)).toBe(false);
    expect(repartoCuadra([{ statementId: "a", amount: -10 }, { statementId: "b", amount: 20 }], 100)).toBe(false);
  });
});

const anticipo = (over: Partial<Advance> & { id: string }): Advance => ({
  tenantId: "t",
  unitId: "u1",
  amount: 0,
  remaining: 0,
  origin: "overpayment",
  date: "2026-08-01",
  status: "open",
  ...over,
});

describe("saldoAFavor — CA2", () => {
  it("suma el remanente de los abiertos de la unidad", () => {
    const items = [
      anticipo({ id: "1", remaining: 60_000 }),
      anticipo({ id: "2", remaining: 15_000 }),
      anticipo({ id: "3", remaining: 90_000, unitId: "u2" }),
    ];
    expect(saldoAFavor(items, "u1")).toBe(75_000);
    expect(saldoAFavor(items)).toBe(165_000);
  });

  /**
   * Un `cancelled` puede tener remanente cero por haberse ANULADO, no por
   * haberse gastado. Filtrar por `remaining > 0` en vez de por estado contaría
   * dinero que ya no está disponible en cuanto R9 dejara el remanente intacto.
   */
  it("no cuenta los aplicados ni los anulados", () => {
    const items = [
      anticipo({ id: "1", remaining: 60_000 }),
      anticipo({ id: "2", amount: 40_000, remaining: 0, status: "applied" }),
      anticipo({ id: "3", amount: 30_000, remaining: 30_000, status: "cancelled" }),
    ];
    expect(saldoAFavor(items, "u1")).toBe(60_000);
  });
});

describe("crucesVigentes — R8", () => {
  const cruce = (over: Partial<AdvanceApplication> & { id: string }): AdvanceApplication => ({
    tenantId: "t",
    advanceId: "adv-1",
    statementId: "bill-1",
    unitId: "u1",
    amount: 10_000,
    date: "2026-08-02",
    ...over,
  });

  /**
   * **Es la distinción que costó cinco operaciones encadenadas encontrar.** «Tiene
   * cruces» no es `remaining < amount`: anular un anticipo pone el remanente a
   * cero sin haber cruzado nada, y preguntarlo así bloqueaba una reversión
   * legítima. Se pregunta por los cruces sin deshacer.
   */
  it("solo cuenta los que no se han deshecho", () => {
    const aplicaciones = [
      cruce({ id: "x" }),
      cruce({ id: "y", reversedAt: "2026-08-03" }),
      cruce({ id: "z", advanceId: "adv-2" }),
    ];
    expect(crucesVigentes(aplicaciones, "adv-1").map((a) => a.id)).toEqual(["x"]);
  });

  it("un anticipo anulado sin cruces no tiene ninguno vigente", () => {
    expect(crucesVigentes([cruce({ id: "y", reversedAt: "2026-08-03" })], "adv-1")).toEqual([]);
  });
});

describe("motivoDeNoCuadrar — el mensaje tiene que decir el problema que hay", () => {
  /**
   * **REPRO.** `repartoCuadra` devuelve `false` por dos motivos y la pantalla
   * enseñaba el mismo aviso para los dos: «suma más que el importe pagado»
   * delante de un reparto que sumaba MENOS y solo tenía una línea en cero.
   */
  it("una línea en cero no es «suma más que el importe»", () => {
    expect(motivoDeNoCuadrar([{ statementId: "a", amount: 0 }, { statementId: "b", amount: 10 }], 100))
      .toBe("linea-no-positiva");
  });

  it("una línea negativa, igual", () => {
    expect(motivoDeNoCuadrar([{ statementId: "a", amount: -5 }], 100)).toBe("linea-no-positiva");
  });

  it("pasarse del importe sí es «suma más»", () => {
    expect(motivoDeNoCuadrar([{ statementId: "a", amount: 150 }], 100)).toBe("suma-mayor");
  });

  it("un reparto que cuadra no tiene motivo", () => {
    expect(motivoDeNoCuadrar([{ statementId: "a", amount: 60 }, { statementId: "b", amount: 40 }], 100)).toBeNull();
  });

  /** Y la tolerancia sigue: un reparto exacto con centavos no es «suma más». */
  it("un reparto exacto con centavos no se lee como que se pasa", () => {
    const lineas = [
      { statementId: "a", amount: 1243.79 },
      { statementId: "b", amount: 4619.14 },
      { statementId: "c", amount: 1683.14 },
    ];
    expect(motivoDeNoCuadrar(lineas, 7546.07)).toBeNull();
  });
});
