// tests/comunicado-archivado.test.ts
// `L-14` — «se conserva todo» (decisión de David, 18 sep 2026), fase 7, bloque 3.
//
// Antes, retirar un comunicado era un `deleteDoc`: desaparecían el texto, los adjuntos y el
// sentido de sus lecturas (`communicationReads` quedaban huérfanas), y no quedaba rastro de que
// hubiera existido. Ahora se ARCHIVA, con quién y cuándo.
//
// Lo que fija este banco: el servicio archiva en vez de borrar, y el residente deja de verlo —que
// es la otra mitad de la promesa: conservar no puede significar que el residente lo siga viendo.

import { describe, expect, it, vi } from "vitest";

const f = vi.hoisted(() => ({
  updateDoc: vi.fn<(...args: unknown[]) => Promise<void>>(async () => undefined),
  deleteDoc: vi.fn<(...args: unknown[]) => Promise<void>>(async () => undefined),
}));

vi.mock("firebase/firestore", () => ({
  updateDoc: f.updateDoc,
  deleteDoc: f.deleteDoc,
  addDoc: vi.fn(),
  setDoc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  onSnapshot: vi.fn(),
  collection: vi.fn((_db: unknown, nombre: string) => nombre),
  doc: vi.fn((_db: unknown, coleccion: string, id: string) => `${coleccion}/${id}`),
  deleteField: vi.fn(),
  orderBy: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  limit: vi.fn(),
  runTransaction: vi.fn(),
  serverTimestamp: () => "SERVER_TS",
  writeBatch: vi.fn(),
  arrayUnion: vi.fn(),
  Timestamp: { now: () => "NOW" },
}));
vi.mock("firebase/storage", () => ({ ref: vi.fn(), uploadBytes: vi.fn(), getDownloadURL: vi.fn(), deleteObject: vi.fn() }));
vi.mock("@/lib/firebase/client", () => ({ db: {}, storage: {} }));
vi.mock("@/lib/firebase/callables", () => ({ revokeResidentAccessCallable: vi.fn() }));

import { normalizeResidentCommunication } from "@/features/communications/visibility";

describe("retirar un comunicado lo ARCHIVA, no lo borra", () => {
  it("escribe el estado, la fecha y el autor, y no llama a ningún borrado", async () => {
    const { archiveCommunication } = await import("@/features/admin/services");
    f.updateDoc.mockClear();
    f.deleteDoc.mockClear();

    await archiveCommunication("comm-1", "admin-7");

    const [ref, payload] = f.updateDoc.mock.calls[0] as [string, Record<string, unknown>];
    expect(ref).toBe("communications/comm-1");
    expect(payload).toMatchObject({ status: "archived", archivedAt: "SERVER_TS", archivedBy: "admin-7" });
    expect(f.deleteDoc).not.toHaveBeenCalled();
  });

  it("el servicio de borrado ya no existe en el producto", async () => {
    const servicios = await import("@/features/admin/services");
    expect("deleteCommunication" in servicios).toBe(false);
  });
});

describe("lo archivado sale del portal del residente", () => {
  const base = {
    id: "comm-1",
    tenantId: "t1",
    title: "Corte de agua",
    body: "Mañana de 8 a 12.",
    publishedAt: "2026-09-01T10:00:00.000Z",
  };

  it("un comunicado publicado se ve", () => {
    expect(normalizeResidentCommunication({ ...base, status: "published" })).not.toBeNull();
  });

  it("uno archivado NO se ve", () => {
    expect(normalizeResidentCommunication({ ...base, status: "archived" })).toBeNull();
  });
});
