import { describe, expect, it } from "vitest";

import { buildInformeMensualPdf, type InformePdfInput } from "../src/pdf-resumen";

/**
 * `PRD-V-FLOW-007` entrega 2 — el PDF del informe. Apoya a `CA13`.
 *
 * **Esto NO sustituye a `CA13`, y conviene decirlo.** Aquel criterio se verifica
 * «con ojos, en staging», porque lo que pide —que el logo se vea, que el bloque
 * de firmas se lea— no lo puede afirmar una prueba: extraer texto de un PDF para
 * comprobar una maquetación acaba comprobando la extracción. Lo que sí se puede
 * vigilar aquí es que **construirlo no reviente**, y en particular que no reviente
 * por las razones equivocadas.
 */

const base: InformePdfInput = {
  tenantName: "Conjunto Santa María",
  period: "2026-02",
  statusLabel: "Emitido",
  headline: [
    ["Saldo inicial del banco", "$5.000.000"],
    ["Saldo final del fondo (inicial + ingresos − egresos)", "$4.800.000"],
  ],
  sections: [
    { title: "Ingresos por cuenta", rows: [["Cuotas de administración", "$200.000"]], total: ["Total de ingresos", "$200.000"] },
    // Una sección VACÍA: `CA8` pide que se diga, no que se omita.
    { title: "Deuda a proveedores", rows: [], total: ["Total por pagar (vencido: $0)", "$0"] },
  ],
  signatures: [],
  footNote: "Las firmas de este documento son constancia…",
};

const esUnPdf = (b: Buffer) => b.subarray(0, 5).toString("latin1") === "%PDF-";

describe("buildInformeMensualPdf", () => {
  it("produce un PDF con el bloque de firmas VACÍO, que `CA13` pide no omitir", async () => {
    const pdf = await buildInformeMensualPdf(base);
    expect(esUnPdf(pdf)).toBe(true);
    expect(pdf.length).toBeGreaterThan(1_000);
  });

  it("con firmas también, y sale más largo que sin ellas", async () => {
    const conFirmas = await buildInformeMensualPdf({
      ...base,
      signatures: [
        { name: "Ana Gómez", role: "Administración", signedAt: "3 sep 2026" },
        { name: "Paola Ruiz", role: "Consejo de administración", signedAt: "3 sep 2026" },
      ],
    });
    const sinFirmas = await buildInformeMensualPdf(base);
    expect(esUnPdf(conFirmas)).toBe(true);
    // Que crezca es lo único que prueba, desde fuera, que las firmas se pintaron.
    expect(conFirmas.length).toBeGreaterThan(sinFirmas.length);
  });

  it("el aviso de ANULADO cabe en el documento (`RN-14`)", async () => {
    const pdf = await buildInformeMensualPdf({
      ...base,
      statusLabel: "Anulado",
      voidNotice: "ANULADO el 3 de septiembre de 2026: un egreso de marzo con fecha de abril.",
    });
    expect(esUnPdf(pdf)).toBe(true);
  });

  /**
   * **Un logo ilegible NO puede impedir emitir.**
   *
   * Este documento cumple una obligación legal cuya sanción es la remoción del
   * administrador. Que no se pueda emitir porque un PNG está corrupto sería
   * cambiar un problema cosmético por uno grave. `pdfkit` lanza **síncrono** al
   * no reconocer el formato, así que sin el `try` de `buildInformeMensualPdf`
   * esto tumbaría la emisión entera.
   */
  it("un logo corrupto no rompe el informe: sale sin logo y con todo lo demás", async () => {
    const pdf = await buildInformeMensualPdf({ ...base, logo: Buffer.from("esto no es una imagen") });
    expect(esUnPdf(pdf)).toBe(true);
    expect(pdf.length).toBeGreaterThan(1_000);
  });

  it("un informe sin NINGUNA línea tampoco revienta: se emite en ceros y diciéndolo", async () => {
    // §5 · «un informe ausente es peor que un informe en cero, porque la
    // obligación es mensual».
    const pdf = await buildInformeMensualPdf({
      ...base,
      headline: [["Saldo inicial del banco", "Sin saldo bancario de apertura"]],
      sections: [{ title: "Ingresos por cuenta", rows: [] }, { title: "Egresos por cuenta", rows: [] }],
    });
    expect(esUnPdf(pdf)).toBe(true);
  });
});
