import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { amenityIdPorNombre } from "@/features/reservations/amenity-por-nombre";
import { contarUsoMensual, rangoDelMes } from "@/features/reservations/uso-mensual";

/**
 * `PRD-V-FIX-001` entrega 1.1 — los cabos del CLIENTE que dejó la entrega 1.
 *
 * - Las reservas del administrador se guardaban sin `amenityId`, y el servidor
 *   cuenta aforo y cupo por ese campo: un residente podía reservar encima.
 * - El contador del cupo mensual del residente consultaba
 *   `tenants/{id}/reservations`, una subcolección que no existe: siempre fallaba,
 *   el `catch` lo callaba y el botón nunca se desactivaba.
 * - La mudanza se creaba con `addDoc`, y desde el 24 ago la regla solo deja crear
 *   al administrador (`CA11`).
 */

const leer = (ruta: string) =>
  fs
    .readFileSync(path.resolve(ruta), "utf-8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

function cuerpo(src: string, firma: string) {
  const inicio = src.indexOf(firma);
  expect(inicio, `no está: ${firma}`).toBeGreaterThan(-1);
  return src.slice(inicio, src.indexOf("\n}\n", inicio));
}

describe("FIX-001 e1.1 · el área de una reserva del administrador", () => {
  const AREAS = [
    { id: "a1", name: "Salón social" },
    { id: "a2", name: "Gimnasio" },
  ];

  it("resuelve el id por el nombre, sin distinguir mayúsculas ni espacios", () => {
    expect(amenityIdPorNombre(AREAS, "  salón SOCIAL ")).toBe("a1");
  });

  // Medido el 12 sep: ningún conjunto tiene dos áreas con el mismo nombre. Si
  // algún día las hay, no se elige una al azar.
  it("sin coincidencia, o con dos, no inventa: null", () => {
    expect(amenityIdPorNombre(AREAS, "Piscina")).toBeNull();
    expect(amenityIdPorNombre([...AREAS, { id: "a3", name: "Gimnasio" }], "Gimnasio")).toBeNull();
  });

  it("la reserva del administrador se guarda con amenityId, resuelto en la página", () => {
    expect(cuerpo(leer("src/features/admin/services.ts"), "export async function createReservation(")).toMatch(
      /amenityId/,
    );
    expect(leer("src/app/(admin)/admin/reservations/page.tsx")).toMatch(/amenityIdPorNombre\(/);
  });
});

describe("FIX-001 e1.1 · el cupo mensual que ve el residente", () => {
  it("el mes es el de la fecha elegida, con los mismos límites que el servidor", () => {
    expect(rangoDelMes("2026-09-12")).toEqual({ desde: "2026-09-01", hasta: "2026-09-31" });
  });

  it("no cuenta las canceladas ni las rechazadas", () => {
    expect(
      contarUsoMensual([{ status: "approved" }, { status: "pending" }, { status: "cancelled" }, { status: "rejected" }]),
    ).toBe(2);
  });

  it("la página cuenta en la colección raíz, no en una subcolección que no existe", () => {
    const page = leer("src/app/(resident)/resident/reservations/page.tsx");
    expect(page).not.toMatch(/collection\(\s*db\s*,\s*"tenants"\s*,\s*tenantId\s*,\s*"reservations"\s*\)/);
    expect(page).toMatch(/rangoDelMes\(/);
    expect(page).toMatch(/contarUsoMensual\(/);
  });
});

describe("FIX-001 e1.1 · la mudanza del residente va por el servidor", () => {
  it("createMudanzaReservation llama a la callable y ya no escribe directo", () => {
    const fn = cuerpo(leer("src/features/reservations/use-reservations.ts"), "export async function createMudanzaReservation(");
    expect(fn).not.toMatch(/addDoc\(/);
    expect(fn).toMatch(/createMudanzaRequestCallable\(/);
  });

  it("la callable del cliente se llama igual que la del servidor", () => {
    expect(leer("src/lib/firebase/callables.ts")).toMatch(/"createMudanzaRequest"/);
    expect(leer("functions/src/index.ts")).toMatch(/export const createMudanzaRequest = onCall/);
  });

  it("el asistente limita las notas a lo mismo que el servidor", () => {
    const max = /MAX_NOTAS_DE_MUDANZA\s*=\s*(\d+)/.exec(leer("functions/src/reservations.ts"))?.[1];
    expect(max, "el servidor no declara MAX_NOTAS_DE_MUDANZA").toBeDefined();
    expect(leer("src/components/features/reservations/MudanzaWizard.tsx")).toContain(`maxLength={${max}}`);
  });
});
