import { describe, expect, it } from "vitest";

import { normalizeVisitorPass } from "@/features/visitors/use-visitor-passes";

/**
 * `PRD-V-FLOW-005` — **el anfitrión de una visita de portería no es quien la creó.**
 *
 * El normalizador resolvía `hostResidentName` cayendo a `createdByName`, y en una visita de
 * portería el creador es el GUARDIA: con «Sin especificar», la tarjeta de la portería pintaba
 * «Visita a: Luis Gutierrez» — el nombre del guardia, que es falso: nadie visita al guardia.
 * Visto en producción el 31 de agosto de 2026 con dos pases reales de `tenant-santa-maria`.
 *
 * Es la familia de `billingConceptLabel`: **un dato ausente disfrazado de dato falso.** El gemelo
 * que lo hace bien es el detalle del admin (`admin/visitors/page.tsx`), que enseña `"-"` sin
 * inventar. La regla que fija este fichero: el creador solo es un anfitrión plausible cuando es
 * un residente invitando a su propia unidad, nunca cuando la visita nace en la puerta.
 */

/** Lo que escribe `registrarVisitaNoAnunciada` (functions/src/visita-no-anunciada.ts) con
 * «Sin especificar»: `hostResidentName` y `residentName` vacíos, y el guardia como creador. */
function paseDePorteria(over: Record<string, unknown> = {}) {
  return {
    tenantId: "tenant-santa-maria",
    unitId: "unit-t1-101",
    unitLabel: "T1-101",
    visitorName: "Pedro Prueba",
    documentNumber: "1020304050",
    qrCodeValue: "",
    hostResidentName: "",
    tower: "T1",
    unit: "101",
    date: "2026-08-31",
    scheduledTime: "10:40",
    status: "scheduled",
    registeredByGuard: true,
    origen: "porteria",
    authorizationStatus: "pendiente",
    createdBy: "uid-guardia",
    createdByName: "Luis Gutierrez",
    residentName: "",
    ...over,
  };
}

describe("anfitrión de una visita de portería (normalizeVisitorPass)", () => {
  it("con «Sin especificar» cae a «Residente por confirmar», nunca al nombre del guardia", () => {
    const pase = normalizeVisitorPass("v1", paseDePorteria());
    expect(pase.hostResidentName).toBe("Residente por confirmar");
    expect(pase.hostResidentName).not.toBe("Luis Gutierrez");
  });

  it("conserva el anfitrión cuando el guardia sí lo declaró", () => {
    const pase = normalizeVisitorPass("v2", paseDePorteria({ hostResidentName: "Maria Perez", residentName: "Maria Perez" }));
    expect(pase.hostResidentName).toBe("Maria Perez");
  });

  it("un pase de guardia SIN el campo `origen` (anterior a PH-003) tampoco hereda al creador", () => {
    const pase = normalizeVisitorPass("v3", paseDePorteria({ origen: undefined }));
    expect(pase.hostResidentName).toBe("Residente por confirmar");
  });

  it("la invitación de un residente SÍ cae a su propio nombre: se invita a sí mismo", () => {
    const pase = normalizeVisitorPass(
      "v4",
      paseDePorteria({
        registeredByGuard: undefined,
        origen: undefined,
        authorizationStatus: undefined,
        createdBy: "uid-residente",
        createdByName: "Ana Gomez",
        qrCodeValue: "QR-123",
      }),
    );
    expect(pase.hostResidentName).toBe("Ana Gomez");
  });

  it("sin anfitrión, sin creador y sin residente, cae al rótulo neutro", () => {
    const pase = normalizeVisitorPass(
      "v5",
      paseDePorteria({ registeredByGuard: undefined, origen: undefined, createdByName: "", qrCodeValue: "QR-456" }),
    );
    expect(pase.hostResidentName).toBe("Residente por confirmar");
  });
});
