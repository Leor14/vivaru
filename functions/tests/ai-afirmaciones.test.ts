import { describe, expect, it } from "vitest";

import {
  afirmaAccion,
  afirmacionesDeAccion,
  CASOS_AUTOPRUEBA,
  fallosDeAutoprueba,
  prometeFuturo,
} from "../src/ai/afirmaciones";
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

/**
 * Las posiciones, que son lo que permite resaltar la frase DENTRO del borrador
 * en vez de avisar al lado.
 *
 * El aviso general se probó el 16 de agosto de 2026 con un administrador y
 * publicó el borrador literal, con la bandera encendida. Señalar la frase es lo
 * que no se ha probado; para poder hacerlo, la posición tiene que llegar buena.
 */
describe("posiciones de las afirmaciones", () => {
  it("el corte por posición devuelve exactamente el fragmento", () => {
    const borrador = "Estimado residente, agradecemos su reporte. Estamos verificando con mantenimiento.";
    const [frase] = afirmacionesDeAccion(borrador);

    expect(borrador.slice(frase.desde, frase.hasta)).toBe(frase.texto);
    expect(frase.texto).toBe("Estamos verificando");
  });

  /**
   * El caso es real: sale de la corrida de la v1 del 16 de agosto de 2026, el
   * único de los 32 marcados con dos afirmaciones en el mismo borrador. En la v2
   * ninguno de los 10 lo tiene, y aun así se resaltan todas — resaltar una y
   * callar la otra enseñaría que lo no resaltado está comprobado.
   */
  it("devuelve TODAS las afirmaciones del borrador, no la primera", () => {
    const borrador = "Estamos verificando el caso. Además, se ha gestionado con el proveedor.";
    const frases = afirmacionesDeAccion(borrador);

    expect(frases.map((f) => f.texto)).toEqual(["Estamos verificando", "se ha gestionado"]);
    for (const f of frases) expect(borrador.slice(f.desde, f.hasta)).toBe(f.texto);
  });

  /**
   * Una expresión con `g` guarda `lastIndex` entre llamadas. Compartida, el
   * segundo borrador empezaría a buscar donde acabó el primero y perdería
   * afirmaciones según el orden en que se atendieran los tickets.
   */
  it("no arrastra estado de una llamada a la siguiente", () => {
    const borrador = "Estamos verificando con el equipo.";
    expect(afirmacionesDeAccion(borrador)).toHaveLength(1);
    expect(afirmacionesDeAccion(borrador)).toHaveLength(1);
    expect(afirmacionesDeAccion(borrador)).toHaveLength(1);
  });

  it("no marca nada en un borrador limpio", () => {
    expect(afirmacionesDeAccion("Hemos recibido su reporte. ¿Podría indicarnos su unidad?")).toEqual([]);
    expect(afirmacionesDeAccion("")).toEqual([]);
    expect(afirmacionesDeAccion(null)).toEqual([]);
  });

  /**
   * `afirmaAccion` es de donde sale el 6,6% a través del contador offline, y
   * ahora delega en la función de arriba. Si las dos dejaran de coincidir, la
   * cifra medida y lo que ve la pantalla se separarían en silencio — que es la
   * divergencia contra la que avisa la cabecera del módulo.
   */
  it("el primer fragmento es exactamente lo que devuelve afirmaAccion", () => {
    for (const { texto } of CASOS_AUTOPRUEBA) {
      expect(afirmacionesDeAccion(texto)[0]?.texto ?? null).toBe(afirmaAccion(texto));
    }
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
    expect(revisada.frasesMarcadas).toEqual([]);
  });

  /**
   * La propiedad de la que depende el resaltado entero: las posiciones se miden
   * sobre la MISMA cadena que sale hacia la pantalla. Zod aplica `.trim()` al
   * validar, así que medir sobre la salida cruda daría índices corridos y el
   * resaltado caería una o dos letras a la izquierda de la frase.
   */
  it("las posiciones cortan sobre el borrador que se devuelve", () => {
    const borrador = "Estimado residente, agradecemos su mensaje. Estamos verificando con el equipo.";
    const revisada = operacion!.revisarSalida!({ ...salidaBase, draftResponse: borrador });
    const salida = revisada.salida as typeof salidaBase;

    expect(revisada.frasesMarcadas).toHaveLength(1);
    for (const frase of revisada.frasesMarcadas) {
      expect(salida.draftResponse.slice(frase.desde, frase.hasta)).toBe(frase.texto);
      expect(frase.marca).toBe("afirma_accion");
    }
  });

  /**
   * Dos frases y UNA marca. Lo que se cuenta en `aiUsage` es cuántos borradores
   * afirmaron, no cuántas veces: si la marca se repitiera, la cifra de la Fase 4
   * subiría sola cada vez que un borrador dijera dos cosas.
   */
  it("dos afirmaciones dan dos frases y una sola marca", () => {
    const revisada = operacion!.revisarSalida!({
      ...salidaBase,
      draftResponse: "Estamos verificando el caso. Además, se ha gestionado con el proveedor.",
    });

    expect(revisada.frasesMarcadas).toHaveLength(2);
    expect(revisada.marcas).toEqual(["afirma_accion"]);
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

    // Y el texto del conjunto va por el otro canal, el que NO se registra:
    // `frasesMarcadas` llega a la pantalla, `marcas` a la fila de `aiUsage`.
    expect(revisada.frasesMarcadas[0].texto).toBe("Estamos verificando");
  });
});
