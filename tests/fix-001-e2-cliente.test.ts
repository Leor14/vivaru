import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  anticipacionDelArea,
  aplicaMora,
  MAX_ANTICIPACION_MINUTOS,
  MIN_ANTICIPACION_POR_DEFECTO,
  minimoPermitido,
  politicaDeMoraAFormulario,
  politicaDeMoraDesdeFormulario,
} from "@/features/reservations/politica-del-area";

/**
 * `PRD-V-FIX-001` entrega 2 — el lado del cliente de la política por área.
 *
 * La interfaz MUESTRA las reglas del área y el administrador las configura; decide
 * el servidor (§12: «si discrepan, manda el servidor»). Por eso las funciones de aquí
 * son espejo de las de `functions/src/reservations.ts`, y sus constantes se comparan.
 */

const leer = (ruta: string) =>
  fs
    .readFileSync(path.resolve(ruta), "utf-8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

/** El cuerpo de una función anidada en el componente (sangría de dos espacios). */
function cuerpo(src: string, firma: string) {
  const inicio = src.indexOf(firma);
  expect(inicio, `no está: ${firma}`).toBeGreaterThan(-1);
  return src.slice(inicio, src.indexOf("\n  }\n", inicio));
}

describe("FIX-001 e2 · la política de mora en el formulario", () => {
  it("va del formulario al dato: heredar no escribe nada, bloquear y permitir sí", () => {
    expect(politicaDeMoraDesdeFormulario("heredar")).toBeUndefined();
    expect(politicaDeMoraDesdeFormulario("bloquear")).toBe(true);
    expect(politicaDeMoraDesdeFormulario("permitir")).toBe(false);
  });

  it("y vuelve del dato al formulario", () => {
    expect(politicaDeMoraAFormulario(undefined)).toBe("heredar");
    expect(politicaDeMoraAFormulario(null)).toBe("heredar");
    expect(politicaDeMoraAFormulario(true)).toBe("bloquear");
    expect(politicaDeMoraAFormulario(false)).toBe("permitir");
  });
});

describe("FIX-001 e2 · espejo del servidor", () => {
  it("la anticipación del área: 30 por defecto, enteros de 0 a una semana, lo demás cae a 30", () => {
    expect(anticipacionDelArea({})).toBe(30);
    expect(anticipacionDelArea({ minAdvanceMinutes: 120 })).toBe(120);
    expect(anticipacionDelArea({ minAdvanceMinutes: 0 })).toBe(0);
    for (const valor of [-5, 10081, 45.5, Number.NaN, "60", null]) {
      expect(anticipacionDelArea({ minAdvanceMinutes: valor as unknown as number })).toBe(30);
    }
  });

  it("la mora: el área manda si tiene política; si no, el conjunto", () => {
    expect(aplicaMora(true, undefined)).toBe(true);
    expect(aplicaMora(true, false)).toBe(false);
    expect(aplicaMora(false, true)).toBe(true);
    expect(aplicaMora(undefined, null)).toBe(false);
  });

  it("las constantes son las mismas que en el servidor", () => {
    const servidor = leer("functions/src/reservations.ts");
    expect(Number(/MIN_ANTICIPACION_POR_DEFECTO\s*=\s*(\d+)/.exec(servidor)?.[1])).toBe(MIN_ANTICIPACION_POR_DEFECTO);
    expect(Number(/MAX_ANTICIPACION_MINUTOS\s*=\s*([\d_]+)/.exec(servidor)?.[1]?.replace(/_/g, ""))).toBe(
      MAX_ANTICIPACION_MINUTOS,
    );
  });

  it("el mínimo permitido es ahora más la anticipación del área", () => {
    expect(minimoPermitido(new Date("2026-08-21T10:00:00Z"), 120).toISOString()).toBe("2026-08-21T12:00:00.000Z");
  });
});

describe("FIX-001 e2 · el administrador configura la política por área", () => {
  const pagina = leer("src/app/(admin)/admin/reservations/page.tsx");

  it("al crear y al editar se guardan los tres campos", () => {
    for (const firma of ["async function handleCreateAmenity(", "async function handleSaveAmenityEdit("]) {
      const fn = cuerpo(pagina, firma);
      expect(fn).toMatch(/blockOnDebt/);
      expect(fn).toMatch(/autoApprove/);
      expect(fn).toMatch(/minAdvanceMinutes/);
    }
  });

  it("al abrir la edición se cargan los tres, y la mora pasa por el formulario", () => {
    const fn = cuerpo(pagina, "function handleEditAmenity(");
    expect(fn).toMatch(/politicaDeMoraAFormulario\(/);
    expect(fn).toMatch(/autoApprove/);
    expect(fn).toMatch(/minAdvanceMinutes/);
  });

  it("el tipo del área y el alta los conocen", () => {
    const servicios = leer("src/features/admin/services.ts");
    const tipo = servicios.slice(servicios.indexOf("export type AmenityItem"), servicios.indexOf("export type VisitorItem"));
    expect(tipo).toMatch(/blockOnDebt\?: boolean \| null/);
    expect(tipo).toMatch(/autoApprove\?: boolean/);
    expect(tipo).toMatch(/minAdvanceMinutes\?: number/);
    const alta = servicios.slice(servicios.indexOf("export async function createAmenity("), servicios.indexOf(") {", servicios.indexOf("export async function createAmenity(")));
    for (const campo of ["blockOnDebt", "autoApprove", "minAdvanceMinutes"]) expect(alta).toContain(`"${campo}"`);
  });
});

describe("FIX-001 e2 · el residente ve y respeta las reglas del área", () => {
  const pagina = leer("src/app/(resident)/resident/reservations/page.tsx");

  it("la antelación es la del área, no los 30 fijos", () => {
    expect(pagina).toMatch(/anticipacionDelArea\(/);
    expect(pagina).toMatch(/minimoPermitido\(/);
    expect(pagina).not.toMatch(/getMinAllowedDateTime\(\s*"reservation"/);
    expect(pagina).not.toMatch(/isDateTimeValid\(\s*selectedDateTime\s*,\s*"reservation"\s*\)/);
  });

  it("el aviso dice si la reserva nació aprobada o pendiente", () => {
    expect(pagina).toMatch(/status === "approved"/);
    expect(pagina).toMatch(/Reserva aprobada/);
  });

  it("la ficha del área enseña la anticipación y cómo se aprueba", () => {
    expect(pagina).toMatch(/Anticipación mínima/);
    expect(pagina).toMatch(/Se aprueba al instante/);
  });

  it("el aviso de mora usa la política del área elegida", () => {
    expect(pagina).toMatch(/checkReservationEligibility\([^)]*blockOnDebt/);
  });

  it("el área que ve el residente trae los tres campos", () => {
    const tipo = leer("src/features/reservations/use-reservable-amenities.ts");
    expect(tipo).toMatch(/blockOnDebt\?: boolean \| null/);
    expect(tipo).toMatch(/autoApprove\?: boolean/);
    expect(tipo).toMatch(/minAdvanceMinutes\?: number/);
  });
});
