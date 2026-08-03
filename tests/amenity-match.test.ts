import { describe, expect, it } from "vitest";

import { reservationMatchesAmenity } from "@/features/reservations/amenity-match";

/**
 * Regresión de un fallo real de producción, 2 de agosto de 2026.
 *
 * `/resident/reservations` se caía entero en Las Playas con
 * «Cannot read properties of undefined (reading 'trim')». La condición vivía
 * duplicada en la página del residente y en el panel de portería; la copia de
 * portería tenía una guarda que la del residente nunca recibió.
 *
 * Los casos con `undefined` de aquí abajo son el fallo exacto: si alguien
 * vuelve a llamar `.trim()` sin comprobar el tipo, revientan.
 */
describe("reservationMatchesAmenity", () => {
  const amenidad = { id: "salon-1", name: "Salón Social" };

  it("empareja por amenityId cuando existe, sin mirar el nombre", () => {
    expect(
      reservationMatchesAmenity({ amenityId: "salon-1", amenity: "otro nombre" }, amenidad),
    ).toBe(true);
    expect(
      reservationMatchesAmenity({ amenityId: "gym-9", amenity: "Salón Social" }, amenidad),
    ).toBe(false);
  });

  it("cae al nombre cuando no hay amenityId", () => {
    expect(reservationMatchesAmenity({ amenity: "Salón Social" }, amenidad)).toBe(true);
  });

  it("ignora mayúsculas y espacios sobrantes al comparar nombres", () => {
    expect(reservationMatchesAmenity({ amenity: "  salón social  " }, amenidad)).toBe(true);
  });

  // ── El fallo de producción ────────────────────────────────────────────────
  it("no revienta si la reserva no trae amenity", () => {
    expect(() =>
      reservationMatchesAmenity({ amenity: undefined as unknown as string }, amenidad),
    ).not.toThrow();
    expect(reservationMatchesAmenity({ amenity: undefined as unknown as string }, amenidad)).toBe(
      false,
    );
  });

  it("no revienta si la amenidad no trae nombre", () => {
    const sinNombre = { id: "salon-1", name: undefined as unknown as string };
    expect(() => reservationMatchesAmenity({ amenity: "Salón Social" }, sinNombre)).not.toThrow();
    expect(reservationMatchesAmenity({ amenity: "Salón Social" }, sinNombre)).toBe(false);
  });

  it("dos registros sin nombre NO son la misma amenidad", () => {
    // Sin esta regla, cada reserva huérfana se pegaría a la amenidad que
    // estuviera seleccionada, porque "" === "".
    const sinNombre = { id: "salon-1", name: "   " };
    expect(reservationMatchesAmenity({ amenity: "  " }, sinNombre)).toBe(false);
    expect(
      reservationMatchesAmenity({ amenity: undefined as unknown as string }, sinNombre),
    ).toBe(false);
  });

  it("un amenityId vacío no cuenta como enlace: cae al nombre", () => {
    expect(reservationMatchesAmenity({ amenityId: "", amenity: "Salón Social" }, amenidad)).toBe(
      true,
    );
  });
});
