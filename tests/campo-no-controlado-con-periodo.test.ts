import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * **Un campo NO CONTROLADO dentro de una lista que cambia de contexto tiene que
 * llevar ese contexto en su `key`.**
 *
 * `defaultValue` solo se lee cuando React monta el nodo. Si la lista se
 * re-renderiza con datos de otro período —otro mes, otro conjunto, otro
 * filtro— y la `key` no cambia, React **reutiliza el mismo input** y el usuario
 * ve el valor del contexto anterior sobre datos vacíos.
 *
 * **Pasó el 10 de septiembre de 2026 en la pantalla de medidores**, y lo cazó
 * mirarla: al cambiar de septiembre a octubre, la columna «Anterior», el consumo
 * y el importe decían «—» —octubre estaba vacío— y **el campo seguía enseñando
 * la lectura de septiembre**. Quien lo mirara daría el mes por registrado y se
 * lo saltaría entero.
 *
 * Ni el typecheck ni las 1806 pruebas lo veían: no es un error de tipos ni de
 * lógica, es **una identidad de nodo**. Solo se ve en pantalla, o aquí.
 */

const raiz = path.resolve(__dirname, "..");

/** Pantallas con un selector de período que además pintan campos por fila. */
const PANTALLAS_CON_PERIODO = [
  "src/app/(admin)/admin/finanzas/medidores/page.tsx",
];

describe("un campo no controlado lleva su período en la `key`", () => {
  it("hay pantallas que vigilar — si no, este guardián mide la nada", () => {
    // El control del propio medidor: sobre una lista vacía todo lo de abajo
    // pasaría solo.
    expect(PANTALLAS_CON_PERIODO.length).toBeGreaterThan(0);
  });

  it.each(PANTALLAS_CON_PERIODO)("%s — todo `defaultValue` va con una `key` que incluye el período", (rel) => {
    const fuente = fs.readFileSync(path.join(raiz, rel), "utf8");

    // Cada bloque de atributos de un elemento que declare `defaultValue`.
    const bloques = [...fuente.matchAll(/<[A-Za-z][^>]*defaultValue[^>]*>/gs)].map((m) => m[0]);
    expect(bloques.length, "la pantalla ya no usa `defaultValue`: revisa este guardián").toBeGreaterThan(0);

    const sinPeriodoEnLaKey = bloques.filter((b) => {
      const key = /key=\{`([^`]*)`\}/.exec(b);
      return !key || !/periodo|period/i.test(key[1]);
    });

    expect(
      sinPeriodoEnLaKey,
      "Un campo no controlado que se repinta al cambiar de período conserva el valor del período ANTERIOR: `defaultValue` solo se lee al montar. Añade el período a la `key` para forzar el remonte.",
    ).toEqual([]);
  });
});
