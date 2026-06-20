import { describe, expect, it } from "vitest";

import { computeStatementStatus } from "@/features/billing/statement-status";

const ASOF = "2026-06-19";

describe("computeStatementStatus", () => {
  it("sin saldo siempre está al día", () => {
    expect(computeStatementStatus(0, { period: "2026-01", asOf: ASOF })).toBe("paid");
    expect(computeStatementStatus(-100, { dueDate: "2026-01-01", asOf: ASOF })).toBe("paid");
  });

  it("con fecha de recaudo: vencida → en mora, futura → pendiente", () => {
    expect(computeStatementStatus(1000, { dueDate: "2026-05-01", asOf: ASOF })).toBe("overdue");
    expect(computeStatementStatus(1000, { dueDate: "2026-07-01", asOf: ASOF })).toBe("pending");
  });

  it("SIN fecha de recaudo: usa el período — mes pasado con saldo queda en mora", () => {
    expect(computeStatementStatus(1000, { period: "2026-03", asOf: ASOF })).toBe("overdue");
    expect(computeStatementStatus(1000, { period: "2026-06", asOf: ASOF })).toBe("pending");
    expect(computeStatementStatus(1000, { period: "2026-08", asOf: ASOF })).toBe("pending");
  });

  it("sin fecha ni período con saldo queda pendiente", () => {
    expect(computeStatementStatus(1000, { asOf: ASOF })).toBe("pending");
  });
});
