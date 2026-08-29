import { describe, expect, it } from "vitest";

import {
  calcularCandidatos,
  claveNatural,
  clasificar,
  cuentaCompatible,
  dentroDeVentana,
  efectoContable,
  idDeLinea,
  incoherenciasDelPar,
  mismoEfecto,
  normalizarDescripcion,
  porQueNoEsCandidato,
} from "@/features/finanzas/conciliacion-reglas";
import type { BankStatementLine, LedgerEntry } from "@/types/domain";

/**
 * `PRD-V-FLOW-004` — el espejo del cliente, con la MISMA tabla de casos que el
 * servidor (`functions/tests/conciliacion.test.ts`).
 *
 * **Que las dos suites usen los mismos números es el punto.** Los dos ficheros
 * están duplicados a la fuerza —`src/` no puede importar de `functions/`—, así
 * que la única forma de notar que se separan es que las dos respondan lo mismo
 * a las mismas preguntas. Hay además un guardián de texto sobre las constantes.
 */

const linea = (over: Partial<BankStatementLine> = {}): BankStatementLine =>
  ({
    id: "L1",
    tenantId: "tenant-santa-maria",
    bankAccountId: "7TY7nFs1sVzOm1S1ISwI",
    date: "2026-06-08",
    description: "Mantenimiento bomba de agua",
    amount: -300000,
    reconciled: false,
    ...over,
  }) as BankStatementLine;

const asiento = (over: Partial<LedgerEntry> = {}): LedgerEntry =>
  ({
    id: "A1",
    tenantId: "tenant-santa-maria",
    bankAccountId: "7TY7nFs1sVzOm1S1ISwI",
    date: "2026-06-08",
    type: "egreso",
    amount: 300000,
    concept: "Mantenimiento",
    reconciled: false,
    ...over,
  }) as LedgerEntry;

describe("R2 · el efecto contable dice lo mismo que el servidor", () => {
  it.each([
    ["ingreso normal", "ingreso" as const, 3000, 3000],
    ["egreso normal", "egreso" as const, 300000, -300000],
    ["reverso de un ingreso — el dinero SALE", "ingreso" as const, -1120000, -1120000],
    ["reverso de un egreso — el dinero VUELVE", "egreso" as const, -300000, 300000],
  ])("%s", (_caso, type, amount, esperado) => {
    expect(efectoContable({ type, amount })).toBe(esperado);
  });

  it.each([
    [-150000, "egreso" as const, 150000],
    [3000, "ingreso" as const, 3000],
    [-800000, "egreso" as const, 800000],
    [120000, "ingreso" as const, 120000],
    [250000, "ingreso" as const, 250000],
  ])("los pares coherentes de producción siguen siéndolo: %i ↔ %s %i", (montoLinea, type, montoAsiento) => {
    expect(mismoEfecto({ type, amount: montoAsiento }, { amount: montoLinea })).toBe(true);
  });

  it("la MAGNITUD rechaza el par falso de producción", () => {
    expect(mismoEfecto({ type: "ingreso", amount: 40000 }, { amount: -300000 })).toBe(false);
  });

  it("el SIGNO rechaza mismo importe en sentido contrario — caso construido", () => {
    expect(mismoEfecto({ type: "ingreso", amount: 3000 }, { amount: -3000 })).toBe(false);
  });
});

describe("R3 y R1 · ventana y cuenta", () => {
  it.each([0, 1, 3])("acepta %i días", (d) => {
    const dia = String(8 + d).padStart(2, "0");
    expect(dentroDeVentana({ date: "2026-06-08" }, { date: `2026-06-${dia}` })).toBe(true);
  });

  it.each([4, 6])("RECHAZA %i días", (d) => {
    const dia = String(8 + d).padStart(2, "0");
    expect(dentroDeVentana({ date: "2026-06-08" }, { date: `2026-06-${dia}` })).toBe(false);
  });

  it("un asiento sin cuenta no queda descartado — 16 de los 93 de producción", () => {
    expect(cuentaCompatible({ bankAccountId: "banco-a" }, { bankAccountId: undefined })).toBe(true);
    expect(cuentaCompatible({ bankAccountId: "banco-a" }, { bankAccountId: "banco-b" })).toBe(false);
  });
});

describe("El par falso, que es lo que la pantalla ofrecía", () => {
  const falso = asiento({ id: "igdiGS", type: "ingreso", amount: 40000, date: "2026-06-02", bankAccountId: undefined });

  it("ya no aparece como candidato", () => {
    expect(porQueNoEsCandidato(linea(), falso)).not.toBeNull();
    expect(calcularCandidatos(linea(), [falso])).toEqual([]);
  });

  it("y el asiento correcto SÍ — si no, lo de arriba no prueba nada", () => {
    expect(calcularCandidatos(linea(), [asiento()])).toHaveLength(1);
  });

  it("como ya está escrito, se le ponen nombres sin tocarlo", () => {
    expect(incoherenciasDelPar(linea(), falso)).toEqual(["signo", "monto", "fecha"]);
    expect(incoherenciasDelPar(linea(), asiento())).toEqual([]);
  });
});

describe("R4 · la pantalla no propone cuando hay varios", () => {
  const spei = (n: number) => asiento({ id: `A${n}`, type: "ingreso", amount: 3000, date: "2026-03-08" });
  const lineaSpei = linea({ amount: 3000, date: "2026-03-08", description: "SPEI — T1-103" });

  it("seis candidatos van a la bandeja", () => {
    const r = clasificar(lineaSpei, [1, 2, 3, 4, 5, 6].map(spei));
    expect(r.candidatos).toHaveLength(6);
    expect(r.status).toBe("detectado");
    expect(r.excepcion).toBe("varios_candidatos");
  });

  it("uno solo se propone", () => {
    expect(clasificar(lineaSpei, [spei(1)]).status).toBe("propuesto");
  });

  it("ninguno es excepción, y sobre una lista vacía tampoco propone", () => {
    expect(clasificar(lineaSpei, []).excepcion).toBe("sin_contraparte");
  });
});

describe("R5 · la clave y el id derivado", () => {
  const seis = [101, 102, 103, 104, 105, 106].map((u) =>
    linea({
      tenantId: "conjunto-las-playas",
      bankAccountId: "bank-playas-001",
      date: "2026-03-08",
      amount: 3000,
      description: `SPEI recibido — Pago administracion 2026-03 — T1-${u}`,
    }),
  );

  it("las seis dan seis claves distintas", () => {
    expect(new Set(seis.map(claveNatural)).size).toBe(6);
  });

  it("sin la descripción darían una sola", () => {
    expect(new Set(seis.map((l) => claveNatural({ ...l, description: "" }))).size).toBe(1);
  });

  it("conserva el código de unidad", () => {
    expect(normalizarDescripcion("SPEI — T1-101")).toContain("t1 101");
  });

  it("el id es estable, y distinto entre conjuntos", async () => {
    const a = await idDeLinea(linea());
    const b = await idDeLinea({ ...linea(), id: "otro" } as BankStatementLine);
    const c = await idDeLinea({ ...linea(), tenantId: "otro-conjunto" } as BankStatementLine);
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^bsl_[0-9a-f]{32}$/);
    // **El mismo literal está afirmado en el servidor**
    // (`functions/tests/conciliacion-espejo.test.ts`). Si una de las dos partes
    // cambia el hash, reimportar un extracto crearía documentos nuevos en vez de
    // reconocerlos — y eso se vería como duplicados, no como un error.
    expect(a).toBe("bsl_936552b9a7d451c6c42a2d009ea1b16e");
  });
});
