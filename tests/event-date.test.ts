import { describe, expect, it } from "vitest";

import { asDateKey, resolveTicketEventDate, resolveVisitorEventDate } from "@/utils/event-date";

describe("asDateKey", () => {
  it("devuelve tal cual un date-key YYYY-MM-DD (sin desfase de zona)", () => {
    expect(asDateKey("2026-06-15")).toBe("2026-06-15");
  });
  it("devuelve '' para vacío o inválido", () => {
    expect(asDateKey("")).toBe("");
    expect(asDateKey(undefined)).toBe("");
    expect(asDateKey("no es fecha")).toBe("");
  });
});

describe("resolveVisitorEventDate", () => {
  it("prioriza date sobre visitDate y checkInAt", () => {
    expect(
      resolveVisitorEventDate({ date: "2026-06-15", visitDate: "2026-05-20", checkInAt: "2026-04-01" }),
    ).toBe("2026-06-15");
  });
  it("cae a visitDate cuando no hay date", () => {
    expect(resolveVisitorEventDate({ date: "", visitDate: "2026-05-20" })).toBe("2026-05-20");
  });
  it("devuelve '' cuando no hay ninguna fecha", () => {
    expect(resolveVisitorEventDate({})).toBe("");
  });
});

describe("resolveTicketEventDate", () => {
  it("prioriza radicationDate", () => {
    expect(resolveTicketEventDate({ radicationDate: "2026-03-01", createdAt: "2026-03-05" })).toBe("2026-03-01");
  });
  it("cae a createdAt cuando no hay radicationDate", () => {
    expect(resolveTicketEventDate({ createdAt: "2026-03-05" })).toBe("2026-03-05");
  });
});
