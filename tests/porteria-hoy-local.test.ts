// tests/porteria-hoy-local.test.ts
// La lista de hoy de la portería es la del calendario local — y el día que guarda una
// invitación, también.
//
// `GuardDashboard` filtraba visitas y reservas comparando con el día UTC: desde las 18:00
// de México (19:00 en Colombia y Ecuador) la portería veía las de MAÑANA. No se arregló
// con el resto del front (`tests/hoy-local.test.ts`) porque las invitaciones del residente
// (`invitations.ts`) guardaban su día también en UTC: arreglar solo la comparación habría
// escondido esas visitas. Los dos lados se fijan aquí, juntos.
//
// La zona se fija AQUÍ y no se hereda de la máquina: en una en UTC —la de CI— el día
// local y el UTC coinciden y esta prueba no distinguiría nada.
process.env.TZ = "America/Mexico_City";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createTenantDocument, addDoc } = vi.hoisted(() => ({
  createTenantDocument: vi.fn<(...args: unknown[]) => Promise<{ id: string }>>(async () => ({ id: "pase" })),
  addDoc: vi.fn<(...args: unknown[]) => Promise<{ id: string }>>(async () => ({ id: "invitacion" })),
}));

vi.mock("@/lib/firebase/client", () => ({ db: {} }));
vi.mock("@/lib/firebase/realtime-helpers", () => ({ createTenantDocument }));
vi.mock("firebase/firestore", () => ({
  addDoc,
  collection: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  onSnapshot: vi.fn(),
  orderBy: vi.fn(),
  query: vi.fn(),
  serverTimestamp: vi.fn(() => "SERVER_TS"),
  updateDoc: vi.fn(),
  where: vi.fn(),
}));

import { reservasActivasHoy, visitasEsperadasHoy } from "@/components/securityGuard/lista-de-hoy";
import { createResidentInvitation } from "@/features/visitors/invitations";

/** 19:00 del 10 de septiembre en Ciudad de México = 01:00 del 11 en UTC. */
const TARDE_DEL_10 = new Date("2026-09-11T01:00:00Z");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(TARDE_DEL_10);
  createTenantDocument.mockClear();
});
afterEach(() => vi.useRealTimers());

describe("el reloj de esta prueba distingue el día local del UTC", () => {
  it("a esa hora UTC ya dice 11 y el calendario de México sigue en 10", () => {
    expect(new Date().toISOString().slice(0, 10)).toBe("2026-09-11");
    expect(new Date().getDate()).toBe(10);
  });
});

describe("la lista de hoy de la portería, a las 19:00 del 10", () => {
  it("las reservas activas son las del 10, no las de mañana", () => {
    const reservas = [
      { id: "hoy", date: "2026-09-10", status: "approved" },
      { id: "manana", date: "2026-09-11", status: "approved" },
      { id: "cancelada-hoy", date: "2026-09-10", status: "cancelled" },
    ];
    expect(reservasActivasHoy(reservas).map((r) => r.id)).toEqual(["hoy"]);
  });

  it("las visitas esperadas son las del 10, no las de mañana", () => {
    const visitas = [
      { id: "hoy", date: "2026-09-10", status: "scheduled" },
      { id: "dentro", date: "2026-09-10", status: "inside" },
      { id: "manana", date: "2026-09-11", status: "scheduled" },
      { id: "terminada-hoy", date: "2026-09-10", status: "completed" },
    ];
    expect(visitasEsperadasHoy(visitas).map((v) => v.id)).toEqual(["hoy", "dentro"]);
  });
});

describe("una invitación guarda el día local de su hora de inicio", () => {
  const invitacion = {
    tenantId: "t1",
    unitId: "unidad-1",
    unitLabel: "T1-101",
    residentUserId: "u1",
    authorizedByName: "Ana",
    visitorName: "Pedro",
    visitorIdentification: "123",
    visitReason: "Visita",
    adultsCount: 1,
    childrenCount: 0,
    allowedUses: 1,
  };

  it("una visita a las 19:30 del 10 es del 10, aunque en UTC ya sea el 11", async () => {
    await createResidentInvitation({
      ...invitacion,
      startAt: new Date("2026-09-11T01:30:00Z"),
      endAt: new Date("2026-09-11T03:30:00Z"),
    });
    const pase = createTenantDocument.mock.calls[0]?.[3] as Record<string, unknown>;
    expect(pase.date).toBe("2026-09-10");
    expect(pase.eventDate).toBe("2026-09-10");
  });

  it("y la hora exacta se conserva como instante", async () => {
    await createResidentInvitation({
      ...invitacion,
      startAt: new Date("2026-09-11T01:30:00Z"),
      endAt: new Date("2026-09-11T03:30:00Z"),
    });
    const pase = createTenantDocument.mock.calls[0]?.[3] as Record<string, unknown>;
    expect(pase.scheduledTime).toBe("2026-09-11T01:30:00.000Z");
  });
});
