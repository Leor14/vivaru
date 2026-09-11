import { describe, expect, it } from "vitest";

import {
  calcularTramosCandidatos,
  clasificar,
  porQueNoEsCandidatoElTramo,
  tramosDe,
  type AsientoDelLibro,
  type LineaDeBanco,
  type TraspasoParaConciliar,
} from "../src/conciliacion";
import { casoDeRelleno } from "../src/conciliacion-casos";

/**
 * `PRD-V-FEAT-010` 2b · `RN-07` · `CA7` — los tramos de un traspaso, candidatos
 * de la conciliación junto a los asientos.
 *
 * **Datos construidos**, y se dice: ningún conjunto de producción tiene dos
 * cuentas, así que no hay un traspaso real que medir. Un traspaso de 300.000 de
 * la cuenta A a la B, el 10 de septiembre.
 */

const T = "conjunto";
const traspaso = (extra: Partial<TraspasoParaConciliar> = {}): TraspasoParaConciliar => ({
  id: "tr-1",
  tenantId: T,
  fromAccountId: "banco-a",
  toAccountId: "banco-b",
  amount: 300000,
  date: "2026-09-10",
  status: "registrado",
  ...extra,
});
const linea = (extra: Partial<LineaDeBanco> = {}): LineaDeBanco => ({
  id: "l-1",
  tenantId: T,
  bankAccountId: "banco-a",
  date: "2026-09-10",
  description: "TRASPASO A CTA AHORROS",
  amount: -300000,
  ...extra,
});
const [salida, entrada] = tramosDe(traspaso());

describe("un traspaso son DOS tramos, y ninguno es un asiento", () => {
  it("la salida resta 300.000 en la cuenta de origen; la entrada suma 300.000 en la de destino", () => {
    expect(salida).toMatchObject({ id: "tr-1:salida", tramo: "salida", bankAccountId: "banco-a", efecto: -300000, conciliado: false, anulado: false });
    expect(entrada).toMatchObject({ id: "tr-1:entrada", tramo: "entrada", bankAccountId: "banco-b", efecto: 300000 });
  });

  it("un importe guardado en negativo no le da la vuelta al sentido", () => {
    expect(tramosDe(traspaso({ amount: -300000 })).map((t) => t.efecto)).toEqual([-300000, 300000]);
  });

  it("anulado, lo están los dos tramos; conciliado, cada uno por su lado", () => {
    expect(tramosDe(traspaso({ status: "anulado" })).every((t) => t.anulado)).toBe(true);
    expect(tramosDe(traspaso({ salidaLineId: "l-9" })).map((t) => t.conciliado)).toEqual([true, false]);
  });
});

describe("`CA7` · cada tramo casa con la línea de SU banco", () => {
  it("la salida, con −300.000 en el extracto de A; la entrada, con +300.000 en el de B", () => {
    expect(porQueNoEsCandidatoElTramo(linea(), salida)).toBeNull();
    expect(porQueNoEsCandidatoElTramo(linea({ bankAccountId: "banco-b", amount: 300000 }), entrada)).toBeNull();
  });

  it("cruzados, no: la entrada no está en el extracto de A, ni la salida en el de B", () => {
    expect(porQueNoEsCandidatoElTramo(linea({ amount: 300000 }), entrada)).toBe("otra_cuenta");
    expect(porQueNoEsCandidatoElTramo(linea({ bankAccountId: "banco-b" }), salida)).toBe("otra_cuenta");
  });

  it("el sentido cuenta: +300.000 en A no es la salida", () => {
    expect(porQueNoEsCandidatoElTramo(linea({ amount: 300000 }), salida)).toBe("efecto");
  });

  it("ni otro importe, ni más de 3 días, ni otro conjunto, ni un tramo ya conciliado o anulado", () => {
    expect(porQueNoEsCandidatoElTramo(linea({ amount: -299000 }), salida)).toBe("efecto");
    expect(porQueNoEsCandidatoElTramo(linea({ date: "2026-09-13" }), salida)).toBeNull();
    expect(porQueNoEsCandidatoElTramo(linea({ date: "2026-09-14" }), salida)).toBe("fecha");
    expect(porQueNoEsCandidatoElTramo(linea({ tenantId: "otro" }), salida)).toBe("otro_conjunto");
    expect(porQueNoEsCandidatoElTramo(linea(), tramosDe(traspaso({ salidaLineId: "l-9" }))[0])).toBe("ya_conciliado");
    expect(porQueNoEsCandidatoElTramo(linea(), tramosDe(traspaso({ status: "anulado" }))[0])).toBe("anulado");
  });

  it("el tramo de una caja chica no casa con ninguna línea: la caja no tiene extracto", () => {
    const [bancoSale, cajaEntra] = tramosDe(traspaso({ toAccountId: "caja-porteria" }));
    expect(calcularTramosCandidatos(linea(), [bancoSale, cajaEntra])).toEqual(["tr-1:salida"]);
    expect(calcularTramosCandidatos(linea({ amount: 300000 }), [bancoSale, cajaEntra])).toEqual([]);
  });
});

describe("R4 · un tramo es un candidato más", () => {
  const asiento = (extra: Partial<AsientoDelLibro> = {}): AsientoDelLibro => ({
    id: "a-1",
    tenantId: T,
    bankAccountId: "banco-a",
    date: "2026-09-10",
    type: "egreso",
    amount: 300000,
    ...extra,
  });

  it("solo el tramo: se propone", () => {
    expect(clasificar(linea(), [], [salida, entrada])).toMatchObject({
      status: "propuesto",
      candidateLedgerEntryIds: [],
      candidateTransferLegs: ["tr-1:salida"],
    });
  });

  it("un asiento y un tramo del mismo importe son DOS candidatos, y con dos no se propone", () => {
    expect(clasificar(linea(), [asiento()], [salida])).toMatchObject({ status: "detectado", excepcion: "varios_candidatos" });
  });

  it("sin tramos, clasifica igual que antes de la 2b", () => {
    expect(clasificar(linea(), [asiento()])).toMatchObject({ status: "propuesto", candidateLedgerEntryIds: ["a-1"], candidateTransferLegs: [] });
  });

  it("el relleno guarda los tramos candidatos, y solo cuando los hay", () => {
    expect(casoDeRelleno(linea(), [], null, [salida]).candidateTransferLegs).toEqual(["tr-1:salida"]);
    expect("candidateTransferLegs" in casoDeRelleno(linea(), [asiento()], null)).toBe(false);
  });
});
