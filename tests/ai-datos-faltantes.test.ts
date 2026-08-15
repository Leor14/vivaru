import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  CATEGORIAS_DATO_FALTANTE,
  claveDatoFaltante,
  etiquetaDe,
  ordenarDatosFaltantes,
  type DatoFaltante,
} from "@/lib/ai/datos-faltantes";

/**
 * El orden de la lista de lo que falta — Paso 2.5.
 *
 * No es una prueba de maquetación: **qué dato ve primero el administrador es la
 * decisión de producto de toda la pantalla.** Sale de medir 71 avisos reales, y
 * si alguien reordena el enum sin querer, esto lo caza.
 */

const dato = (categoria: DatoFaltante["categoria"], detalle: string): DatoFaltante => ({ categoria, detalle });

describe("el orden de lo que falta", () => {
  it("pone «cuánto dura» arriba del todo, venga donde venga", () => {
    // Falta en el 95% de los avisos reales. Es el requisito número uno de la
    // hipótesis de valor y la razón de que la operación subiera a v2.
    const ordenados = ordenarDatosFaltantes([
      dato("accion", "¿Qué debe hacer el residente?"),
      dato("alcance", "¿A qué torres afecta?"),
      dato("duracion", "¿Cuánto dura?"),
      dato("fecha", "¿Qué día?"),
    ]);
    expect(ordenados[0].categoria).toBe("duracion");
  });

  it("sigue el orden del catálogo, no el que devolvió el modelo", () => {
    const ordenados = ordenarDatosFaltantes([
      dato("otro", "¿Cuánto cuesta?"),
      dato("accion", "¿Qué hago?"),
      dato("fecha", "¿Cuándo?"),
      dato("duracion", "¿Hasta cuándo?"),
      dato("alcance", "¿A quién?"),
    ]);
    expect(ordenados.map((d) => d.categoria)).toEqual(["duracion", "fecha", "alcance", "accion", "otro"]);
  });

  it("es estable dentro de una misma categoría", () => {
    // Dos propuestas parecidas no deben leerse distinto sin razón visible.
    const ordenados = ordenarDatosFaltantes([
      dato("fecha", "primera"),
      dato("fecha", "segunda"),
      dato("fecha", "tercera"),
    ]);
    expect(ordenados.map((d) => d.detalle)).toEqual(["primera", "segunda", "tercera"]);
  });

  it("no pierde un dato de una categoría que esta copia no conozca", () => {
    // Si el catálogo del servidor crece y esta copia se queda atrás, el dato se
    // ve al final. Perderlo sería lo grave: es lo que el aviso necesita.
    const desconocida = { categoria: "presupuesto", detalle: "¿Cuánto cuesta?" } as unknown as DatoFaltante;
    const ordenados = ordenarDatosFaltantes([desconocida, dato("duracion", "¿Cuánto dura?")]);
    expect(ordenados).toHaveLength(2);
    expect(ordenados[0].categoria).toBe("duracion");
    expect(ordenados[1]).toBe(desconocida);
  });

  it("no muta la lista que recibe", () => {
    const original = [dato("accion", "a"), dato("duracion", "b")];
    ordenarDatosFaltantes(original);
    expect(original[0].categoria).toBe("accion");
  });
});

describe("etiquetas y claves", () => {
  it("habla el idioma del administrador, no el del esquema", () => {
    expect(etiquetaDe("alcance")).toBe("A quién afecta");
    expect(etiquetaDe("duracion")).toBe("Cuánto dura");
  });

  it("cae a «Otro dato» si la categoría no se conoce", () => {
    expect(etiquetaDe("presupuesto" as never)).toBe("Otro dato");
  });

  it("distingue dos datos de la misma categoría", () => {
    // Si la clave no distinguiera, descartar uno ocultaría el otro.
    expect(claveDatoFaltante(dato("fecha", "¿Qué día?"))).not.toBe(claveDatoFaltante(dato("fecha", "¿Qué hora?")));
  });
});

describe("la copia del catálogo no se desincroniza", () => {
  it("tiene exactamente las mismas categorías que el servidor", () => {
    // No se puede importar desde `functions/`: rompe el `next build` de App
    // Hosting (trampa número uno de CLAUDE.md). Así que la copia se compara
    // contra el fuente leyéndolo como texto — feo, y mejor que enterarse en
    // producción de que la interfaz no sabe ordenar una categoría nueva.
    const fuente = readFileSync(join(__dirname, "../functions/src/ai/catalog.ts"), "utf8");
    const match = /CATEGORIAS_DATO_FALTANTE = \[([^\]]+)\]/.exec(fuente);
    expect(match, "no se encontró CATEGORIAS_DATO_FALTANTE en el catálogo del servidor").toBeTruthy();

    const delServidor = [...match![1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    expect(delServidor).toEqual([...CATEGORIAS_DATO_FALTANTE]);
  });
});
