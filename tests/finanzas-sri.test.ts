// tests/finanzas-sri.test.ts
// F2 · G1 — armado del documento SRI y ciclo de transmisión (transporte stub).

import { describe, expect, it, vi } from "vitest";

vi.mock("firebase-admin/firestore", () => ({
  Timestamp: { now: () => "TS" },
}));

import {
  buildSriDocument,
  stubSriTransport,
  transmitVoucher,
} from "../functions/src/sri-ecuador";

describe("buildSriDocument", () => {
  it("exige RUC del conjunto y cédula del condómino", () => {
    expect(buildSriDocument({ payerTaxId: "171" }).error).toMatch(/RUC/i);
    expect(buildSriDocument({ issuerTaxId: "179" }).error).toMatch(/cédula/i);
  });

  it("arma el documento cuando los datos están completos", () => {
    const { document, error } = buildSriDocument({
      issuerTaxId: "1790012345001",
      payerTaxId: "1712345678",
      sequentialNumber: "001-001-000000007",
      issueDate: "2026-06-01",
      amount: 250,
      concept: "Alícuota 2026-06",
    });
    expect(error).toBeUndefined();
    expect(document?.ruc).toBe("1790012345001");
    expect(document?.cedula).toBe("1712345678");
  });
});

type FakeUpdate = Record<string, unknown>;

function makeDb(voucher: Record<string, unknown> | null) {
  const updates: FakeUpdate[] = [];
  const db = {
    collection: () => ({
      doc: () => ({
        get: async () => ({ exists: voucher !== null, data: () => voucher }),
        update: async (payload: FakeUpdate) => {
          updates.push(payload);
        },
      }),
    }),
  };
  // El tipo real es Firestore; en el test usamos un doble compatible.
  return { db: db as unknown as Parameters<typeof transmitVoucher>[0], updates };
}

describe("transmitVoucher", () => {
  it("marca transmitted con referencia cuando el POST es exitoso", async () => {
    const { db, updates } = makeDb({
      issuerCountry: "EC",
      issuerTaxId: "1790012345001",
      payerTaxId: "1712345678",
      sequentialNumber: "001-001-000000007",
      issueDate: "2026-06-01",
      amount: 250,
      concept: "Alícuota",
    });
    await transmitVoucher(db, "v1", stubSriTransport);
    expect(updates).toHaveLength(1);
    expect(updates[0].fiscalStatus).toBe("transmitted");
    expect(updates[0].fiscalProviderRef).toBe("STUB-001-001-000000007");
  });

  it("marca error si falta la cédula", async () => {
    const { db, updates } = makeDb({
      issuerCountry: "EC",
      issuerTaxId: "1790012345001",
      sequentialNumber: "001-001-000000008",
      amount: 100,
    });
    await transmitVoucher(db, "v1", stubSriTransport);
    expect(updates[0].fiscalStatus).toBe("error");
  });

  it("ignora comprobantes que no son de Ecuador", async () => {
    const { db, updates } = makeDb({ issuerCountry: "CO", amount: 100 });
    await transmitVoucher(db, "v1", stubSriTransport);
    expect(updates).toHaveLength(0);
  });
});
