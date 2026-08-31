import { describe, expect, it } from "vitest";
import {
  colorDeCarril,
  colorPorPorcentaje,
  tonoPorPorcentaje,
  UMBRAL_ATENCION,
  UMBRAL_BIEN,
} from "@/lib/dashboard/umbrales";

/**
 * Estas pruebas existen por tres defectos REALES que se vieron en producción el 28 de agosto de
 * 2026, no por cubrir líneas. Cada bloque nombra el que vigila.
 */
describe("umbrales del Panel de Control", () => {
  describe("el tono sale del valor, no es constante", () => {
    // El defecto: `% recaudo` tenía `tone: "success"` fijo, así que 0,0% se pintaba de verde.
    it("un recaudo de 0% NO puede leerse como bueno", () => {
      expect(tonoPorPorcentaje(0, 18)).toBe("alert");
      expect(tonoPorPorcentaje(0, 18)).not.toBe("success");
    });

    it("solo desde el umbral bueno se pinta como bueno", () => {
      expect(tonoPorPorcentaje(UMBRAL_BIEN, 18)).toBe("success");
      expect(tonoPorPorcentaje(UMBRAL_BIEN - 0.1, 18)).not.toBe("success");
      expect(tonoPorPorcentaje(100, 18)).toBe("success");
    });

    it("la franja intermedia es atención, no alarma ni logro", () => {
      expect(tonoPorPorcentaje(UMBRAL_ATENCION, 18)).toBe("pending");
      expect(tonoPorPorcentaje(UMBRAL_ATENCION - 0.1, 18)).toBe("alert");
    });
  });

  /**
   * **CA2 y CA3 de `PRD-V-FIX-003`, en la función que decide el color.**
   *
   * El tono tenía la misma ceguera que tuvo la barra: sin el total no distinguía «nadie pagó»
   * de «no había nada que cobrar», y las dos salían en rojo. El 30 de agosto de 2026, CUATRO de
   * los siete conjuntos de producción afirmaban en rojo un recaudo del 0,0% en un mes sin un
   * solo cobro emitido. **CA3 está aquí para que arreglarlo no se lleve por delante el cero de
   * verdad**, que es exactamente la regresión que `UX-003` ya cometió con las barras.
   */
  describe("el tono tampoco confunde «sin datos» con «lo peor»", () => {
    it("CA2 — sin nada facturado no se pinta de alarma", () => {
      expect(tonoPorPorcentaje(0, 0)).toBe("neutral");
      expect(tonoPorPorcentaje(0, 0)).not.toBe("alert");
    });

    it("CA3 — con cobros emitidos y nada saldado SIGUE siendo alarma", () => {
      expect(tonoPorPorcentaje(0, 1_200_000)).toBe("alert");
    });

    it("y los dos ceros no se ven igual, que es el defecto que hubo", () => {
      expect(tonoPorPorcentaje(0, 0)).not.toBe(tonoPorPorcentaje(0, 1_200_000));
    });
  });

  describe("un porcentaje mayor nunca se ve peor que uno menor", () => {
    /**
     * El defecto: la barra del total estaba clavada en verde y las de torre usaban umbrales, así
     * que el widget marcaba **6% en verde** y **11% en rojo** a la vez. Esta prueba lo prohíbe
     * para TODA la escala, no solo para ese par de números.
     */
    const rango = [0, 1, 6, 11, 39.9, 40, 55, 69.9, 70, 85, 100];
    const orden = { "#E24B4A": 0, "#EF9F27": 1, "#1D9E75": 2 } as const;

    it("el color es monótono en todo el rango", () => {
      for (let i = 1; i < rango.length; i += 1) {
        const antes = colorPorPorcentaje(rango[i - 1], 18) as keyof typeof orden;
        const ahora = colorPorPorcentaje(rango[i], 18) as keyof typeof orden;
        expect(orden[ahora]).toBeGreaterThanOrEqual(orden[antes]);
      }
    });

    /**
     * **Esta prueba existe porque la de arriba estaba ciega, y lo destapó falsarla.**
     *
     * Al romper el código a propósito —barra siempre verde, que es el defecto original— la
     * monotonía seguía en verde: si todos los colores son iguales, «nunca baja» se cumple sola.
     * Una escala constante pasa cualquier prueba de orden. Hay que exigir además que la escala
     * DISTINGA, o el guardián no vigila el defecto que dice vigilar.
     */
    it("y la escala distingue de verdad: recorre los tres colores", () => {
      const colores = new Set(rango.map((pct) => colorPorPorcentaje(pct, 18)));
      expect(colores.size).toBe(3);
      expect(colores).toContain("#E24B4A");
      expect(colores).toContain("#EF9F27");
      expect(colores).toContain("#1D9E75");
    });

    it("el par exacto que se vio roto: 6% no puede verse mejor que 11%", () => {
      const seis = colorPorPorcentaje(6, 18) as keyof typeof orden;
      const once = colorPorPorcentaje(11, 18) as keyof typeof orden;
      expect(orden[seis]).toBeLessThanOrEqual(orden[once]);
    });
  });

  describe("la barra sigue mostrando avance", () => {
    /**
     * **Esta prueba existe por una regresión propia que ninguna otra vio.**
     *
     * Al arreglar «cero con datos se ve igual que sin datos» se pintó el carril del MISMO color
     * que el relleno. Con eso el cero quedó bien y **el avance desapareció**: una torre al 11% y
     * tres al 0% salían como cuatro barras rojas idénticas. Typecheck, 1343 pruebas y la
     * falsación estaban en verde; lo cazó abrir la pantalla.
     */
    it("el carril y el relleno NUNCA son el mismo color", () => {
      for (const pct of [0, 6, 11, 40, 55, 70, 100]) {
        expect(colorDeCarril(pct, 18)).not.toBe(colorPorPorcentaje(pct, 18));
      }
    });

    it("el carril conserva el tono, para que el cero con datos siga teniendo color", () => {
      expect(colorDeCarril(0, 18)).toContain("#E24B4A");
      expect(colorDeCarril(100, 18)).toContain("#1D9E75");
    });

    it("y sin datos el carril tampoco tiene color", () => {
      expect(colorDeCarril(0, 0)).toBeNull();
    });
  });

  describe("«sin datos» no es «lo peor»", () => {
    // El defecto: al 0% la barra mide cero, así que un total real sin firmas y un total vacío
    // se veían idénticos. Con total 0 no hay color; con total real sí, aunque el avance sea 0.
    it("sin nada que medir no devuelve color", () => {
      expect(colorPorPorcentaje(0, 0)).toBeNull();
    });

    it("cero sobre un total REAL sí tiene color, y es el de alarma", () => {
      expect(colorPorPorcentaje(0, 18)).toBe("#E24B4A");
    });

    it("y los dos casos no se ven igual, que es el defecto que hubo", () => {
      expect(colorPorPorcentaje(0, 0)).not.toBe(colorPorPorcentaje(0, 18));
    });
  });
});
