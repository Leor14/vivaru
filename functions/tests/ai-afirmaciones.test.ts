import { describe, expect, it } from "vitest";

import { afirmaAccion, fallosDeAutoprueba, prometeFuturo } from "../src/ai/afirmaciones";
import { findOperation, MARCAS_DE_REVISION } from "../src/ai/catalog";

/**
 * La comprobación de contrato que fuerza `needsHumanReview` cuando el borrador
 * afirma una acción de la administración.
 *
 * **Lo que estos tests protegen no es la expresión regular: es que atrape y que
 * no sobre-marque.** Las dos mitades importan por igual y por razones
 * distintas. Si deja de atrapar, se publica algo falso. Si empieza a marcar los
 * acuses de recibo, marcaría casi todos los borradores y `needsHumanReview`
 * dejaría de significar nada — que es la forma en que un guardrail muere sin
 * que nadie lo note.
 */

describe("criterio de afirmaciones", () => {
  it("pasa su propia autoprueba", () => {
    expect(fallosDeAutoprueba()).toEqual([]);
  });

  it("atrapa las cuatro formas: hecha, en curso, iniciada e impersonal", () => {
    expect(afirmaAccion("Hemos coordinado con el proveedor.")).not.toBeNull();
    expect(afirmaAccion("Estamos verificando el avance.")).not.toBeNull();
    expect(afirmaAccion("Ya notificamos a la empresa.")).not.toBeNull();
    expect(afirmaAccion("Se ha programado la inspección.")).not.toBeNull();
  });

  /**
   * El falso positivo que hundiría el criterio. Con raíces en vez de formas
   * verbales, «hemos recibido su REPORTe» cuenta como «reportar» y el conteo
   * sobre el gold set salta de 32 a 109 de 152.
   */
  it("NO marca el acuse de recibo, que siempre es verdadero", () => {
    expect(afirmaAccion("Hemos recibido su reporte sobre el bota aguas.")).toBeNull();
    expect(afirmaAccion("Hemos tomado nota de su solicitud.")).toBeNull();
    expect(afirmaAccion("Agradecemos su reporte sobre el elevador.")).toBeNull();
  });

  it("NO marca el compromiso futuro condicional, que es lo que hace una administración", () => {
    const texto = "Una vez contemos con esta información, procederemos a revisar su estado de cuenta.";
    expect(afirmaAccion(texto)).toBeNull();
    expect(prometeFuturo(texto)).not.toBeNull();
  });

  it("devuelve el fragmento, para poder registrarlo o resaltarlo después", () => {
    expect(afirmaAccion("Estamos verificando con mantenimiento.")).toBe("Estamos verificando");
  });

  it("tolera vacío y nulo sin romperse", () => {
    expect(afirmaAccion("")).toBeNull();
    expect(afirmaAccion(null)).toBeNull();
    expect(afirmaAccion(undefined)).toBeNull();
  });
});

describe("revisarSalida de pqrs-asistir", () => {
  const operacion = findOperation("pqrs-asistir");

  const salidaBase = {
    summary: "El residente reporta una fuga.",
    suggestedCategory: "maintenance",
    suggestedType: "claim",
    suggestedPriority: "low",
    priorityReason: "Sin daño en curso.",
    needsHumanReview: false,
    requests: [],
    missingInformation: [],
    nextSteps: [],
    draftResponse: "",
    safetyFlags: [],
  };

  it("fuerza needsHumanReview cuando el borrador afirma una acción", () => {
    const revisada = operacion!.revisarSalida!({
      ...salidaBase,
      draftResponse: "Estimado residente. Estamos verificando con el equipo de mantenimiento.",
    });

    expect((revisada.salida as { needsHumanReview: boolean }).needsHumanReview).toBe(true);
    expect(revisada.marcas).toEqual(["afirma_accion"]);
  });

  it("no toca la salida cuando el borrador se porta bien", () => {
    const limpia = { ...salidaBase, draftResponse: "Hemos recibido su reporte. ¿Podría indicarnos su unidad?" };
    const revisada = operacion!.revisarSalida!(limpia);

    expect(revisada.salida).toBe(limpia);
    expect(revisada.marcas).toEqual([]);
  });

  /**
   * No reescribir es una decisión, no un olvido: editar en silencio la salida
   * del modelo nos haría autores del texto sin que nadie lo haya decidido.
   */
  it("NO reescribe el borrador ni cambia la clasificación", () => {
    const borrador = "Estamos revisando los registros de seguridad.";
    const revisada = operacion!.revisarSalida!({ ...salidaBase, draftResponse: borrador });
    const salida = revisada.salida as typeof salidaBase;

    expect(salida.draftResponse).toBe(borrador);
    expect(salida.suggestedCategory).toBe("maintenance");
    expect(salida.suggestedType).toBe("claim");
    expect(salida.suggestedPriority).toBe("low");
  });

  it("respeta un needsHumanReview que ya venía en true", () => {
    const revisada = operacion!.revisarSalida!({
      ...salidaBase,
      needsHumanReview: true,
      draftResponse: "Hemos recibido su mensaje.",
    });
    expect((revisada.salida as { needsHumanReview: boolean }).needsHumanReview).toBe(true);
  });

  /**
   * El vocabulario es cerrado porque estas marcas acaban en `aiUsage`, y lo que
   * protege esa colección es que no tiene ni un campo de texto libre donde
   * pueda colarse contenido del conjunto. Si alguien mete aquí el fragmento,
   * este test cae.
   */
  it("la marca es una categoría del vocabulario cerrado, nunca el fragmento", () => {
    const revisada = operacion!.revisarSalida!({
      ...salidaBase,
      draftResponse: "Estamos verificando con el equipo de mantenimiento del edificio.",
    });
    for (const marca of revisada.marcas) {
      expect(MARCAS_DE_REVISION).toContain(marca);
      expect(marca).not.toContain("mantenimiento");
    }
  });
});
