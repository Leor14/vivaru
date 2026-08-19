// tests/billing-create-update.test.ts
// Bloque 1 — createBillingStatement + updateBillingStatement

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks ────────────────────────────────────────────────────────────────────
const mockCreateTenantDocument = vi.fn();
const mockUpdateDoc = vi.fn();
const mockDoc = vi.fn(() => "doc-ref-stub");
const mockServerTimestamp = vi.fn(() => "SERVER_TS");

vi.mock("@/lib/firebase/realtime-helpers", () => ({
  createTenantDocument: (...args: Parameters<typeof mockCreateTenantDocument>) => mockCreateTenantDocument(...args),
  subscribeTenantCollection: vi.fn(),
}));

vi.mock("firebase/firestore", () => ({
  doc: (...args: Parameters<typeof mockDoc>) => mockDoc(...args),
  updateDoc: (...args: Parameters<typeof mockUpdateDoc>) => mockUpdateDoc(...args),
  serverTimestamp: () => mockServerTimestamp(),
  addDoc: vi.fn(),
  collection: vi.fn(),
  onSnapshot: vi.fn(),
  orderBy: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
}));

vi.mock("@/lib/firebase/client", () => ({ db: {} }));

// ── Import after mocks ────────────────────────────────────────────────────────
const { createBillingStatement, updateBillingStatement } = await import(
  "../src/features/billing/use-billing-statements"
);

// ── Helpers ──────────────────────────────────────────────────────────────────
function baseCreateInput(overrides?: Partial<Parameters<typeof createBillingStatement>[0]>) {
  return {
    tenantId: "tenant-abc",
    userId: "user-admin",
    unitId: "real-id-101",
    unitLabel: "Apto 101",
    period: "2026-01",
    amount: 300_000,
    paymentAmount: 0,
    balance: 300_000,
    ...overrides,
  };
}

function baseUpdateInput(overrides?: Partial<Parameters<typeof updateBillingStatement>[1]>) {
  return {
    unitId: "real-id-101",
    unitLabel: "Apto 101",
    period: "2026-01",
    amount: 300_000,
    paymentAmount: 0,
    balance: 300_000,
    userId: "user-admin",
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────
describe("createBillingStatement", () => {
  beforeEach(() => {
    mockCreateTenantDocument.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("con unitId válido → crea doc con ese unitId exacto (no slug)", async () => {
    await createBillingStatement(baseCreateInput({ unitId: "real-id-101", unitLabel: "Apto 101" }));

    expect(mockCreateTenantDocument).toHaveBeenCalledOnce();
    const payload = mockCreateTenantDocument.mock.calls[0][3] as Record<string, unknown>;

    expect(payload.unitId).toBe("real-id-101");
    // Nunca debe escribir slug derivado
    expect(String(payload.unitId)).not.toMatch(/^unit-/);
  });

  it("con unitId undefined → lanza error con 'unitId es obligatorio'", async () => {
    const input = baseCreateInput({ unitId: undefined } as never);

    await expect(createBillingStatement(input)).rejects.toThrow("unitId es obligatorio");
    expect(mockCreateTenantDocument).not.toHaveBeenCalled();
  });

  it("con unitId vacío '' → lanza el mismo error", async () => {
    await expect(createBillingStatement(baseCreateInput({ unitId: "" }))).rejects.toThrow(
      "unitId es obligatorio",
    );
    expect(mockCreateTenantDocument).not.toHaveBeenCalled();
  });

  it("nunca escribe unitId con prefijo 'unit-' derivado de unitLabel", async () => {
    // unitLabel tiene forma que el slug antiguo convertiría a "unit-apto-101"
    await createBillingStatement(baseCreateInput({ unitId: "real-id-101", unitLabel: "Apto 101" }));

    const payload = mockCreateTenantDocument.mock.calls[0][3] as Record<string, unknown>;
    expect(payload.unitId).not.toBe("unit-apto-101");
    expect(String(payload.unitId)).not.toMatch(/^unit-apto/);
  });
});

describe("updateBillingStatement", () => {
  beforeEach(() => {
    mockUpdateDoc.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("cuando input incluye unitId → updateDoc escribe ese unitId", async () => {
    await updateBillingStatement("doc-123", baseUpdateInput({ unitId: "real-id-202" }));

    expect(mockUpdateDoc).toHaveBeenCalledOnce();
    const payload = mockUpdateDoc.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.unitId).toBe("real-id-202");
  });

  it("cuando input NO incluye unitId → updateDoc NO incluye campo unitId", async () => {
    const input = baseUpdateInput({ unitId: undefined });
    await updateBillingStatement("doc-123", input);

    const payload = mockUpdateDoc.mock.calls[0][1] as Record<string, unknown>;
    expect(Object.prototype.hasOwnProperty.call(payload, "unitId")).toBe(false);
  });

  it("unitLabel se actualiza independientemente del unitId", async () => {
    await updateBillingStatement(
      "doc-123",
      baseUpdateInput({ unitId: "real-id-101", unitLabel: "Apto 101 - Piso 3" }),
    );

    const payload = mockUpdateDoc.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.unitLabel).toBe("Apto 101 - Piso 3");
    expect(payload.unitId).toBe("real-id-101");
    // unitId no fue recalculado desde unitLabel
    expect(String(payload.unitId)).not.toMatch(/^unit-apto-101-piso-3/);
  });

  it("nunca escribe slug derivado de unitLabel (idempotencia del bug corregido)", async () => {
    await updateBillingStatement("doc-123", baseUpdateInput({ unitId: "real-id-303", unitLabel: "Torre 2 Apto 303" }));

    const payload = mockUpdateDoc.mock.calls[0][1] as Record<string, unknown>;
    // El bug antiguo produciría "unit-torre-2-apto-303"
    expect(payload.unitId).not.toBe("unit-torre-2-apto-303");
    expect(payload.unitId).toBe("real-id-303");
  });
});
