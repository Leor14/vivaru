import { describe, expect, it } from "vitest";

import { codigoDesdeId, construirRecibo } from "../src/comprobante";

/**
 * El constructor del recibo, que hasta el 20 de agosto de 2026 vivía en el front
 * y se probaba en `tests/finanzas-payments.test.ts`. Se mudó al servidor al meter
 * la emisión dentro de la transacción del pago.
 */
describe("codigoDesdeId", () => {
  it("produce un código con prefijo y seis caracteres", () => {
    expect(codigoDesdeId("aB3xY7zQw9RtMn2KpL4s")).toMatch(/^REC-[A-Z0-9]{6}$/);
  });

  it("quita los caracteres que se confunden al leerlos o teclearlos", () => {
    // O/0, I/1 y L se prestan a error cuando alguien dicta su recibo por
    // teléfono o lo copia de un papel.
    const codigo = codigoDesdeId("O0I1LO0I1LaB3xY7zQw9");
    expect(codigo.slice(4)).not.toMatch(/[OI0L1]/);
  });

  it("es estable: el mismo id da siempre el mismo código", () => {
    expect(codigoDesdeId("aB3xY7zQw9RtMn2KpL4s")).toBe(codigoDesdeId("aB3xY7zQw9RtMn2KpL4s"));
  });

  it("ids distintos dan códigos distintos", () => {
    expect(codigoDesdeId("aB3xY7zQw9RtMn2KpL4s")).not.toBe(codigoDesdeId("zZ9wV8uT7sR6qP5nM4kJ"));
  });

  it("rellena si el id se queda corto tras el filtro", () => {
    // Un id formado solo por caracteres ambiguos no puede dejar el código a
    // medias: se rellena para que siempre tenga la misma forma.
    expect(codigoDesdeId("OOOO")).toMatch(/^REC-.{6}$/);
  });
});

describe("construirRecibo", () => {
  const base = {
    voucherId: "aB3xY7zQw9RtMn2KpL4s",
    issueDate: "2026-08-20",
    amount: 250,
    concept: "Pago de alícuota 2026-08 — T1-101",
  };

  it("mapea pagador y emisor, y nace sin anular", () => {
    const recibo = construirRecibo({
      ...base,
      payer: { name: "Ana Ruiz", unitId: "u-1", unitLabel: "T1-101" },
      issuer: { taxId: "1790012345001", legalName: "Conjunto Horizonte", country: "EC" },
      sourceType: "billingStatement",
      sourceId: "stmt-1",
    });
    expect(recibo.payerName).toBe("Ana Ruiz");
    expect(recibo.payerUnitLabel).toBe("T1-101");
    expect(recibo.issuerCountry).toBe("EC");
    expect(recibo.sourceId).toBe("stmt-1");
    expect(recibo.anulado).toBe(false);
    expect(recibo.code).toMatch(/^REC-/);
  });

  it("no exige documento del pagador en ningún país", () => {
    // Era obligatorio solo en Ecuador, y solo porque lo pedía el documento del
    // SRI. Al salir lo fiscal del alcance, un recibo sin cédula es válido.
    const recibo = construirRecibo({ ...base, issuer: { country: "EC" } });
    expect(recibo.payerTaxId).toBeNull();
    expect(recibo.issuerTaxId).toBeNull();
  });

  it("los tres países producen la misma forma de recibo", () => {
    const forma = (pais: "EC" | "CO" | "MX") => {
      const { code: _code, ...resto } = construirRecibo({ ...base, issuer: { country: pais } });
      return { ...resto, issuerCountry: null };
    };
    expect(forma("CO")).toEqual(forma("MX"));
    expect(forma("EC")).toEqual(forma("MX"));
  });

  it("tolera un recibo sin pagador ni emisor", () => {
    const recibo = construirRecibo(base);
    expect(recibo.payerName).toBeNull();
    expect(recibo.issuerLegalName).toBeNull();
    expect(recibo.amount).toBe(250);
  });
});
