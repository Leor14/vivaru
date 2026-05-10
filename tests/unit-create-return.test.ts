// tests/unit-create-return.test.ts
// Bloque 1 — createUnit() retorna { id, unitId, displayName } — no string plano

import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────────────
const mockAddDoc = vi.fn();
const mockServerTimestamp = vi.fn(() => "SERVER_TS");

vi.mock("firebase/firestore", () => ({
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  collection: vi.fn(() => "col-ref"),
  serverTimestamp: () => mockServerTimestamp(),
  // unused but required to prevent module resolution errors
  arrayRemove: vi.fn(),
  arrayUnion: vi.fn(),
  deleteDoc: vi.fn(),
  doc: vi.fn(),
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

const { createUnit } = await import("../src/features/admin/services");

// ── Tests ──────────────────────────────────────────────────────────────────────
describe("createUnit() — retorno del objeto completo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna { id, unitId, displayName } — no un string plano", async () => {
    mockAddDoc.mockResolvedValue({ id: "u-t2-503-G1bWNzZJuakw9KRoAx7p" });

    const result = await createUnit("tenant-demo", "admin-uid", {
      displayName: "T2-503",
      tower: "Torre 1",
      type: "apartment",
      status: "active",
    });

    expect(typeof result).toBe("object");
    expect(result).toHaveProperty("id");
    expect(result).toHaveProperty("unitId");
    expect(result).toHaveProperty("displayName");
  });

  it("unitId en retorno es slug normalizado — NO el Firestore auto-ID (hash)", async () => {
    mockAddDoc.mockResolvedValue({ id: "u-t2-503-G1bWNzZJuakw9KRoAx7p" });

    const result = await createUnit("tenant-demo", "admin-uid", {
      displayName: "T2-503",
      tower: "Torre 1",
      type: "apartment",
      status: "active",
    });

    expect(result.unitId).toBe("t2-503");
    expect(result.unitId).not.toBe(result.id);
    expect(result.unitId).not.toBe("u-t2-503-G1bWNzZJuakw9KRoAx7p");
  });

  it("id en retorno es el Firestore document ID (hash)", async () => {
    mockAddDoc.mockResolvedValue({ id: "u-t2-503-G1bWNzZJuakw9KRoAx7p" });

    const result = await createUnit("tenant-demo", "admin-uid", {
      displayName: "T2-503",
      tower: "Torre 1",
      type: "apartment",
      status: "active",
    });

    expect(result.id).toBe("u-t2-503-G1bWNzZJuakw9KRoAx7p");
  });

  it("displayName coincide con el input", async () => {
    mockAddDoc.mockResolvedValue({ id: "hash-xyz" });

    const result = await createUnit("tenant-demo", "admin-uid", {
      displayName: "Apto 101",
      tower: "Torre 2",
      type: "apartment",
      status: "active",
    });

    expect(result.displayName).toBe("Apto 101");
  });

  it("unitId es slug correcto para displayNames con espacios y guiones", async () => {
    mockAddDoc.mockResolvedValue({ id: "hash-xyz" });

    const cases: Array<{ displayName: string; expectedSlug: string }> = [
      { displayName: "Torre 1-A4", expectedSlug: "torre-1-a4" },
      { displayName: "Apto 101", expectedSlug: "apto-101" },
      { displayName: "Casa #3", expectedSlug: "casa-3" },
      { displayName: "T2  503", expectedSlug: "t2-503" },
    ];

    for (const { displayName, expectedSlug } of cases) {
      const result = await createUnit("t", "u", { displayName, tower: "T1", type: "apartment", status: "active" });
      expect(result.unitId, `displayName="${displayName}"`).toBe(expectedSlug);
    }
  });

  it("unitId en retorno coincide con el guardado en addDoc", async () => {
    mockAddDoc.mockResolvedValue({ id: "hash-abc" });
    let capturedPayload: Record<string, unknown> = {};
    mockAddDoc.mockImplementationOnce(async (_colRef: unknown, data: Record<string, unknown>) => {
      capturedPayload = data;
      return { id: "hash-abc" };
    });

    const result = await createUnit("tenant-demo", "admin-uid", {
      displayName: "T2-503",
      tower: "Torre 1",
      type: "apartment",
      status: "active",
    });

    // The slug in the return matches what was persisted to Firestore
    expect(result.unitId).toBe(capturedPayload.unitId);
  });
});
