import { describe, expect, it } from "vitest";

import { addBusinessDays, businessDaysUntil, getTicketSla } from "../src/features/pqrs/sla";

describe("pqrs sla", () => {
  it("calculates due date with 15 business days excluding weekends", () => {
    const start = new Date("2026-03-02T10:00:00.000Z"); // Monday
    const due = addBusinessDays(start, 15);

    expect(due.getDay()).not.toBe(0);
    expect(due.getDay()).not.toBe(6);
    expect(due.toISOString().slice(0, 10)).toBe("2026-03-23");
  });

  it("returns 0 business days when due date is today", () => {
    const now = new Date("2026-03-23T08:00:00.000Z");
    const due = new Date("2026-03-23T17:00:00.000Z");

    expect(businessDaysUntil(now, due)).toBe(0);
  });

  it("marks ticket as yellow when 1-5 business days remain", () => {
    const radicationDate = "2026-03-02T10:00:00.000Z";
    const sla = getTicketSla({
      radicationDate,
      status: "open",
      responseDate: "2026-03-18T10:00:00.000Z",
    });

    expect(sla.level).toBe("yellow");
  });

  it("marks ticket as red when expired", () => {
    const radicationDate = "2026-03-02T10:00:00.000Z";
    const sla = getTicketSla({
      radicationDate,
      status: "open",
      responseDate: "2026-03-25T10:00:00.000Z",
    });

    expect(sla.level).toBe("red");
    expect((sla.businessDaysRemaining ?? 0) <= 0).toBe(true);
  });
});
