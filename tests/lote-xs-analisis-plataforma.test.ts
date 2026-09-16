import fs from "node:fs";
import path from "node:path";

import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";

// La fecha se pinta en la zona de quien usa la app: se fija para que CI (en UTC) distinga.
process.env.TZ = "America/Bogota";

import { getBrandingContrastReport } from "@/features/admin/utils/branding-contrast";
import { SUGGESTED_BRAND_COLORS } from "@/features/admin/hooks/use-tenant-branding-form";
import { fechaDePublicacion } from "@/features/communications/fecha-de-publicacion";
import {
  PLANTILLA_DE_RESIDENTES,
  PLANTILLA_DE_UNIDADES,
  plantillaEnCsv,
  plantillaEnExcel,
  TIPOS_PARA_LA_PLANTILLA,
} from "@/lib/import/plantillas";
import { ALIAS_DE_TIPO, TIPOS_DE_UNIDAD } from "@/lib/units/tipos";

/**
 * **Fase 3 del lote «Análisis de la plataforma» — la puerta XS** (`docs/plan-lote-analisis-plataforma.md`).
 * L-01a (colores), L-02 (plantillas), L-11 (panel de portería), L-12 (fecha de publicación) y las
 * tildes de Residentes.
 */

const leer = (p: string) => fs.readFileSync(path.resolve(p), "utf8");
/** Sin comentarios: los comentarios citan lo que se arregló (`un-guardian-cuenta-sus-comentarios`). */
const codigo = (p: string) =>
  leer(p)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

describe("L-01a · colores sugeridos de marca", () => {
  it("incluye menta y violeta", () => {
    expect(SUGGESTED_BRAND_COLORS).toContain("#1f7a5c");
    expect(SUGGESTED_BRAND_COLORS).toContain("#6d28d9");
  });

  it("todos se leen con texto blanco (4,5:1): sugerir uno ilegible sería peor que no sugerirlo", () => {
    for (const color of SUGGESTED_BRAND_COLORS) {
      expect(getBrandingContrastReport(color).whiteContrast, color).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe("L-02 · plantillas de la carga masiva", () => {
  const [cabecera, ...filas] = PLANTILLA_DE_UNIDADES;
  const columnaTipo = cabecera.indexOf("tipo");

  it("la de unidades trae parqueadero y bodega, y cada tipo la reconoce el importador", () => {
    const tipos = filas.map((f) => ALIAS_DE_TIPO[f[columnaTipo]]);
    expect(tipos).not.toContain(undefined);
    expect(tipos).toContain("parking");
    expect(tipos).toContain("storage");
  });

  it("«valores válidos» sale del catálogo: ningún tipo se queda fuera", () => {
    expect(TIPOS_PARA_LA_PLANTILLA.map((t) => t.clave)).toEqual([...TIPOS_DE_UNIDAD]);
  });

  it("el Excel se lee de vuelta con las mismas filas", () => {
    for (const plantilla of [PLANTILLA_DE_UNIDADES, PLANTILLA_DE_RESIDENTES]) {
      const libro = XLSX.read(plantillaEnExcel(plantilla, "Plantilla"), { type: "array" });
      const leidas = XLSX.utils.sheet_to_json<string[]>(libro.Sheets.Plantilla, { header: 1, raw: false });
      expect(leidas).toEqual(plantilla.map((f) => [...f]));
    }
  });

  it("el CSV conserva una línea por fila", () => {
    expect(plantillaEnCsv(PLANTILLA_DE_UNIDADES).split("\r\n")).toHaveLength(PLANTILLA_DE_UNIDADES.length);
  });

  it("guardián: los dos asistentes ofrecen Excel y CSV desde el módulo, sin plantilla propia", () => {
    for (const [fichero, plantilla] of [
      ["src/components/features/residents/UnitBulkImportWizard.tsx", "PLANTILLA_DE_UNIDADES"],
      ["src/components/features/residents/ResidentBulkImportWizard.tsx", "PLANTILLA_DE_RESIDENTES"],
    ] as const) {
      const c = codigo(fichero);
      expect(c, fichero).toMatch(new RegExp(`descargarPlantilla\\(${plantilla}`));
      expect(c, fichero).toMatch(/downloadTemplate\("xlsx"\)/);
      expect(c, fichero).toMatch(/downloadTemplate\("csv"\)/);
      expect(c, fichero).not.toMatch(/text\/csv;charset/);
    }
  });

  it("guardián: «valores válidos» del asistente de unidades no escribe los tipos a mano", () => {
    const c = codigo("src/components/features/residents/UnitBulkImportWizard.tsx");
    expect(c).toMatch(/TIPOS_PARA_LA_PLANTILLA\.map/);
    expect(c).not.toMatch(/apartment · house · office · other/);
  });

  it("guardián: Residentes enseña las plantillas en Excel sin abrir el asistente", () => {
    const c = codigo("src/app/(admin)/admin/residents/page.tsx");
    expect(c).toMatch(/descargarPlantilla\(PLANTILLA_DE_UNIDADES, "plantilla_unidades", "xlsx"\)/);
    expect(c).toMatch(/descargarPlantilla\(PLANTILLA_DE_RESIDENTES, "plantilla_residentes", "xlsx"\)/);
  });
});

describe("L-11 · la portería tiene su propio panel", () => {
  for (const pantalla of ["visitors", "reservations", "packages"]) {
    it(`${pantalla}: lo dice, y el panel de portería existe de verdad`, () => {
      // Texto crudo y no `codigo`: en Reservas, `accept="image/*"` abre un «comentario» que el
      // despojador no distingue de uno de verdad, y se comía la mitad del fichero.
      expect(leer(`src/app/(admin)/admin/${pantalla}/page.tsx`)).toMatch(/<NotaPanelDePorteria queHace=/);
      expect(fs.existsSync(path.resolve(`src/app/(guard)/guard/${pantalla}`))).toBe(true);
    });
  }
});

describe("L-12 · la fecha de publicación, a la vista del administrador", () => {
  const segundos = Date.UTC(2026, 8, 16, 20, 14, 18) / 1000; // 3:14 p. m. en Bogotá

  it("lee el Timestamp de Firestore, su forma serializada y una cadena ISO", () => {
    for (const valor of [
      { toDate: () => new Date(segundos * 1000) },
      { seconds: segundos, nanoseconds: 0 },
      new Date(segundos * 1000).toISOString(),
    ]) {
      const texto = fechaDePublicacion(valor);
      expect(texto).toMatch(/16/);
      expect(texto).toMatch(/2026/);
      expect(texto).toMatch(/3:14/);
    }
  });

  it("sin fecha, o con una que no es fecha, no inventa nada", () => {
    expect(fechaDePublicacion(undefined)).toBeNull();
    expect(fechaDePublicacion("")).toBeNull();
    expect(fechaDePublicacion("no es fecha")).toBeNull();
    expect(fechaDePublicacion({})).toBeNull();
  });

  it("guardián: la tabla de Comunicaciones tiene la columna, con la fecha de creación de respaldo", () => {
    const c = codigo("src/app/(admin)/admin/communications/page.tsx");
    expect(c).toMatch(/header: "Publicado"/);
    expect(c).toMatch(/fechaDePublicacion\(item\.publishedAt \?\? item\.createdAt\)/);
  });
});

describe("tildes de Residentes", () => {
  it("«Tipo de ocupación» y «Núcleo familiar» llevan su tilde", () => {
    const c = leer("src/app/(admin)/admin/residents/page.tsx");
    expect(c).not.toMatch(/Tipo de ocupacion|Nucleo familiar/);
    expect(c).toMatch(/Tipo de ocupación/);
    expect(c).toMatch(/Núcleo familiar/);
  });
});
