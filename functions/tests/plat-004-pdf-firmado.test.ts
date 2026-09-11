import { describe, expect, it } from "vitest";

import { buildInformeMensualPdf } from "../src/pdf-resumen";
import {
  PIE_DEL_INFORME,
  filasDeCabecera,
  firmasParaElPdf,
  instantaneaDeUnInformeSellado,
  seccionesDelInforme,
  zonaParaPintarFechas,
  type InstantaneaDelInforme,
} from "../src/informe-mensual";

/**
 * `PRD-V-PLAT-004` `CA3` — el PDF del informe nombra a quien lo firmó, con su cargo.
 *
 * Hasta el 11 de septiembre de 2026 el PDF se archivaba UNA vez, al emitir, con el bloque de
 * firmas vacío, y firmar solo tocaba el documento: **el papel no nombraba nunca a nadie**. Era
 * un criterio imposible por construcción —pedía la firma en un papel congelado antes de que
 * nadie pudiera firmar— y pasó la entrega 1 sin que nada fallara. Ahora `signMonthlyReport` lo
 * rehace tras cada firma. Aquí se fija que rehacerlo NO recalcula nada y que la fecha de la
 * firma no se corre de día.
 *
 * Como en `flow-007-pdf-informe.test.ts`, esto no sustituye mirar el papel: lo que se ve en el
 * PDF se comprueba con ojos, en staging.
 */

const INSTANTANEA: InstantaneaDelInforme = {
  openingBalance: 5_000_000,
  openingBalanceSource: "registrado",
  closingBalance: 4_800_000,
  income: [{ code: "4.1", label: "Cuotas de administración", amount: 200_000 }],
  expenses: [{ code: "5.1", label: "Aseo", amount: 400_000 }],
  totalIncome: 200_000,
  totalExpenses: 400_000,
  netResult: -200_000,
  receivables: { total: 350_000, byUnit: [{ unitId: "u-1", unitLabel: "T1-101", balance: 350_000, periods: 2 }] },
  payables: { total: 120_000, overdue: 0, byVendor: [{ vendorName: "Aseo Total", amount: 120_000 }] },
};

/** Lo que guarda `sellarEmision`: la instantánea entera más los campos del documento. */
const DOCUMENTO_SELLADO: Record<string, unknown> = {
  ...INSTANTANEA,
  tenantId: "tenant-palmas",
  period: "2026-08",
  status: "emitido",
  documentId: "informe_tenant-palmas_2026-08",
  issuedBy: "admin-1",
  signatures: [],
};

/** 19:30 del 10 de septiembre en Ciudad de México = 01:30 del 11 en UTC. */
const FIRMA_DE_LA_TARDE = {
  uid: "carmen",
  name: "Carmen García",
  role: "Consejo de administración",
  signedAt: { toDate: () => new Date("2026-09-11T01:30:00Z") },
};

describe("instantaneaDeUnInformeSellado — el PDF se rehace con lo CONGELADO", () => {
  it("devuelve exactamente la instantánea que se selló, sin los campos del documento", () => {
    expect(instantaneaDeUnInformeSellado(DOCUMENTO_SELLADO)).toEqual(INSTANTANEA);
  });

  it("y el papel rehecho lleva las mismas cifras de cabecera y las mismas secciones", () => {
    const rehecha = instantaneaDeUnInformeSellado(DOCUMENTO_SELLADO);
    expect(filasDeCabecera(rehecha)).toEqual(filasDeCabecera(INSTANTANEA));
    expect(seccionesDelInforme(rehecha)).toEqual(seccionesDelInforme(INSTANTANEA));
  });

  it("un saldo de apertura sin dato sigue sin dato, no «$0» (`CA4`)", () => {
    const sinApertura = instantaneaDeUnInformeSellado({ ...DOCUMENTO_SELLADO, openingBalanceSource: undefined });
    expect(sinApertura.openingBalanceSource).toBe("ausente");
    expect(filasDeCabecera(sinApertura)[0][1]).toBe("Sin saldo bancario de apertura");
  });

  it("un documento incompleto no revienta: las secciones salen vacías, que `CA8` sabe pintar", () => {
    const vacia = instantaneaDeUnInformeSellado({ status: "emitido" });
    expect(vacia.income).toEqual([]);
    expect(vacia.receivables.byUnit).toEqual([]);
    expect(seccionesDelInforme(vacia)).toHaveLength(4);
  });
});

describe("firmasParaElPdf — nombre, cargo y la fecha del día en que se firmó", () => {
  it("conserva el nombre y el cargo que puso el servidor", () => {
    const [f] = firmasParaElPdf([FIRMA_DE_LA_TARDE], zonaParaPintarFechas("MX"));
    expect(f.name).toBe("Carmen García");
    expect(f.role).toBe("Consejo de administración");
  });

  it("en México, una firma a las 19:30 del 10 sale del 10 — en UTC ya sería el 11", () => {
    const [enMexico] = firmasParaElPdf([FIRMA_DE_LA_TARDE], zonaParaPintarFechas("MX"));
    const [enUtc] = firmasParaElPdf([FIRMA_DE_LA_TARDE], "UTC");
    expect(enMexico.signedAt).toMatch(/^10\b/);
    expect(enMexico.signedAt).toContain("2026");
    // El par que prueba que la zona distingue algo: sin ella, sería otro día.
    expect(enUtc.signedAt).toMatch(/^11\b/);
  });

  it("sin firmas, lista vacía; una firma sin fecha no revienta", () => {
    expect(firmasParaElPdf(undefined, "UTC")).toEqual([]);
    expect(firmasParaElPdf([{ name: "Ana", role: "Administración" }], "UTC")).toEqual([
      { name: "Ana", role: "Administración", signedAt: "" },
    ]);
  });
});

describe("zonaParaPintarFechas — la zona sale del país del conjunto", () => {
  it("Colombia, Ecuador y México; sin país, la capital de México", () => {
    expect(zonaParaPintarFechas("CO")).toBe("America/Bogota");
    expect(zonaParaPintarFechas("EC")).toBe("America/Guayaquil");
    expect(zonaParaPintarFechas("MX")).toBe("America/Mexico_City");
    expect(zonaParaPintarFechas(undefined)).toBe("America/Mexico_City");
  });
});

describe("el PDF con la firma del consejo se construye", () => {
  it("es un PDF, y el cargo con tilde no lo rompe (las fuentes estándar van en WinAnsi)", async () => {
    const pdf = await buildInformeMensualPdf({
      tenantName: "Privada Las Palmas",
      period: "2026-08",
      statusLabel: "Emitido",
      headline: filasDeCabecera(INSTANTANEA),
      sections: seccionesDelInforme(INSTANTANEA),
      signatures: firmasParaElPdf([FIRMA_DE_LA_TARDE], zonaParaPintarFechas("MX")),
      footNote: PIE_DEL_INFORME,
    });
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(1_000);
  });
});
