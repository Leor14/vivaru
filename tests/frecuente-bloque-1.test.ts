// tests/frecuente-bloque-1.test.ts
// Fase 7 del lote «Análisis de la plataforma» (18 sep 2026), bloque 1: `L-08b` y `L-10`.
//
// El frecuente es el mismo objeto venga de quien venga —el residente, la administración para una
// unidad o para el conjunto—, y la portería lo ve por el PASE. Lo que se fija aquí:
// - la lógica pura de `frecuente.ts` (¿le toca hoy?, ¿está en su franja?, el tope de 12 meses);
// - la lista de hoy de la portería: un frecuente sale CADA día que le toca, no solo el primero;
// - el estado operativo: un pase revocado no revive por estar dentro de su vigencia;
// - que la invitación del residente lleve la vigencia al pase, y que cancelarla lo REVOQUE;
// - que la administración copie categoría, horario y alcance al pase, y que borrar o cancelar la
//   autorización revoque el pase.
//
// La zona se fija AQUÍ: en una máquina en UTC el día local y el UTC coinciden y nada distinguiría.
process.env.TZ = "America/Mexico_City";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const f = vi.hoisted(() => ({
  addDoc: vi.fn<(...args: unknown[]) => Promise<{ id: string }>>(async () => ({ id: "nuevo" })),
  updateDoc: vi.fn<(...args: unknown[]) => Promise<void>>(async () => undefined),
  deleteDoc: vi.fn<(...args: unknown[]) => Promise<void>>(async () => undefined),
  getDoc: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  getDocs: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  createTenantDocument: vi.fn<(...args: unknown[]) => Promise<{ id: string }>>(async () => ({ id: "pase" })),
}));

vi.mock("firebase/firestore", () => ({
  addDoc: f.addDoc,
  updateDoc: f.updateDoc,
  deleteDoc: f.deleteDoc,
  getDoc: f.getDoc,
  getDocs: f.getDocs,
  collection: vi.fn((_db: unknown, nombre: string) => nombre),
  doc: vi.fn((_db: unknown, coleccion: string, id: string) => `${coleccion}/${id}`),
  deleteField: () => "DELETE_FIELD",
  onSnapshot: vi.fn(),
  orderBy: vi.fn(),
  query: vi.fn((...partes: unknown[]) => partes),
  where: vi.fn((...partes: unknown[]) => partes),
  limit: vi.fn(),
  runTransaction: vi.fn(),
  serverTimestamp: () => "SERVER_TS",
  writeBatch: vi.fn(),
  arrayUnion: vi.fn(),
  Timestamp: { now: () => "NOW", fromDate: (d: Date) => d },
}));
vi.mock("firebase/storage", () => ({ ref: vi.fn(), uploadBytes: vi.fn(), getDownloadURL: vi.fn(), deleteObject: vi.fn() }));
vi.mock("@/lib/firebase/client", () => ({ db: {}, storage: {} }));
vi.mock("@/lib/firebase/callables", () => ({ revokeResidentAccessCallable: vi.fn() }));
vi.mock("@/lib/firebase/realtime-helpers", () => ({ createTenantDocument: f.createTenantDocument }));

import {
  dentroDeHorario,
  describirHorario,
  frecuenteLeTocaElDia,
  normalizarHorario,
  ultimoDiaPermitidoDelResidente,
  ventanaDelFrecuente,
} from "@/features/visitors/frecuente";
import { visitasEsperadasHoy } from "@/components/securityGuard/lista-de-hoy";
import { resolverEstadoOperativo } from "@/features/visitors/estado-operativo";
import { cancelResidentInvitation, createResidentInvitation } from "@/features/visitors/invitations";
import { createVisitor, deleteVisitor, updateVisitor } from "@/features/admin/services";
import type { VisitorPass } from "@/types/domain";

/** Miércoles 16 de septiembre de 2026, 10:00 en Ciudad de México. */
const MIERCOLES_10AM = new Date("2026-09-16T16:00:00Z");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(MIERCOLES_10AM);
  for (const fn of Object.values(f)) fn.mockClear();
  // `mockClear` NO vacía la cola de `mockResolvedValueOnce`: una respuesta que una prueba no
  // consumió pasaba a la siguiente. Lo destapó la falsación, que enrojecía una prueba ajena.
  f.getDoc.mockReset();
  f.getDocs.mockReset();
});
afterEach(() => vi.useRealTimers());

const snap = (docs: Array<{ id: string; data: Record<string, unknown> }>) => ({
  empty: docs.length === 0,
  docs: docs.map((d) => ({ id: d.id, ref: `visitorPasses/${d.id}`, data: () => d.data })),
});

describe("el reloj de la prueba", () => {
  it("es miércoles a las 10 en México", () => {
    expect(new Date().getDay()).toBe(3);
    expect(new Date().getHours()).toBe(10);
  });
});

describe("frecuente.ts — ¿le toca hoy?", () => {
  const lunMieVie = { dias: [1, 3, 5] as Array<0 | 1 | 2 | 3 | 4 | 5 | 6> };
  const pase = { authorizationType: "larga_duracion" as const, validFrom: "2026-09-01", validUntil: "2026-09-30" };

  it("dentro de la vigencia y sin días: todos los días", () => {
    expect(frecuenteLeTocaElDia(pase, "2026-09-16")).toBe(true);
    expect(frecuenteLeTocaElDia(pase, "2026-09-20")).toBe(true);
  });

  it("los dos extremos cuentan, y fuera no", () => {
    expect(frecuenteLeTocaElDia(pase, "2026-09-01")).toBe(true);
    expect(frecuenteLeTocaElDia(pase, "2026-09-30")).toBe(true);
    expect(frecuenteLeTocaElDia(pase, "2026-08-31")).toBe(false);
    expect(frecuenteLeTocaElDia(pase, "2026-10-01")).toBe(false);
  });

  it("con días: solo esos (el 16 es miércoles, el 17 jueves)", () => {
    const conDias = { ...pase, horario: lunMieVie };
    expect(frecuenteLeTocaElDia(conDias, "2026-09-16")).toBe(true);
    expect(frecuenteLeTocaElDia(conDias, "2026-09-17")).toBe(false);
  });

  it("un pase puntual nunca es frecuente", () => {
    expect(frecuenteLeTocaElDia({ ...pase, authorizationType: "puntual" }, "2026-09-16")).toBe(false);
  });

  it("sin validFrom cae a date; sin validUntil no tiene fin", () => {
    const viejo = { authorizationType: "larga_duracion" as const, date: "2026-09-10" };
    expect(frecuenteLeTocaElDia(viejo, "2026-09-09")).toBe(false);
    expect(frecuenteLeTocaElDia(viejo, "2027-01-01")).toBe(true);
  });
});

describe("frecuente.ts — la franja", () => {
  const horario = normalizarHorario({ dias: [1, 3, 5], desde: "07:00", hasta: "17:00" });

  it("miércoles a las 10: dentro", () => {
    expect(dentroDeHorario({ horario })).toBe(true);
  });

  it("miércoles a las 18: fuera; jueves a las 10: fuera", () => {
    expect(dentroDeHorario({ horario }, new Date("2026-09-17T00:00:00Z"))).toBe(false);
    expect(dentroDeHorario({ horario }, new Date("2026-09-17T16:00:00Z"))).toBe(false);
  });

  it("sin horario no hay nada que avisar (null, no false)", () => {
    expect(dentroDeHorario({})).toBeNull();
  });

  it("describe el horario como lo leería la portería", () => {
    expect(describirHorario(horario)).toBe("Lun, Mié, Vie · 07:00–17:00");
    expect(describirHorario(normalizarHorario({ dias: [1, 2, 3, 4, 5] }))).toBe("Lun a Vie");
    expect(describirHorario(normalizarHorario({ dias: [], desde: "08:00", hasta: "12:00" }))).toBe(
      "Todos los días · 08:00–12:00",
    );
  });

  it("un horario mal formado se descarta en vez de restringir", () => {
    expect(normalizarHorario({ dias: [9, "x"], desde: "25:00", hasta: "7" })).toBeUndefined();
    expect(normalizarHorario({ dias: [], desde: "17:00", hasta: "07:00" })).toBeUndefined();
    expect(normalizarHorario(null)).toBeUndefined();
  });
});

describe("frecuente.ts — el tope de 12 meses y la ventana", () => {
  it("un año exacto, y un 29 de febrero no se desborda a marzo", () => {
    expect(ultimoDiaPermitidoDelResidente("2026-09-16")).toBe("2027-09-16");
    expect(ultimoDiaPermitidoDelResidente("2028-02-29")).toBe("2029-02-28");
    expect(ultimoDiaPermitidoDelResidente("2026-03-31")).toBe("2027-03-31");
  });

  it("la ventana va de la franja del primer día al cierre del último", () => {
    const horario = normalizarHorario({ dias: [1], desde: "07:00", hasta: "17:00" });
    const { startAt, endAt } = ventanaDelFrecuente("2026-09-21", "2026-12-21", horario);
    expect(startAt.getDate()).toBe(21);
    expect(startAt.getHours()).toBe(7);
    expect(endAt.getMonth()).toBe(11);
    expect(endAt.getHours()).toBe(17);
  });

  it("si empieza hoy y la franja ya pasó, se corre a dentro de 16 minutos, el mismo día", () => {
    const horario = normalizarHorario({ dias: [], desde: "07:00", hasta: "17:00" });
    const { startAt } = ventanaDelFrecuente("2026-09-16", "2026-10-16", horario);
    expect(startAt.getTime()).toBe(MIERCOLES_10AM.getTime() + 16 * 60 * 1000);
    expect(startAt.getDate()).toBe(16);
  });
});

describe("la lista de hoy de la portería (miércoles 16)", () => {
  it("un frecuente sale CADA día que le toca, no solo el primero", () => {
    const visitas = [
      { id: "empezo-el-1", date: "2026-09-01", status: "scheduled", authorizationType: "larga_duracion" as const, validFrom: "2026-09-01", validUntil: "2026-09-30" },
      { id: "lun-mie-vie", date: "2026-09-14", status: "scheduled", authorizationType: "larga_duracion" as const, validFrom: "2026-09-14", validUntil: "2026-12-31", horario: normalizarHorario({ dias: [1, 3, 5] }) },
      { id: "solo-martes", date: "2026-09-15", status: "scheduled", authorizationType: "larga_duracion" as const, validFrom: "2026-09-15", validUntil: "2026-12-31", horario: normalizarHorario({ dias: [2] }) },
      { id: "vencido", date: "2026-08-01", status: "scheduled", authorizationType: "larga_duracion" as const, validFrom: "2026-08-01", validUntil: "2026-09-15" },
      { id: "revocado", date: "2026-09-01", status: "cancelled", authorizationType: "larga_duracion" as const, validFrom: "2026-09-01", validUntil: "2026-09-30" },
      { id: "puntual-hoy", date: "2026-09-16", status: "scheduled" },
      { id: "puntual-ayer", date: "2026-09-15", status: "scheduled" },
    ];
    expect(visitasEsperadasHoy(visitas).map((v) => v.id)).toEqual(["empezo-el-1", "lun-mie-vie", "puntual-hoy"]);
  });
});

describe("el estado operativo de un pase revocado", () => {
  const base = {
    id: "p",
    tenantId: "t",
    unitId: "u",
    unitLabel: "T1-101",
    visitorName: "Rosa",
    documentNumber: "1",
    qrCodeValue: "QR",
    hostResidentName: "Ana",
    tower: "T1",
    unit: "101",
    date: "2026-09-01",
    scheduledTime: "08:00",
    authorizationType: "larga_duracion",
    validUntil: "2099-12-31",
  } satisfies Partial<VisitorPass>;

  it("vigente y programado: scheduled", () => {
    expect(resolverEstadoOperativo({ ...base, status: "scheduled" } as VisitorPass, Date.now())).toBe("scheduled");
  });

  it("revocado: cancelled, aunque siga dentro de su vigencia", () => {
    expect(resolverEstadoOperativo({ ...base, status: "cancelled" } as VisitorPass, Date.now())).toBe("cancelled");
  });
});

describe("la invitación del residente", () => {
  const comun = {
    tenantId: "t1",
    unitId: "unidad-1",
    unitLabel: "T1-101",
    residentUserId: "u1",
    authorizedByName: "Ana",
    visitorName: "Marta",
    visitorIdentification: "123",
    visitReason: "Aseo",
    adultsCount: 1,
    childrenCount: 0,
    allowedUses: 1,
  };

  it("una visita lleva al pase su día como vigencia, de un solo día", async () => {
    await createResidentInvitation({
      ...comun,
      startAt: new Date("2026-09-17T15:00:00Z"),
      endAt: new Date("2026-09-17T18:00:00Z"),
    });
    const pase = f.createTenantDocument.mock.calls[0]?.[3] as Record<string, unknown>;
    expect(pase).toMatchObject({ authorizationType: "puntual", validFrom: "2026-09-17", validUntil: "2026-09-17" });
  });

  it("una visita de VARIOS días se rechaza: eso es un frecuente", async () => {
    await expect(
      createResidentInvitation({
        ...comun,
        startAt: new Date("2026-09-17T15:00:00Z"),
        endAt: new Date("2026-09-19T18:00:00Z"),
      }),
    ).rejects.toThrow(/solo día/);
    expect(f.createTenantDocument).not.toHaveBeenCalled();
  });

  it("un frecuente lleva al pase su vigencia entera, la categoría y el horario", async () => {
    const horario = normalizarHorario({ dias: [1, 3, 5], desde: "07:00", hasta: "17:00" });
    const { startAt, endAt } = ventanaDelFrecuente("2026-09-18", "2027-03-18", horario);
    await createResidentInvitation({ ...comun, startAt, endAt, frecuente: { categoria: "servicio", horario } });
    const invitacion = f.addDoc.mock.calls[0]?.[1] as Record<string, unknown>;
    const pase = f.createTenantDocument.mock.calls[0]?.[3] as Record<string, unknown>;
    expect(invitacion).toMatchObject({ tipo: "frecuente", visitorCategory: "servicio", horario });
    expect(pase).toMatchObject({
      authorizationType: "larga_duracion",
      validFrom: "2026-09-18",
      validUntil: "2027-03-18",
      visitorCategory: "servicio",
      horario,
    });
  });

  it("un frecuente de más de 12 meses se rechaza", async () => {
    const { startAt, endAt } = ventanaDelFrecuente("2026-09-18", "2027-09-20", undefined);
    await expect(
      createResidentInvitation({ ...comun, startAt, endAt, frecuente: { categoria: "servicio" } }),
    ).rejects.toThrow(/12 meses/);
  });

  it("cancelarla REVOCA su pase (se encuentra por el QR) y respeta al que está dentro", async () => {
    f.getDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ tenantId: "t1", unitId: "unidad-1", qrToken: "QR-1" }),
    });
    f.getDocs.mockResolvedValueOnce(
      snap([
        { id: "programado", data: { status: "scheduled" } },
        { id: "dentro", data: { status: "inside" } },
        { id: "terminado", data: { status: "completed" } },
      ]),
    );
    await cancelResidentInvitation("inv-1", "u1");

    const escrituras = new Map(f.updateDoc.mock.calls.map((c) => [c[0], c[1] as Record<string, unknown>]));
    expect(escrituras.get("visitorInvitations/inv-1")).toMatchObject({ status: "cancelled" });
    expect(escrituras.get("visitorPasses/programado")).toMatchObject({ status: "cancelled", cancelledAt: "SERVER_TS", cancelledBy: "u1" });
    // Dentro: no cambia de estado —la portería registra su salida— pero queda marcado.
    expect(escrituras.get("visitorPasses/dentro")).toMatchObject({ cancelledAt: "SERVER_TS" });
    expect(escrituras.get("visitorPasses/dentro")).not.toHaveProperty("status");
    expect(escrituras.has("visitorPasses/terminado")).toBe(false);
  });
});

describe("la administración (L-10)", () => {
  const autorizacion = {
    visitorName: "Luis Pardo",
    visitorDocument: "80808080",
    qrCode: "QR-JARDIN",
    authorizationType: "larga_duracion" as const,
    visitorCategory: "jardineria" as const,
    unitId: "",
    alcance: "conjunto" as const,
    horario: normalizarHorario({ dias: [2, 4], desde: "06:00", hasta: "14:00" }),
    authorizedBy: "Administración",
    startDate: "2026-09-17",
    startTime: "06:00",
    endDate: "2026-12-31",
    endTime: "14:00",
    status: "active" as const,
  };

  it("el personal del conjunto nace sin unidad, con su categoría y su horario en el PASE", async () => {
    await createVisitor("t1", "admin-1", autorizacion);
    const pase = f.addDoc.mock.calls.find((c) => c[0] === "visitorPasses")?.[1] as Record<string, unknown>;
    expect(pase).toMatchObject({
      unitId: "",
      unitLabel: "",
      tower: "-",
      unit: "-",
      alcance: "conjunto",
      visitorCategory: "jardineria",
      horario: autorizacion.horario,
      validFrom: "2026-09-17",
      validUntil: "2026-12-31",
    });
  });

  it("uno de una unidad lleva la categoría al pase y NO la marca de conjunto", async () => {
    await createVisitor(
      "t1",
      "admin-1",
      { ...autorizacion, unitId: "unidad-1", alcance: undefined, visitorCategory: "servicio" },
      { unitLabel: "T1-101", tower: "T1", unit: "101" },
    );
    const pase = f.addDoc.mock.calls.find((c) => c[0] === "visitorPasses")?.[1] as Record<string, unknown>;
    expect(pase).toMatchObject({ unitId: "unidad-1", unitLabel: "T1-101", visitorCategory: "servicio" });
    expect(pase).not.toHaveProperty("alcance");
  });

  it("cancelar la autorización revoca su pase", async () => {
    f.getDocs.mockResolvedValueOnce(snap([{ id: "p1", data: { status: "scheduled" } }]));
    await updateVisitor("aut-1", "admin-1", { status: "cancelled" });
    const escritura = f.updateDoc.mock.calls.find((c) => c[0] === "visitorPasses/p1")?.[1] as Record<string, unknown>;
    expect(escritura).toMatchObject({ status: "cancelled", cancelledAt: "SERVER_TS", cancelledBy: "admin-1" });
  });

  it("editar otra cosa NO revoca el pase", async () => {
    f.getDocs.mockResolvedValueOnce(snap([{ id: "p1", data: { status: "scheduled" } }]));
    await updateVisitor("aut-1", "admin-1", { visitorName: "Luis A. Pardo" });
    const escritura = f.updateDoc.mock.calls.find((c) => c[0] === "visitorPasses/p1")?.[1] as Record<string, unknown>;
    expect(escritura).not.toHaveProperty("status");
    expect(escritura).not.toHaveProperty("cancelledAt");
  });

  it("borrar la autorización revoca su pase ANTES de borrarla, y el pase se conserva", async () => {
    f.getDocs.mockResolvedValueOnce(snap([{ id: "p1", data: { status: "scheduled" } }]));
    await deleteVisitor("aut-1", "admin-1");
    expect(f.updateDoc).toHaveBeenCalledWith("visitorPasses/p1", expect.objectContaining({ status: "cancelled" }));
    expect(f.deleteDoc).toHaveBeenCalledWith("visitorAuthorizations/aut-1");
    expect(f.deleteDoc).not.toHaveBeenCalledWith("visitorPasses/p1");
    expect(f.updateDoc.mock.invocationCallOrder[0]).toBeLessThan(f.deleteDoc.mock.invocationCallOrder[0]);
  });
});
