import { describe, expect, it } from "vitest";

import { dentroDeVigencia, resolverEstadoOperativo } from "@/features/visitors/estado-operativo";
import type { VisitorPass } from "@/types/domain";

/**
 * `PRD-V-FLOW-005` — **la píldora de la portería, y el defecto que solo se vio abriendo la pantalla.**
 *
 * Una visita capturada en portería salía **«Expirado» en rojo al segundo de crearla**, mientras el
 * residente todavía tenía cinco minutos para contestar y el guardia tenía a la persona delante.
 *
 * **La regla no estaba mal: estaba aplicada a un flujo para el que no se escribió.** «Se pasó la
 * hora de la cita» es correcto para un QR emitido de antemano; una visita de portería **nace en el
 * instante en que alguien está en la puerta**, así que su hora ya pasó nada más nacer.
 *
 * Ni el typecheck ni los cuatro bancos lo veían: el estado se calculaba dentro del componente y
 * ninguna prueba lo alcanzaba. Salió de mirar.
 */

/**
 * **La hora «ahora» se construye LOCAL, sin `Z`, y no es un detalle.** `combineLocalDateTime`
 * —la que usa el flujo de QR— interpreta la fecha del pase en la zona del navegador; fijar aquí
 * un instante UTC hacía que la prueba pasara o fallara según dónde corriera. La primera versión
 * de este fichero cayó justo en eso.
 */
const AHORA = new Date("2026-08-31T10:40:00").getTime();
const haceMinutos = (n: number) => new Date(AHORA - n * 60_000).toISOString();

function pase(over: Partial<VisitorPass> = {}): VisitorPass {
  return {
    id: "v1",
    tenantId: "t",
    unitId: "u",
    unitLabel: "T1-101",
    visitorName: "Ana Gómez",
    documentNumber: "1020304050",
    qrCodeValue: "",
    hostResidentName: "",
    tower: "T1",
    unit: "101",
    date: "2026-08-31",
    scheduledTime: "10:37",
    status: "scheduled",
    ...over,
  } as VisitorPass;
}

describe("el estado operativo de una visita", () => {
  describe("el defecto: una visita de portería recién capturada NO está expirada", () => {
    it("aunque su hora ya pasó, porque nació en ese momento", () => {
      const item = pase({
        origen: "porteria",
        authorizationStatus: "pendiente",
        authorizationRequestedAt: haceMinutos(3),
      });
      // La regla vieja diría `expired`: 10:37 < 10:40.
      expect(resolverEstadoOperativo(item, AHORA)).toBe("scheduled");
    });

    /**
     * **`CA6`: una expirada sigue viva, y por eso no se pinta de muerta.** El guardia puede
     * rescatarla por la vía B sin recapturar los datos; enseñarla en rojo mientras se le ofrece
     * el botón de rescate sería contradecirse en la misma tarjeta.
     */
    it("y una cuya espera caducó tampoco: el guardia aún la rescata", () => {
      const item = pase({
        origen: "porteria",
        authorizationStatus: "pendiente",
        authorizationRequestedAt: haceMinutos(100),
      });
      expect(resolverEstadoOperativo(item, AHORA)).toBe("scheduled");
    });

    it("solo una RECHAZADA se pinta como muerta", () => {
      const item = pase({ origen: "porteria", authorizationStatus: "rechazada" });
      expect(resolverEstadoOperativo(item, AHORA)).toBe("expired");
    });

    it("y una autorizada sigue viva hasta que entra", () => {
      const item = pase({ origen: "porteria", authorizationStatus: "autorizada" });
      expect(resolverEstadoOperativo(item, AHORA)).toBe("scheduled");
    });
  });

  describe("el flujo de QR NO cambia, que es la otra mitad", () => {
    /**
     * Si arreglar lo de arriba se llevara esto por delante, un QR emitido para las nueve seguiría
     * pareciendo válido a medianoche. Es la regresión que esta prueba existe para impedir.
     */
    it("un pase de QR con la hora pasada SIGUE expirando", () => {
      expect(resolverEstadoOperativo(pase(), AHORA)).toBe("expired");
    });

    it("y uno con la hora por venir, no", () => {
      expect(resolverEstadoOperativo(pase({ scheduledTime: "23:30" }), AHORA)).toBe("scheduled");
    });

    it("larga duración: vigente hasta el fin del día de `validUntil`", () => {
      const vigente = pase({ authorizationType: "larga_duracion", validUntil: "2026-08-31" });
      const caducado = pase({ authorizationType: "larga_duracion", validUntil: "2026-08-30" });
      expect(resolverEstadoOperativo(vigente, AHORA)).toBe("scheduled");
      expect(resolverEstadoOperativo(caducado, AHORA)).toBe("expired");
    });
  });

  describe("lo que ya estaba dentro manda sobre todo lo demás", () => {
    it("dentro y completada se respetan", () => {
      expect(resolverEstadoOperativo(pase({ status: "inside" }), AHORA)).toBe("inside");
      expect(resolverEstadoOperativo(pase({ status: "completed" }), AHORA)).toBe("completed");
    });
  });

  describe("`dentroDeVigencia` se comparte con el check-out", () => {
    it("sin `validUntil` no caduca", () => {
      expect(dentroDeVigencia({ validUntil: undefined }, AHORA)).toBe(true);
    });

    it("y una fecha ilegible no se interpreta como caducada", () => {
      // Tratar un dato roto como «caducado» convertiría un problema de datos en uno de acceso.
      expect(dentroDeVigencia({ validUntil: "no-es-fecha" }, AHORA)).toBe(true);
    });
  });
});
