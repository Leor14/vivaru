import { describe, expect, it } from "vitest";

import { buildInformeMensualPdf, type InformePdfInput } from "../src/pdf-resumen";
import { PIE_DEL_INFORME, filasDeCabecera, seccionesDelInforme } from "../src/informe-mensual";

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

  /**
   * **Esta prueba afirmaba que el PDF con firmas es MÁS LARGO, y es FALSO.**
   *
   * Pasaba, pero por suerte del fixture. Medido contra el informe real de
   * staging: **firmado 25.220 bytes, sin firmar 25.266** — el sin firmar es más
   * grande, porque «Este informe todavía no ha sido firmado.» ocupa más que dos
   * nombres cortos. El tamaño no es un indicador de que algo se pintó, y usarlo
   * como tal es medir la cosa equivocada.
   *
   * Lo que sí se puede afirmar sin abrir el papel es que **el contenido cambia**.
   */
  it("las firmas cambian el documento (el TAMAÑO no lo dice: puede encoger)", async () => {
    const conFirmas = await buildInformeMensualPdf({
      ...base,
      signatures: [
        { name: "Ana Gómez", role: "Administración", signedAt: "3 sep 2026" },
        { name: "Paola Ruiz", role: "Consejo de administración", signedAt: "3 sep 2026" },
      ],
    });
    const sinFirmas = await buildInformeMensualPdf(base);
    expect(esUnPdf(conFirmas)).toBe(true);
    expect(conFirmas.equals(sinFirmas)).toBe(false);
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

/**
 * **El defecto que 824 pruebas en verde no vieron, y que cazó MIRAR el papel.**
 *
 * La cabecera decía «Saldo final del fondo (inicial + ingresos − egresos)» con un
 * **menos de verdad** (`−`, U+2212), y en el PDF salía **`ˆ`**. Las fuentes
 * estándar de `pdfkit` —Helvetica y sus variantes— van en **WinAnsi (cp1252)**, y
 * ese carácter no está: se sustituye por otro, **sin lanzar y sin avisar**.
 *
 * No es cosmético en un documento que se presenta a una asamblea, y sobre todo es
 * de la peor familia: **falla en silencio y se lee casi bien**. Las tildes y la
 * `ñ` sí están en WinAnsi, así que «Nómina» y «período» salen perfectos y uno da
 * por bueno el resto.
 *
 * Este guardián recorre **el texto que de verdad va al PDF** —el que producen
 * `filasDeCabecera`, `seccionesDelInforme` y el pie— y no una lista escrita a
 * mano, que es lo que lo mantiene vivo cuando alguien añada una fila nueva.
 */
const CP1252_ALTO = new Set(
  "€‚ƒ„…†‡ˆ‰Š‹ŒŽ\u2018\u2019\u201c\u201d•–—˜™š›œžŸ".split(""),
);

/** ¿Puede WinAnsi representar este carácter? */
export function representableEnWinAnsi(c: string): boolean {
  const n = c.codePointAt(0)!;
  if (n >= 0x20 && n <= 0x7e) return true;          // ASCII imprimible
  if (n >= 0xa0 && n <= 0xff) return true;          // Latin-1 suplemento
  return CP1252_ALTO.has(c);                        // la banda 0x80–0x9F de cp1252
}

describe("el texto del informe cabe en WinAnsi, que es lo que pinta `pdfkit`", () => {
  const textoDelPdf = () => {
    const i = {
      openingBalance: 85_000, openingBalanceSource: "registrado" as const, closingBalance: 47_600,
      totalIncome: 24_000, totalExpenses: 61_400, netResult: -37_400,
      income: [{ code: "4.1", label: "Cuotas de administración", amount: 24_000 }],
      expenses: [{ code: "5.1", label: "Nómina", amount: 28_000 }],
      receivables: { total: 18_500, byUnit: [{ unitId: "u", unitLabel: "T1-103", balance: 6_000, periods: 2 }] },
      payables: { total: 33_150, overdue: 0, byVendor: [{ vendorName: "Administradora Vivaru", amount: 12_000 }] },
    };
    return [
      ...filasDeCabecera(i).flat(),
      ...seccionesDelInforme(i).flatMap((s) => [s.title, ...s.rows.flat(), ...(s.total ?? [])]),
      PIE_DEL_INFORME,
      "Sin movimientos en el período.",
      "Este informe todavía no ha sido firmado.",
      "Informe económico mensual",
      "Firmas",
    ].join(" ");
  };

  it("ni un solo carácter fuera de WinAnsi", () => {
    const fuera = [...new Set([...textoDelPdf()].filter((c) => !representableEnWinAnsi(c)))];
    // El mensaje nombra el carácter y su punto de código: sin eso, quien lo vea
    // en rojo dentro de un año no sabrá qué está mirando.
    expect(
      fuera.map((c) => `${JSON.stringify(c)} (U+${c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")})`),
    ).toEqual([]);
  });

  it("y el guardián SÍ caza el carácter que se coló (control del instrumento)", () => {
    // Sin esto, el caso de arriba estaría en verde también con el guardián roto.
    expect(representableEnWinAnsi("\u2212")).toBe(false);  // el menos que salía `ˆ`
    expect(representableEnWinAnsi("\u00f3")).toBe(true);   // ó — las tildes sí están
    expect(representableEnWinAnsi("\u00f1")).toBe(true);   // ñ
    expect(representableEnWinAnsi("\u00b7")).toBe(true);   // · el separador que usa el informe
    expect(representableEnWinAnsi("\u2014")).toBe(true);   // — la raya sí está en cp1252
  });
});
