import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { resolveStatusTone } from "../src/components/ui/StatusBadge";

/**
 * **Un `style` en línea gana a cualquier clase (27 de agosto de 2026).**
 *
 * `StatusBadge` fijaba once propiedades en línea —tamaño de letra, relleno,
 * radio, interlineado— y además aceptaba un `className`. Dos llamadas de
 * `residents/page.tsx` le pasan `text-[10px]` y **no hacía nada**: el
 * `fontSize: 12` en línea lo pisaba en silencio.
 *
 * **Y el diagnóstico que traía el análisis era más grande de lo real:** decía
 * que pasarle clases era un no-op entero. No: `ml-auto` y `shrink-0` sí
 * funcionaban, porque no estaban entre las propiedades del `style`. Solo moría
 * lo que el `style` tocaba. Se comprobó antes de arreglar.
 *
 * La regla que queda: **en línea solo va lo que cambia con el dato** (el color,
 * que sale de la tabla de tonos). La forma va en clases, para que quien llama
 * pueda ajustarla — `cn` usa `twMerge`, así que la clase de la llamada
 * sustituye a la de la base en vez de sumarse.
 */

const RAIZ = process.cwd();
const COMPONENTE = "src/components/ui/StatusBadge.tsx";

const texto = fs.readFileSync(path.resolve(RAIZ, COMPONENTE), "utf8");

/** El `style` del `span` exterior, que es el que compite con el `className`. */
function estiloExterior(): string {
  const desde = texto.indexOf("export function StatusBadge");
  const abre = texto.indexOf("style={{", desde);
  const cierra = texto.indexOf("}}", abre);
  return texto.slice(abre, cierra);
}

describe("1 · en línea solo va lo que cambia con el dato", () => {
  it("el extractor encuentra el estilo, o esta prueba no vale nada", () => {
    expect(estiloExterior()).toContain("background");
  });

  it("el color sigue en línea: sale de la tabla de tonos", () => {
    const estilo = estiloExterior();
    expect(estilo).toContain("tone.bg");
    expect(estilo).toContain("tone.text");
  });

  it("ninguna propiedad de FORMA se fija en línea", () => {
    /**
     * Son las que quien llama podría querer ajustar, y las que morían antes.
     */
    const PROHIBIDAS = [
      "fontSize",
      "padding",
      "borderRadius",
      "lineHeight",
      "fontWeight",
      "display",
      "gap",
      "whiteSpace",
      "alignItems",
    ];
    const estilo = estiloExterior();
    const presentes = PROHIBIDAS.filter((p) => estilo.includes(p));
    expect(
      presentes,
      "Estas propiedades en línea ganan a cualquier clase, así que un " +
        "`className` que las toque muere en silencio. Llévalas a la cadena de " +
        "clases base:\n" + presentes.join("\n"),
    ).toEqual([]);
  });

  it("la forma vive en clases y pasa por `cn`, que fusiona", () => {
    // Sin `cn`/`twMerge` la clase de la llamada se SUMA a la de la base y gana
    // la que Tailwind ponga después — que no es determinista para el que llama.
    expect(texto).toContain('from "@/lib/utils/cn"');
    expect(texto).toMatch(/className=\{cn\(/);
  });
});

describe("2 · el comportamiento no cambió", () => {
  /**
   * El arreglo es de forma, no de significado: los tonos y las etiquetas tienen
   * que seguir resolviendo igual. Se comprueban en los dos idiomas, que es como
   * está escrita la tabla.
   */
  it("resuelve los estados conocidos en inglés y en español", () => {
    expect(resolveStatusTone("active").label).toBe("Activo");
    expect(resolveStatusTone("activo").label).toBe("Activo");
    expect(resolveStatusTone("in_progress").label).toBe("En proceso");
    expect(resolveStatusTone("PENDIENTE").label).toBe("Pendiente");
  });

  it("un estado desconocido no revienta: capitaliza y usa el tono neutro", () => {
    const t = resolveStatusTone("algo_raro");
    expect(t.label).toBe("Algo raro");
    // El hexadecimal era un SUSTITUTO de «el tono neutro»: cuando el color se
    // movio a tokens (`PRD-V-FEAT-007`), la prueba se cayo sin que el
    // comportamiento cambiara. Se compara contra un estado conocido que usa ese
    // mismo tono, que es lo que la prueba siempre quiso decir.
    const neutroConocido = resolveStatusTone("inactivo");
    expect(t.bg).toBe(neutroConocido.bg);
    expect(t.text).toBe(neutroConocido.text);
  });

  it("sin estado tampoco revienta", () => {
    expect(resolveStatusTone("").label).toBe("Sin estado");
  });
});
