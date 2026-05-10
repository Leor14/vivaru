// tests/billing-integration.test.ts
// Bloque 4 — Integración end-to-end con Firestore en memoria

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── In-memory Firestore stub ──────────────────────────────────────────────────
type FirestoreDoc = Record<string, unknown>;
const store = new Map<string, FirestoreDoc>();
let docIdCounter = 0;

const mockAddDoc = vi.fn(async (_colRef: unknown, data: FirestoreDoc) => {
  const id = `auto-${++docIdCounter}`;
  store.set(id, { ...data });
  return { id };
});

const mockUpdateDoc = vi.fn(async (ref: { id: string }, data: FirestoreDoc) => {
  const existing = store.get(ref.id) ?? {};
  store.set(ref.id, { ...existing, ...data });
});

const mockDoc = vi.fn((_db: unknown, _col: string, id: string) => ({ id }));
const mockCollection = vi.fn(() => "col-ref-stub");
const mockServerTimestamp = vi.fn(() => "SERVER_TS");

vi.mock("firebase/firestore", () => ({
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  doc: (...args: unknown[]) => mockDoc(...args),
  collection: (...args: unknown[]) => mockCollection(...args),
  serverTimestamp: () => mockServerTimestamp(),
  onSnapshot: vi.fn(),
  orderBy: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
}));

vi.mock("@/lib/firebase/client", () => ({ db: { _stub: true } }));

// createTenantDocument delegates to addDoc; mock realtime-helpers to call mockAddDoc
vi.mock("@/lib/firebase/realtime-helpers", () => ({
  createTenantDocument: vi.fn(
    async (_col: string, tenantId: string, userId: string, payload: FirestoreDoc) => {
      await mockAddDoc("col-ref-stub", { ...payload, tenantId, createdBy: userId, updatedBy: userId });
    },
  ),
  subscribeTenantCollection: vi.fn(),
}));

const { createBillingStatement, updateBillingStatement } = await import(
  "../src/features/billing/use-billing-statements"
);

// ── Helpers ───────────────────────────────────────────────────────────────────
function queryByUnitId(unitId: string) {
  return [...store.values()].filter((doc) => doc.unitId === unitId);
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe("Integración — flujo Admin crea → Residente consulta", () => {
  beforeEach(() => {
    store.clear();
    docIdCounter = 0;
    vi.clearAllMocks();
  });

  it("Admin crea cobro con unitId real → query del Residente devuelve 1 resultado", async () => {
    // 1. Estado inicial: colección vacía, residente con unitId "real-id-101"
    expect(queryByUnitId("real-id-101")).toHaveLength(0);

    // 2. Admin crea cobro
    await createBillingStatement({
      tenantId: "tenant-demo",
      userId: "admin-uid",
      unitId: "real-id-101",
      unitLabel: "Apto 101",
      period: "2026-01",
      amount: 300_000,
      paymentAmount: 0,
      balance: 300_000,
    });

    // 3 & 4. Query del Residente (filtra por unitId "real-id-101")
    const results = queryByUnitId("real-id-101");
    expect(results).toHaveLength(1);

    // 5. unitId en Firestore es el real, nunca el slug
    expect(results[0].unitId).toBe("real-id-101");
    expect(String(results[0].unitId)).not.toMatch(/^unit-/);
  });

  it("Admin edita cobro → unitId sigue siendo el real después del update", async () => {
    // Setup: crear cobro
    await createBillingStatement({
      tenantId: "tenant-demo",
      userId: "admin-uid",
      unitId: "real-id-101",
      unitLabel: "Apto 101",
      period: "2026-01",
      amount: 300_000,
      paymentAmount: 0,
      balance: 300_000,
    });

    const docId = `auto-${docIdCounter}`;

    // Admin edita monto a 350_000
    await updateBillingStatement(docId, {
      unitId: "real-id-101",
      unitLabel: "Apto 101",
      period: "2026-01",
      amount: 350_000,
      paymentAmount: 0,
      balance: 350_000,
      userId: "admin-uid",
    });

    const doc = store.get(docId);
    expect(doc).toBeDefined();

    // unitId no fue sobreescrito ni derivado como slug
    expect(doc!.unitId).toBe("real-id-101");
    expect(doc!.amount).toBe(350_000);
    expect(String(doc!.unitId)).not.toMatch(/^unit-apto-101$/);
  });

  it("Residente con distinto unitId NO ve cobros de otra unidad", async () => {
    await createBillingStatement({
      tenantId: "tenant-demo",
      userId: "admin-uid",
      unitId: "real-id-101",
      unitLabel: "Apto 101",
      period: "2026-01",
      amount: 300_000,
      paymentAmount: 0,
      balance: 300_000,
    });

    // Residente de unidad diferente no debe ver el cobro
    const ajeno = queryByUnitId("real-id-202");
    expect(ajeno).toHaveLength(0);

    // Residente correcto sí lo ve
    const propio = queryByUnitId("real-id-101");
    expect(propio).toHaveLength(1);
  });

  it("createBillingStatement sin unitId → no persiste nada y lanza error", async () => {
    await expect(
      createBillingStatement({
        tenantId: "tenant-demo",
        userId: "admin-uid",
        unitId: "" as never,
        unitLabel: "Apto 101",
        period: "2026-01",
        amount: 300_000,
        paymentAmount: 0,
        balance: 300_000,
      }),
    ).rejects.toThrow("unitId es obligatorio");

    expect(store.size).toBe(0);
  });
});
