import { describe, expect, it } from "vitest";

import { BILLING_CONCEPTS, billingConceptLabel } from "@/features/billing/use-billing-statements";

/**
 * **El rótulo de un concepto de cobro, y el fallo que se disimulaba a sí mismo.**
 *
 * `billingConceptLabel` caía **en silencio** a «Mantenimiento y Administración» ante cualquier
 * clave que no estuviera en el catálogo. En producción hay un cobro de parqueadero de **$80.000**
 * que lo disparaba: lleva `concept: "Parqueadero"` —la ETIQUETA donde va la CLAVE— y el catálogo
 * la tiene como `parqueadero`. **Fallaba por una letra**, y la pantalla afirmaba que un
 * parqueadero era administración.
 *
 * **Un fallo que se disimula a sí mismo dura años**, y este repositorio ya lo pagó con
 * `getStatusLabel`: diez claves sin traducir aguantaron meses porque la función caía a la clave
 * cruda sin lanzar ni avisar. Aquí era peor, porque no caía a la clave: **caía a otra respuesta
 * con toda la pinta de ser correcta.**
 */
describe("el rótulo de un concepto de cobro", () => {
  describe("el caso de producción: una clave con mayúsculas", () => {
    it("«Parqueadero» dice Parqueadero, no Administración", () => {
      expect(billingConceptLabel("Parqueadero")).toBe("Parqueadero / amenidad");
      expect(billingConceptLabel("Parqueadero")).not.toBe("Mantenimiento y Administración");
    });

    it("y con espacios alrededor, igual", () => {
      expect(billingConceptLabel("  MULTA  ")).toBe("Multa / sanción");
    });
  });

  describe("lo que ya no se disfraza", () => {
    /**
     * **La parte que más importa.** Antes, un concepto inventado se leía como administración —una
     * respuesta creíble y falsa—. Ahora se enseña tal cual: feo a propósito, para que se vea y se
     * corrija en vez de quedarse escondido. Es lo que ya hace `getTicketTypeLabel`.
     */
    it("una clave desconocida se enseña tal cual, no como administración", () => {
      expect(billingConceptLabel("Cuota de piscina")).toBe("Cuota de piscina");
      expect(billingConceptLabel("Cuota de piscina")).not.toBe("Mantenimiento y Administración");
    });

    it("y por eso se distingue de un cobro que SÍ es administración", () => {
      expect(billingConceptLabel("administracion")).not.toBe(billingConceptLabel("Cuota de piscina"));
    });
  });

  describe("lo que NO cambia, y es la regresión que hay que impedir", () => {
    /**
     * **30 de los 221 cobros de producción no tienen concepto**, y para ellos «administración» no
     * es un fallback: es el valor por defecto documentado del campo. Si arreglar lo de arriba se
     * llevara esto por delante, treinta cobros dejarían de decir qué son.
     */
    it("un cobro SIN concepto sigue siendo administración", () => {
      expect(billingConceptLabel(undefined)).toBe("Mantenimiento y Administración");
      expect(billingConceptLabel("")).toBe("Mantenimiento y Administración");
      expect(billingConceptLabel("   ")).toBe("Mantenimiento y Administración");
    });

    it("y cada clave del catálogo sigue devolviendo SU etiqueta", () => {
      // Que el catálogo tenga contenido: con una lista vacía, esto pasaría sin comprobar nada.
      expect(BILLING_CONCEPTS.length).toBeGreaterThanOrEqual(8);
      for (const { value, label } of BILLING_CONCEPTS) {
        expect(billingConceptLabel(value)).toBe(label);
      }
    });

    it("y las etiquetas del catálogo son todas distintas, o dos conceptos se leerían igual", () => {
      const etiquetas = BILLING_CONCEPTS.map((c) => c.label);
      expect(new Set(etiquetas).size).toBe(etiquetas.length);
    });
  });
});
