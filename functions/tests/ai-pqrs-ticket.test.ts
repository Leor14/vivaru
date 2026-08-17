import { describe, expect, it } from "vitest";

import { findOperation, validateOperationInput } from "../src/ai/catalog";
import {
  construirEntradaPqrs,
  ticketPerteneceAlConjunto,
  variantePqrsDe,
} from "../src/ai/pqrs-ticket";

/**
 * Del ticket de Firestore a la entrada de `pqrs-asistir` — Fase 3 de
 * `PRD-VAI-FEAT-002`.
 *
 * Todo lo de aquí corre sin emulador y sin red, a propósito: son las
 * comprobaciones que no pueden depender de que alguien se acuerde de arrancar
 * algo. La prueba de conjunto cruzado es la que la PRD exige nombrada («0 acceso
 * cruzado entre tenants, pruebas negativas»).
 *
 * Y lo que se construye se valida contra el esquema **real** del catálogo, no
 * contra una copia: si mañana cambian los topes de la operación, estas pruebas
 * lo acusan en vez de seguir midiendo un contrato viejo.
 */

const CONJUNTO = "conjunto-a";
const AJENO = "conjunto-b";

const OPERACION = findOperation("pqrs-asistir");
if (!OPERACION) throw new Error("El catálogo perdió pqrs-asistir.");

/** Lo que construye el servidor tiene que pasar la puerta de verdad. */
function pasaElEsquema(entrada: unknown) {
  return validateOperationInput(OPERACION!, entrada);
}

describe("un ticket de otro conjunto no se toca", () => {
  it("rechaza un ticket cuyo tenantId es de otro conjunto", () => {
    expect(ticketPerteneceAlConjunto({ tenantId: AJENO }, CONJUNTO)).toBe(false);
  });

  it("acepta el del conjunto de la sesión", () => {
    expect(ticketPerteneceAlConjunto({ tenantId: CONJUNTO }, CONJUNTO)).toBe(true);
  });

  it("rechaza un documento sin tenantId en vez de suponerlo propio", () => {
    // El repliegue cómodo —«si no trae conjunto, será el nuestro»— es el que
    // convierte un dato mal migrado en un acceso cruzado.
    expect(ticketPerteneceAlConjunto({ subject: "hola" }, CONJUNTO)).toBe(false);
  });

  it("rechaza un ticket inexistente igual que uno ajeno", () => {
    // Mismo resultado a propósito: si se distinguieran, el endpoint diría
    // cuáles existen en otros conjuntos.
    expect(ticketPerteneceAlConjunto(null, CONJUNTO)).toBe(false);
    expect(ticketPerteneceAlConjunto(undefined, CONJUNTO)).toBe(false);
  });
});

describe("la variante sale del conjunto, nunca del cliente", () => {
  it("lee buzon_simple de tenantSettings", () => {
    expect(variantePqrsDe({ moduleVariants: { pqrs: "buzon_simple" } })).toBe("buzon_simple");
  });

  it("cae al default cuando el conjunto no la tiene escrita", () => {
    // Un conjunto que ya opera no cambia de comportamiento porque falte el dato.
    expect(variantePqrsDe(null)).toBe("con_sla");
    expect(variantePqrsDe({})).toBe("con_sla");
    expect(variantePqrsDe({ moduleVariants: {} })).toBe("con_sla");
  });

  it("ignora un valor que no es del catálogo", () => {
    expect(variantePqrsDe({ moduleVariants: { pqrs: "lo_que_sea" } })).toBe("con_sla");
  });
});

describe("el mapeo del ticket", () => {
  it("lleva asunto, mensaje y variante, y pasa el esquema del catálogo", () => {
    const construida = construirEntradaPqrs(
      { subject: "Fuga en el sótano", message: "Lleva tres días goteando." },
      "con_sla",
    );

    expect(construida.ok).toBe(true);
    if (!construida.ok) return;

    expect(construida.entrada).toMatchObject({
      asunto: "Fuga en el sótano",
      mensaje: "Lleva tres días goteando.",
      variante: "con_sla",
    });
    expect(pasaElEsquema(construida.entrada).ok).toBe(true);
  });

  it("usa el asunto como mensaje cuando el ticket no trae cuerpo", () => {
    // El mismo repliegue que hacen el portal del residente al crear y el drawer
    // al pintar. Si aquí no estuviera, esos tickets no serían asistibles.
    const construida = construirEntradaPqrs({ subject: "No sirve el ascensor", message: "  " }, "con_sla");

    expect(construida.ok).toBe(true);
    if (!construida.ok) return;
    expect(construida.entrada.mensaje).toBe("No sirve el ascensor");
    expect(pasaElEsquema(construida.entrada).ok).toBe(true);
  });

  it("no asiste un ticket sin texto ninguno", () => {
    const construida = construirEntradaPqrs({ subject: "   ", message: "" }, "con_sla");
    expect(construida).toMatchObject({ ok: false, reason: "ticket_sin_texto" });
  });

  it("propaga buzon_simple tal cual: es lo que decide la puerta dura de nulls", () => {
    const construida = construirEntradaPqrs({ subject: "Buenas", message: "Una consulta" }, "buzon_simple");

    expect(construida.ok).toBe(true);
    if (!construida.ok) return;
    expect(construida.entrada.variante).toBe("buzon_simple");
    expect(pasaElEsquema(construida.entrada).ok).toBe(true);
  });
});

describe("el historial", () => {
  it("mapea responseHistory como administración, que es quien lo escribe", () => {
    // Fiel al producto: `respondTicket` es el único que escribe ahí y el
    // residente no tiene por dónde añadir. Es el punto donde producción difiere
    // del gold set, cuyos 18 casos con contexto lo traen del residente.
    const construida = construirEntradaPqrs(
      {
        subject: "Ruido",
        message: "Sigue el ruido por las noches",
        responseHistory: [
          { id: "r1", message: "Lo revisamos el martes." },
          { id: "r2", message: "Pasó el técnico." },
        ],
      },
      "con_sla",
    );

    expect(construida.ok).toBe(true);
    if (!construida.ok) return;
    expect(construida.entrada.historial).toEqual([
      { autor: "administracion", texto: "Lo revisamos el martes." },
      { autor: "administracion", texto: "Pasó el técnico." },
    ]);
    expect(pasaElEsquema(construida.entrada).ok).toBe(true);
  });

  it("se queda con las 10 MÁS RECIENTES y en orden, no con las primeras", () => {
    // Un hilo largo tiene lo que importa al final. Cortar por el principio
    // dejaría al modelo leyendo la conversación equivocada.
    const construida = construirEntradaPqrs(
      {
        message: "Sigo esperando",
        responseHistory: Array.from({ length: 14 }, (_, i) => ({ id: `r${i}`, message: `respuesta ${i}` })),
      },
      "con_sla",
    );

    expect(construida.ok).toBe(true);
    if (!construida.ok) return;
    expect(construida.entrada.historial).toHaveLength(10);
    expect(construida.entrada.historial?.[0]).toEqual({ autor: "administracion", texto: "respuesta 4" });
    expect(construida.entrada.historial?.at(-1)).toEqual({ autor: "administracion", texto: "respuesta 13" });
    expect(construida.recorte.historialOmitido).toBe(4);
    expect(pasaElEsquema(construida.entrada).ok).toBe(true);
  });

  it("descarta entradas vacías en vez de mandarlas al esquema", () => {
    const construida = construirEntradaPqrs(
      {
        message: "Hola",
        responseHistory: [{ id: "r1", message: "   " }, { id: "r2", message: "Real" }, { id: "r3" }],
      },
      "con_sla",
    );

    expect(construida.ok).toBe(true);
    if (!construida.ok) return;
    expect(construida.entrada.historial).toEqual([{ autor: "administracion", texto: "Real" }]);
    expect(pasaElEsquema(construida.entrada).ok).toBe(true);
  });

  it("omite el campo entero cuando no hay historial", () => {
    const construida = construirEntradaPqrs({ message: "Hola", responseHistory: [] }, "con_sla");

    expect(construida.ok).toBe(true);
    if (!construida.ok) return;
    expect(construida.entrada.historial).toBeUndefined();
    expect(pasaElEsquema(construida.entrada).ok).toBe(true);
  });

  it("aguanta un responseHistory que no es una lista", () => {
    // Dato viejo o mal migrado: no debe tumbar la asistencia.
    const construida = construirEntradaPqrs({ message: "Hola", responseHistory: "vaya" }, "con_sla");
    expect(construida).toMatchObject({ ok: true });
  });
});

describe("el recorte se dice, no se hace en silencio", () => {
  it("marca el mensaje recortado y lo deja dentro del esquema", () => {
    // El residente no tiene tope de longitud en su formulario, así que esto
    // puede pasar de verdad. Un resumen de un mensaje leído a medias parece
    // completo: que el administrador lo sepa cuesta una línea.
    const largo = "a".repeat(4500);
    const construida = construirEntradaPqrs({ message: largo }, "con_sla");

    expect(construida.ok).toBe(true);
    if (!construida.ok) return;
    expect(construida.entrada.mensaje).toHaveLength(4000);
    expect(construida.recorte.mensaje).toBe(true);
    expect(pasaElEsquema(construida.entrada).ok).toBe(true);
  });

  it("no marca recorte cuando el mensaje cabe entero", () => {
    const construida = construirEntradaPqrs({ message: "Corto" }, "con_sla");

    expect(construida.ok).toBe(true);
    if (!construida.ok) return;
    expect(construida.recorte).toEqual({ mensaje: false, historialOmitido: 0 });
  });

  it("recorta un asunto larguísimo sin romper el esquema", () => {
    const construida = construirEntradaPqrs({ subject: "b".repeat(400), message: "Hola" }, "con_sla");

    expect(construida.ok).toBe(true);
    if (!construida.ok) return;
    expect(construida.entrada.asunto).toHaveLength(200);
    expect(pasaElEsquema(construida.entrada).ok).toBe(true);
  });

  it("recorta un texto de historial larguísimo sin romper el esquema", () => {
    const construida = construirEntradaPqrs(
      { message: "Hola", responseHistory: [{ id: "r1", message: "c".repeat(1500) }] },
      "con_sla",
    );

    expect(construida.ok).toBe(true);
    if (!construida.ok) return;
    expect(construida.entrada.historial?.[0]?.texto).toHaveLength(1000);
    expect(pasaElEsquema(construida.entrada).ok).toBe(true);
  });
});
