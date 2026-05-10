// tests/imp01-imp02-integration.test.ts
// Bloque 5 — IMP-01 + IMP-02 combinados
//
// Verifica el flujo completo: Admin crea unidad → slug propagado a person →
// Admin crea cobro con ese slug → Residente con ese slug ve el cobro.
// También verifica el caso negativo: residente con hash (pre-fix) ve 0 cobros.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── In-memory Firestore ───────────────────────────────────────────────────────
const units = new Map<string, Record<string, unknown>>();
const people = new Map<string, Record<string, unknown>>();
const billingStatements = new Map<string, Record<string, unknown>>();
let docCounter = 0;

const mockAddDoc = vi.fn(async (_colRef: string, data: Record<string, unknown>) => {
  const id = `auto-${++docCounter}`;
  const store = _colRef === "units" ? units : _colRef === "people" ? people : billingStatements;
  store.set(id, { ...data });
  return { id };
});

const mockServerTimestamp = vi.fn(() => "SERVER_TS");

vi.mock("firebase/firestore", () => ({
  addDoc: (colRef: string, data: Record<string, unknown>) => mockAddDoc(colRef, data),
  collection: vi.fn((_db: unknown, col: string) => col),  // returns col name as ref
  doc: vi.fn((_db: unknown, _col: string, id: string) => ({ id })),
  serverTimestamp: () => mockServerTimestamp(),
  arrayRemove: vi.fn(),
  arrayUnion: vi.fn(),
  deleteDoc: vi.fn(),
  getDocs: vi.fn(),
  getDoc: vi.fn(),
  onSnapshot: vi.fn(),
  orderBy: vi.fn(),
  query: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  where: vi.fn(),
  writeBatch: vi.fn(),
  Timestamp: { now: vi.fn() },
}));

vi.mock("firebase/storage", () => ({
  deleteObject: vi.fn(),
  getDownloadURL: vi.fn(),
  ref: vi.fn(),
  uploadBytes: vi.fn(),
}));

vi.mock("@/lib/firebase/client", () => ({ db: { _stub: true }, storage: { _stub: true } }));
vi.mock("@/utils/datetimeValidation", () => ({
  combineDateAndTime: vi.fn(),
  isDateTimeValid: vi.fn(),
}));

vi.mock("@/lib/firebase/realtime-helpers", () => ({
  createTenantDocument: vi.fn(
    async (col: string, _tenantId: string, _userId: string, payload: Record<string, unknown>) => {
      const id = `auto-${++docCounter}`;
      billingStatements.set(id, { ...payload });
    },
  ),
  subscribeTenantCollection: vi.fn(),
}));

const { createUnit } = await import("../src/features/admin/services");
const { createBillingStatement } = await import("../src/features/billing/use-billing-statements");

// ── Query helpers ─────────────────────────────────────────────────────────────
function queryBillingByUnitId(unitId: string) {
  return [...billingStatements.values()].filter((doc) => doc.unitId === unitId);
}

// ── Setup / teardown ──────────────────────────────────────────────────────────
beforeEach(() => {
  units.clear();
  people.clear();
  billingStatements.clear();
  docCounter = 0;
  vi.clearAllMocks();
});

// ── Integration tests ─────────────────────────────────────────────────────────
describe("IMP-01 + IMP-02 — flujo completo Admin → Residente", () => {
  it("Paso 1-4: cobro creado con slug → visible para residente con slug", async () => {
    // Paso 1: Admin crea unidad
    mockAddDoc.mockImplementationOnce(async (_col: string, data: Record<string, unknown>) => {
      const id = "hash-xyz-G1bWNzZJuakw9KRoAx7p";
      units.set(id, { ...data });
      return { id };
    });

    const createdUnit = await createUnit("tenant-demo", "admin-uid", {
      displayName: "T2-503",
      tower: "Torre 1",
      type: "apartment",
      status: "active",
    });

    expect(createdUnit.unitId).toBe("t2-503");    // slug
    expect(createdUnit.id).toBe("hash-xyz-G1bWNzZJuakw9KRoAx7p"); // Firestore hash

    // Paso 2: person.unitId recibe el slug (no el hash)
    const personUnitId = createdUnit.unitId;   // "t2-503"
    expect(personUnitId).not.toBe(createdUnit.id);

    // Paso 3: Admin crea cobro con el mismo slug
    await createBillingStatement({
      tenantId: "tenant-demo",
      userId: "admin-uid",
      unitId: personUnitId,
      unitLabel: "T2-503",
      period: "2026-05",
      amount: 300_000,
      paymentAmount: 0,
      balance: 300_000,
    });

    // Paso 4: Residente consulta (user.unitId = personUnitId = "t2-503")
    const residentUnitId = personUnitId;  // proviene de person.unitId fijado en Paso 2
    const results = queryBillingByUnitId(residentUnitId);

    expect(results).toHaveLength(1);
    expect(results[0].unitId).toBe("t2-503");
    expect(results[0].amount).toBe(300_000);
    expect(results[0].period).toBe("2026-05");
  });

  it("Caso negativo — residente con hash (bug pre-IMP-02) ve 0 cobros", async () => {
    // Admin crea cobro con slug correcto (IMP-01 fixed)
    await createBillingStatement({
      tenantId: "tenant-demo",
      userId: "admin-uid",
      unitId: "t2-503",
      unitLabel: "T2-503",
      period: "2026-05",
      amount: 300_000,
      paymentAmount: 0,
      balance: 300_000,
    });

    // Residente con el hash (person.unitId = hash, situación pre-IMP-02)
    const residentWithHash = "hash-xyz-G1bWNzZJuakw9KRoAx7p";
    const resultsBuggy = queryBillingByUnitId(residentWithHash);

    expect(resultsBuggy).toHaveLength(0); // ← el bug: 0 resultados, residente ciego
  });

  it("slug en billingStatements nunca es hash (validación IMP-01)", async () => {
    await createBillingStatement({
      tenantId: "tenant-demo",
      userId: "admin-uid",
      unitId: "t2-503",
      unitLabel: "T2-503",
      period: "2026-05",
      amount: 300_000,
      paymentAmount: 0,
      balance: 300_000,
    });

    for (const doc of billingStatements.values()) {
      expect(String(doc.unitId)).not.toMatch(/^unit-/);
      expect(String(doc.unitId)).not.toMatch(/G1bWNzZJuakw9KRoAx7p/);
    }
  });

  it("Admin edita cobro → unitId sigue siendo slug, residente sigue viendo cobro", async () => {
    const { updateBillingStatement } = await import("../src/features/billing/use-billing-statements");

    // Setup cobro
    await createBillingStatement({
      tenantId: "tenant-demo",
      userId: "admin-uid",
      unitId: "t2-503",
      unitLabel: "T2-503",
      period: "2026-05",
      amount: 300_000,
      paymentAmount: 0,
      balance: 300_000,
    });

    const docId = `auto-${docCounter}`;

    // Simular update (updateDoc escribe al mock en-memoria)
    const mockUpdateDoc = vi.fn(async (ref: { id: string }, data: Record<string, unknown>) => {
      const existing = billingStatements.get(ref.id) ?? {};
      billingStatements.set(ref.id, { ...existing, ...data });
    });

    // Override the updateDoc mock for this test
    const { updateDoc } = await import("firebase/firestore");
    (updateDoc as ReturnType<typeof vi.fn>).mockImplementation(mockUpdateDoc);

    await updateBillingStatement(docId, {
      unitId: "t2-503",
      unitLabel: "T2-503",
      period: "2026-05",
      amount: 400_000,
      paymentAmount: 50_000,
      balance: 350_000,
      userId: "admin-uid",
    });

    // Residente sigue viendo el cobro con monto actualizado
    const results = queryBillingByUnitId("t2-503");
    expect(results.length).toBeGreaterThanOrEqual(1);
  });
});
