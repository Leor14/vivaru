// tests/contactos-de-emergencia.test.ts
// `L-32` — los números de emergencia del conjunto (fase 7, bloque 2).
//
// Lo que fija este banco:
// - LEER es tolerante: un contacto a medias se descarta en silencio, porque una pantalla de
//   emergencia no puede romperse por un dato viejo;
// - GUARDAR es estricto: una fila a medias se le dice a quien la escribió;
// - la fila vacía que el formulario deja al añadir no es un error, y no se guarda;
// - el `tel:` se limpia, porque los espacios y paréntesis se marcan como tonos en algunos teléfonos.

import { describe, expect, it, vi } from "vitest";

const f = vi.hoisted(() => ({
  onSnapshot: vi.fn<(...args: unknown[]) => unknown>(),
  setDoc: vi.fn<(...args: unknown[]) => Promise<void>>(async () => undefined),
}));

vi.mock("firebase/firestore", () => ({
  onSnapshot: f.onSnapshot,
  setDoc: f.setDoc,
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
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

import {
  MAXIMO_DE_CONTACTOS,
  contactosParaGuardar,
  enlaceParaLlamar,
  normalizarContactos,
  validarContactos,
} from "@/features/tenant/contactos-de-emergencia";

describe("leer lo que hay en la base", () => {
  it("conserva los contactos completos y recorta espacios", () => {
    expect(
      normalizarContactos([
        { nombre: "  Portería  ", telefono: " 300 123 4567 ", nota: "  24 horas " },
        { nombre: "Bomberos", telefono: "119" },
      ]),
    ).toEqual([
      { nombre: "Portería", telefono: "300 123 4567", nota: "24 horas" },
      { nombre: "Bomberos", telefono: "119" },
    ]);
  });

  it("descarta en silencio lo que no sirve en una emergencia", () => {
    expect(
      normalizarContactos([
        { nombre: "Sin teléfono", telefono: "   " },
        { telefono: "119" },
        "texto suelto",
        null,
        { nombre: "Ascensorista", telefono: "601 555 0000" },
      ]),
    ).toEqual([{ nombre: "Ascensorista", telefono: "601 555 0000" }]);
  });

  it("un dato que no es lista no rompe la pantalla", () => {
    expect(normalizarContactos(undefined)).toEqual([]);
    expect(normalizarContactos({ nombre: "Portería" })).toEqual([]);
  });

  it("recorta al tope", () => {
    const muchos = Array.from({ length: MAXIMO_DE_CONTACTOS + 5 }, (_, i) => ({
      nombre: `Contacto ${i}`,
      telefono: `60155500${i}`,
    }));
    expect(normalizarContactos(muchos)).toHaveLength(MAXIMO_DE_CONTACTOS);
  });
});

describe("guardar lo que escribe la administración", () => {
  it("una lista buena no tiene errores", () => {
    expect(validarContactos([{ nombre: "Portería", telefono: "+57 (601) 555-0000 #2" }])).toEqual([]);
  });

  it("la fila vacía del formulario no es un error, y no se guarda", () => {
    expect(validarContactos([{ nombre: "Portería", telefono: "119" }, { nombre: "", telefono: "" }])).toEqual([]);
    expect(contactosParaGuardar([{ nombre: "Portería", telefono: "119" }, { nombre: "", telefono: "" }])).toEqual([
      { nombre: "Portería", telefono: "119" },
    ]);
  });

  it("una fila a medias SÍ se avisa, y dice qué campo", () => {
    const errores = validarContactos([{ nombre: "Bomberos", telefono: "" }, { nombre: "", telefono: "119" }]);
    expect(errores).toEqual([
      { indice: 0, campo: "telefono", mensaje: "Escribe el número." },
      { indice: 1, campo: "nombre", mensaje: "Escribe a quién se llama." },
    ]);
  });

  it("un teléfono con letras se rechaza", () => {
    const errores = validarContactos([{ nombre: "Portería", telefono: "llamar a Juan" }]);
    expect(errores).toHaveLength(1);
    expect(errores[0].campo).toBe("telefono");
  });

  it("pasarse del tope se avisa", () => {
    const muchos = Array.from({ length: MAXIMO_DE_CONTACTOS + 1 }, (_, i) => ({
      nombre: `Contacto ${i}`,
      telefono: "119",
    }));
    expect(validarContactos(muchos).some((e) => e.mensaje.includes(String(MAXIMO_DE_CONTACTOS)))).toBe(true);
  });
});

describe("el enlace para llamar", () => {
  it("quita lo que algunos teléfonos marcarían como tonos y conserva + y #", () => {
    expect(enlaceParaLlamar("+57 (601) 555-0000 #2")).toBe("tel:+576015550000#2");
    expect(enlaceParaLlamar("119")).toBe("tel:119");
  });
});

describe("del documento a la pantalla, y de la pantalla al documento", () => {
  // **Por qué existe este bloque.** `watchTenantSettings` arma su objeto CAMPO POR CAMPO, igual que
  // el normalizador de los pases: un campo nuevo se guarda en la base y no llega a ninguna pantalla,
  // sin error y sin aviso. Ya pasó con el autor de la puerta (`L-29`). Aquí se fija el viaje entero.
  it("watchTenantSettings entrega los contactos que hay en el documento", async () => {
    const { watchTenantSettings } = await import("@/features/admin/services");
    f.onSnapshot.mockImplementation((_ref: unknown, onNext: unknown) => {
      (onNext as (snap: unknown) => void)({
        exists: () => true,
        data: () => ({
          tenantName: "Conjunto Santa María",
          brandColor: "#0b3c5d",
          contactosDeEmergencia: [
            { nombre: "Portería", telefono: "601 555 0000", nota: "24 horas" },
            { nombre: "Sin número", telefono: "" },
          ],
        }),
      });
      return () => {};
    });

    let recibido: unknown = null;
    watchTenantSettings("t1", (item) => (recibido = item?.contactosDeEmergencia), () => {});
    expect(recibido).toEqual([{ nombre: "Portería", telefono: "601 555 0000", nota: "24 horas" }]);
  });

  it("saveContactosDeEmergencia escribe con merge, con tenantId y sin filas a medias", async () => {
    const { saveContactosDeEmergencia } = await import("@/features/admin/services");
    f.setDoc.mockClear();
    await saveContactosDeEmergencia("t1", "admin-1", [
      { nombre: " Bomberos ", telefono: " 119 " },
      { nombre: "", telefono: "" },
      { nombre: "A medias", telefono: "" },
    ]);
    const [ref, payload, opciones] = f.setDoc.mock.calls[0] as [string, Record<string, unknown>, unknown];
    expect(ref).toBe("tenantSettings/t1");
    // La regla exige que el documento resultante lleve su `tenantId`.
    expect(payload.tenantId).toBe("t1");
    expect(payload.contactosDeEmergencia).toEqual([{ nombre: "Bomberos", telefono: "119" }]);
    expect(opciones).toEqual({ merge: true });
  });
});
