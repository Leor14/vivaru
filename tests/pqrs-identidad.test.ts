import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { personaDelTicket, unidadDelTicket, PERSONA_SIN_NOMBRE } from "@/features/pqrs/identidad-del-ticket";
import { buildUnitIndex, UNRESOLVED_UNIT_LABEL } from "@/utils/unitLabel";

/**
 * **`L-21d` — PQRS enseñaba la unidad como un id crudo y al residente como «Residente».**
 *
 * Los casos salen de los datos de producción medidos el 17 sep 2026: 6 de 54 tickets con la
 * etiqueta `torre1-<id>` o `T3-<id>`, y 4 sin nombre de residente.
 */

// Las dos unidades reales de los seis tickets sucios de Santa María.
const indice = buildUnitIndex([
  { id: "DFPjKffOOGZXRjzlScxk", unitId: "u-t1-403", displayName: "T1-403" },
  { id: "9YLUY4ki4uny212nKxnp", unitId: "t3-1014", displayName: "1014" },
]);

describe("L-21d · la unidad de un PQRS", () => {
  it("resuelve la etiqueta con el id pegado, que es el caso de la captura", () => {
    expect(
      unidadDelTicket({ unitId: "DFPjKffOOGZXRjzlScxk", unitLabel: "torre1-G1bWNzZJuakw9KRoAx7p" }, indice),
    ).toBe("T1-403");
  });

  it("el unitId manda sobre la etiqueta: al revés, el id de la etiqueta ganaría", () => {
    expect(unidadDelTicket({ unitId: "9YLUY4ki4uny212nKxnp", unitLabel: "T3-9YLUY4ki4uny212nKxnp" }, indice)).toBe(
      "1014",
    );
  });

  it("una etiqueta humana se respeta tal cual", () => {
    expect(unidadDelTicket({ unitId: "", unitLabel: "APARTAMENTO 201" }, indice)).toBe("APARTAMENTO 201");
  });

  it("y si nada resuelve, nunca se enseña el id crudo", () => {
    const fuera = unidadDelTicket({ unitId: "ZZZZZZZZZZZZZZZZZZZZ", unitLabel: "torre9-ZZZZZZZZZZZZZZZZZZZZ" }, indice);
    expect(fuera).toBe(UNRESOLVED_UNIT_LABEL);
    expect(fuera).not.toMatch(/[A-Za-z0-9]{20}/);
    expect(unidadDelTicket({}, indice)).toBe(UNRESOLVED_UNIT_LABEL);
  });
});

describe("L-21d · la persona de un PQRS", () => {
  const nombres = new Map([["uid-jaime", "Jaime Gutierrez"]]);

  it("recupera el nombre por el uid cuando el ticket no lo guardó", () => {
    expect(personaDelTicket({ residentId: "uid-jaime", residentName: null }, nombres)).toBe("Jaime Gutierrez");
    expect(personaDelTicket({ residentId: "uid-jaime", residentName: PERSONA_SIN_NOMBRE }, nombres)).toBe(
      "Jaime Gutierrez",
    );
  });

  it("respeta el nombre que el ticket ya trae", () => {
    expect(personaDelTicket({ residentId: "uid-jaime", residentName: "Ana Lucía Pérez" }, nombres)).toBe(
      "Ana Lucía Pérez",
    );
  });

  it("y sin nombre en ningún lado no inventa una persona", () => {
    expect(personaDelTicket({ residentId: "uid-nadie" }, nombres)).toBe(PERSONA_SIN_NOMBRE);
    expect(personaDelTicket({}, nombres)).toBe(PERSONA_SIN_NOMBRE);
  });
});

describe("L-21d · guardián: la pantalla usa el resolvedor", () => {
  const PAGINA = path.resolve("src/app/(admin)/admin/pqrs/page.tsx");
  const codigo = fs
    .readFileSync(PAGINA, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

  it("arma cada fila con las dos funciones, y ya no pinta `unitLabel` tal cual", () => {
    expect(codigo).toMatch(/unitLabel = unidadDelTicket\(ticket, indiceDeUnidades\)/);
    expect(codigo).toMatch(/residentName = personaDelTicket\(ticket, nombrePorUid\)/);
    expect(codigo).not.toMatch(/ticket\.unitLabel \|\| "Sin unidad"/);
  });

  it("y el memo depende del índice y de los nombres: si no, se queda con el índice vacío", () => {
    expect(codigo).toMatch(/\[items, indiceDeUnidades, nombrePorUid\]/);
  });
});
