import { describe, expect, it } from "vitest";

import { findReservationConflict } from "@/features/reservations/conflicts";

const base = { id: "r1", amenityName: "Salón comunal", date: "2026-07-10", startTime: "10:00", endTime: "12:00", status: "approved" };

describe("findReservationConflict", () => {
  it("detecta solapamiento parcial (misma amenidad y día)", () => {
    const hit = findReservationConflict([base], { amenityName: "Salón comunal", date: "2026-07-10", startTime: "11:00", endTime: "13:00" });
    expect(hit?.id).toBe("r1");
  });

  it("detecta contención total", () => {
    const hit = findReservationConflict([base], { amenityName: "Salón comunal", date: "2026-07-10", startTime: "10:30", endTime: "11:00" });
    expect(hit?.id).toBe("r1");
  });

  it("horarios contiguos NO chocan (fin 12:00, inicio 12:00)", () => {
    expect(findReservationConflict([base], { amenityName: "Salón comunal", date: "2026-07-10", startTime: "12:00", endTime: "14:00" })).toBeNull();
  });

  it("otra amenidad u otro día no chocan", () => {
    expect(findReservationConflict([base], { amenityName: "Piscina", date: "2026-07-10", startTime: "11:00", endTime: "12:00" })).toBeNull();
    expect(findReservationConflict([base], { amenityName: "Salón comunal", date: "2026-07-11", startTime: "11:00", endTime: "12:00" })).toBeNull();
  });

  it("ignora canceladas y la propia reserva al editar", () => {
    expect(findReservationConflict([{ ...base, status: "cancelled" }], { amenityName: "Salón comunal", date: "2026-07-10", startTime: "11:00", endTime: "12:00" })).toBeNull();
    expect(findReservationConflict([base], { amenityName: "Salón comunal", date: "2026-07-10", startTime: "11:00", endTime: "12:00" }, "r1")).toBeNull();
  });

  it("legadas sin endTime cuentan como 1 hora", () => {
    const legacy = { ...base, id: "r2", startTime: "15:00", endTime: undefined };
    expect(findReservationConflict([legacy], { amenityName: "Salón comunal", date: "2026-07-10", startTime: "15:30", endTime: "16:30" })?.id).toBe("r2");
    expect(findReservationConflict([legacy], { amenityName: "Salón comunal", date: "2026-07-10", startTime: "16:00", endTime: "17:00" })).toBeNull();
  });
});
