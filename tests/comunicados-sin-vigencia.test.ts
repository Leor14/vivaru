// tests/comunicados-sin-vigencia.test.ts
// Chip cerrado el 2 sep 2026: un comunicado SIN vigencia (tablón simple, o el
// formulario con las fechas vacías) mandaba `startsAt: undefined` a Firestore, y
// Firestore rechaza el documento entero. No se podía crear un comunicado sin fechas.

import { beforeEach, describe, expect, it, vi } from "vitest";

const mockAddDoc = vi.fn(async () => ({ id: "comm-1" }));
const mockUpdateDoc = vi.fn(async () => undefined);

vi.mock("firebase/firestore", () => ({
  addDoc: (...args: unknown[]) => mockAddDoc(...(args as [])),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...(args as [])),
  collection: vi.fn(() => "collection-ref"),
  doc: vi.fn(() => "doc-ref"),
  deleteDoc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  onSnapshot: vi.fn(),
  orderBy: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  limit: vi.fn(),
  runTransaction: vi.fn(),
  serverTimestamp: () => "SERVER_TS",
  writeBatch: vi.fn(),
  Timestamp: { now: () => "NOW" },
}));
vi.mock("firebase/storage", () => ({ ref: vi.fn(), uploadBytes: vi.fn(), getDownloadURL: vi.fn(), deleteObject: vi.fn() }));
vi.mock("@/lib/firebase/client", () => ({ db: {}, storage: {} }));
vi.mock("@/lib/firebase/callables", () => ({ revokeResidentAccessCallable: vi.fn() }));

const { createCommunication, updateCommunication } = await import("../src/features/admin/services");

/** Lo que el formulario manda cuando no hay vigencia: las dos fechas `undefined`. */
function payloadSinVigencia() {
  return {
    title: "Corte de agua",
    message: "Mañana de 8 a 12.",
    notificationSummary: "",
    status: "published" as const,
    startsAt: undefined,
    endsAt: undefined,
    attachmentUrl: "",
    attachmentName: "",
    attachments: [],
    audience: "all" as const,
    audienceTowers: [],
    audienceUnitIds: [],
  };
}

function clavesConUndefined(escrito: Record<string, unknown>) {
  return Object.entries(escrito)
    .filter(([, v]) => v === undefined)
    .map(([k]) => k);
}

describe("comunicado sin vigencia — Firestore rechaza `undefined`, así que no se le manda", () => {
  beforeEach(() => {
    mockAddDoc.mockClear();
    mockUpdateDoc.mockClear();
  });

  it("crear: el documento no lleva NINGUNA clave con valor undefined", async () => {
    await createCommunication("tenant-x", "admin-1", payloadSinVigencia());
    expect(mockAddDoc).toHaveBeenCalledTimes(1);
    const escrito = (mockAddDoc.mock.calls[0] as unknown as [unknown, Record<string, unknown>])[1];
    expect(clavesConUndefined(escrito)).toEqual([]);
    expect("startsAt" in escrito).toBe(false);
    expect("endsAt" in escrito).toBe(false);
    // Y lo demás sigue llegando: no se limpió de más.
    expect(escrito.title).toBe("Corte de agua");
    expect(escrito.tenantId).toBe("tenant-x");
    expect(escrito.createdBy).toBe("admin-1");
  });

  it("crear: con vigencia, las fechas viajan tal cual", async () => {
    await createCommunication("tenant-x", "admin-1", { ...payloadSinVigencia(), startsAt: "2026-09-10", endsAt: "2026-09-20" });
    const escrito = (mockAddDoc.mock.calls[0] as unknown as [unknown, Record<string, unknown>])[1];
    expect(escrito.startsAt).toBe("2026-09-10");
    expect(escrito.endsAt).toBe("2026-09-20");
  });

  it("editar: quitarle la vigencia a un comunicado tampoco manda undefined", async () => {
    await updateCommunication("comm-1", "admin-1", payloadSinVigencia());
    expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
    const escrito = (mockUpdateDoc.mock.calls[0] as unknown as [unknown, Record<string, unknown>])[1];
    expect(clavesConUndefined(escrito)).toEqual([]);
    expect(escrito.updatedBy).toBe("admin-1");
  });
});
