import { describe, expect, it } from "vitest";

import {
  MAX_VISITAS_EN_HISTORIAL,
  visitasDePorteria,
  type PaseParaHistorial,
} from "@/features/visitors/historial-de-porteria";

/**
 * `PRD-V-FLOW-005`, `CA10` — **el criterio que estuvo en producción sin cumplirse.**
 *
 * El 31 de agosto de 2026 se autorizó una visita de portería con la sesión real del residente y la
 * visita **desapareció de su portal en ese instante**: el único lector de `visitorPasses` filtraba
 * `pendiente` y nada más la enseñaba. Este banco fija lo que el residente tiene que ver: las
 * visitas de portería de su unidad, resueltas, **con la misma constancia que ve la portería**.
 */

const AHORA = Date.parse("2026-08-31T22:40:00Z");
const haceMinutos = (n: number) => new Date(AHORA - n * 60_000).toISOString();

function pase(over: Partial<PaseParaHistorial> = {}): PaseParaHistorial {
  return {
    id: "p1",
    visitorName: "Pedro Prueba",
    documentNumber: "9990001112",
    date: "31/08/2026",
    scheduledTime: "16:36",
    status: "completed",
    origen: "porteria",
    authorizationStatus: "autorizada",
    authorizationRequestedAt: haceMinutos(4),
    authorizationResolvedAt: haceMinutos(3),
    authorizedByName: "David Carmona",
    authorizationMedium: "app",
    ...over,
  };
}

describe("qué entra al historial y qué no", () => {
  it("un pase del flujo de QR no entra: no lleva autorización de portería", () => {
    const qr = pase({ origen: undefined, authorizationStatus: undefined });
    expect(visitasDePorteria([qr], AHORA)).toHaveLength(0);
  });

  it("una pendiente VIVA no entra: esa es del panel de decidir, que está encima", () => {
    const viva = pase({ authorizationStatus: "pendiente", authorizationRequestedAt: haceMinutos(1) });
    expect(visitasDePorteria([viva], AHORA)).toHaveLength(0);
  });

  it("una pendiente de hace más de cinco minutos SÍ entra, como «Nadie contestó»", () => {
    const caducada = pase({ authorizationStatus: "pendiente", authorizationRequestedAt: haceMinutos(6) });
    const [v] = visitasDePorteria([caducada], AHORA);
    expect(v.constancia.texto).toBe("Nadie contestó en cinco minutos.");
    expect(v.constancia.tono).toBe("neutro");
  });
});

describe("la constancia dice quién y por qué medio — el mismo rótulo que ve la portería", () => {
  it("autorizada desde la app", () => {
    const [v] = visitasDePorteria([pase()], AHORA);
    expect(v.constancia.texto).toBe("Autorizada por David Carmona (desde la app)");
    expect(v.constancia.tono).toBe("ok");
  });

  it("autorizada por llamada (la vía B del guardia)", () => {
    const [v] = visitasDePorteria(
      [pase({ authorizedByName: "Luis Gutierrez", authorizationMedium: "llamada" })],
      AHORA,
    );
    expect(v.constancia.texto).toBe("Autorizada por Luis Gutierrez (por llamada)");
  });

  it("rechazada, con quién la rechazó", () => {
    const [v] = visitasDePorteria([pase({ authorizationStatus: "rechazada" })], AHORA);
    expect(v.constancia.texto).toBe("Rechazada por David Carmona");
    expect(v.constancia.tono).toBe("rechazo");
  });

  it("sin nombre guardado no se inventa uno: enseña «—»", () => {
    const [v] = visitasDePorteria([pase({ authorizedByName: undefined })], AHORA);
    expect(v.constancia.texto).toBe("Autorizada por — (desde la app)");
  });
});

describe("el ciclo y el orden", () => {
  it("dentro y finalizado se distinguen; un pase sin entrar no lleva píldora de ciclo", () => {
    const [dentro] = visitasDePorteria([pase({ status: "inside" })], AHORA);
    const [fin] = visitasDePorteria([pase({ status: "completed" })], AHORA);
    const [sin] = visitasDePorteria([pase({ status: "scheduled" })], AHORA);
    expect(dentro.ciclo).toBe("dentro");
    expect(fin.ciclo).toBe("finalizado");
    expect(sin.ciclo).toBeNull();
  });

  it("la más reciente va primero, por su marca de resolución", () => {
    const vieja = pase({ id: "vieja", authorizationResolvedAt: haceMinutos(90) });
    const nueva = pase({ id: "nueva", authorizationResolvedAt: haceMinutos(2) });
    expect(visitasDePorteria([vieja, nueva], AHORA).map((v) => v.id)).toEqual(["nueva", "vieja"]);
  });

  it("no crece sin tope", () => {
    const muchas = Array.from({ length: MAX_VISITAS_EN_HISTORIAL + 5 }, (_, i) =>
      pase({ id: `p${i}`, authorizationResolvedAt: haceMinutos(i + 1) }),
    );
    expect(visitasDePorteria(muchas, AHORA)).toHaveLength(MAX_VISITAS_EN_HISTORIAL);
  });
});
