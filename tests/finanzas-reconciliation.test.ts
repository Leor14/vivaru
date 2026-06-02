// tests/finanzas-reconciliation.test.ts
// F1 · C4 — parsing de extracto bancario CSV.

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/firebase/client", () => ({ db: {} }));
vi.mock("@/lib/firebase/realtime-helpers", () => ({
  createTenantDocument: vi.fn(),
  subscribeTenantCollection: vi.fn(),
}));
vi.mock("firebase/firestore", () => ({
  doc: vi.fn(),
  deleteDoc: vi.fn(),
  updateDoc: vi.fn(),
  serverTimestamp: vi.fn(() => "SERVER_TS"),
  writeBatch: vi.fn(),
}));

import {
  mapRowsToLines,
  normalizeDate,
  parseDelimited,
  parseMoney,
} from "@/features/finanzas/use-reconciliation";

describe("parseMoney", () => {
  it("formato LATAM con miles y decimales", () => {
    expect(parseMoney("1.234,56")).toBe(1234.56);
    expect(parseMoney("$ 1.200")).toBe(1200);
  });
  it("formato US", () => {
    expect(parseMoney("1,234.56")).toBe(1234.56);
    expect(parseMoney("1234.56")).toBe(1234.56);
  });
  it("negativos y vacíos", () => {
    expect(parseMoney("-50")).toBe(-50);
    expect(parseMoney("")).toBeNull();
    expect(parseMoney("abc")).toBeNull();
  });
});

describe("normalizeDate", () => {
  it("acepta ISO y convierte dd/mm/yyyy", () => {
    expect(normalizeDate("2026-06-01")).toBe("2026-06-01");
    expect(normalizeDate("01/06/2026")).toBe("2026-06-01");
    expect(normalizeDate("1-6-26")).toBe("2026-06-01");
    expect(normalizeDate("no es fecha")).toBe("");
  });
});

describe("parseDelimited + mapRowsToLines", () => {
  it("detecta delimitador ; y mapea columnas en español", () => {
    const csv = "Fecha;Concepto;Monto\n01/06/2026;Pago energia;-150000\n02/06/2026;Cuota T1-101;1.200.000";
    const { headers, rows } = parseDelimited(csv);
    expect(headers).toEqual(["fecha", "concepto", "monto"]);
    const lines = mapRowsToLines(headers, rows);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toEqual({ date: "2026-06-01", description: "Pago energia", amount: -150000 });
    expect(lines[1].amount).toBe(1200000);
  });

  it("omite filas sin fecha o monto válidos", () => {
    const csv = "date,description,amount\n2026-06-01,Ok,100\n,Sin fecha,200\n2026-06-03,Sin monto,abc";
    const { headers, rows } = parseDelimited(csv);
    const lines = mapRowsToLines(headers, rows);
    expect(lines).toHaveLength(1);
    expect(lines[0].amount).toBe(100);
  });
});
