import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { lecturaDePorcentaje, SIN_DATOS } from "@/lib/dashboard/indicadores";
import { getTicketTypeLabel } from "@/features/pqrs/ticket-status";

/**
 * **`PRD-V-FIX-003` — una sola definición por métrica del Panel de Control.**
 *
 * Estas pruebas existen por un defecto MEDIDO contra producción el 30 de agosto de 2026, no por
 * cubrir líneas: el «% recaudo» del panel mide **un mes** y el de Cartera **hasta doce períodos**,
 * con el mismo rótulo y a un clic de distancia, y **los siete conjuntos divergían** — Palmas y
 * Nogal marcaban 0,0% contra 50,0%. En cuatro de ellos el panel afirmaba además, **en rojo**, un
 * recaudo del 0,0% en un mes sin un solo cobro emitido.
 *
 * **Lo que estas pruebas NO vigilan, a propósito: la aritmética.** `statementChargedAmount` y
 * compañía están bien y ya las vigila `tests/kpi-definitions.test.ts`. Ese guardián está en verde
 * y el defecto era real: **vigila la fórmula, no lo que el consumidor hace con su resultado.**
 * De ahí que lo de aquí mire la ventana, el rótulo y el borde del cero.
 */

function ficherosDeCodigo(base: string): string[] {
  const salida: string[] = [];
  const visitar = (dir: string) => {
    for (const nombre of readdirSync(dir)) {
      if (nombre === "node_modules" || nombre.startsWith(".")) continue;
      const ruta = join(dir, nombre);
      if (statSync(ruta).isDirectory()) visitar(ruta);
      else if (/\.tsx?$/.test(nombre)) salida.push(ruta);
    }
  };
  visitar(base);
  return salida;
}

const BASES = ["src", "components", "features"];

/**
 * Parte un fichero en **bloques de rótulo**: desde cada `label` hasta el siguiente. Así lo que se
 * encuentre dentro pertenece a ESE rótulo y no al de al lado, que es la trampa de mirar «los N
 * caracteres siguientes» — un `scope` del vecino daría por buena una tarjeta muda.
 *
 * **El corte lo hace TODA aparición de `label`, también las que no son literales**, y esa
 * precisión no es cosmética: la escribí cortando solo por literales y **la falsación CF2 pasó en
 * verde**. Entre el `label: "% recaudo"` del panel y el siguiente literal hay dos rótulos
 * calculados (`label: isToday ? … : …`) y, más allá, el bucle que pinta las tarjetas con
 * `scope={kpi.scope}` — así que el bloque se tragaba media pantalla y encontraba el `scope`
 * **de otro**. El guardián daba por declarada una ventana que ya no existía.
 */
function bloquesDeRotulo(texto: string): { rotulo: string; bloque: string }[] {
  const marcas = [...texto.matchAll(/label[:=]/g)];
  const bloques = marcas.map((marca, i) =>
    texto.slice(marca.index ?? 0, i + 1 < marcas.length ? marcas[i + 1].index : texto.length),
  );
  return bloques.flatMap((bloque) => {
    const literal = /^label[:=]\s*"([^"]+)"/.exec(bloque);
    return literal ? [{ rotulo: literal[1], bloque }] : [];
  });
}

/** Todo rótulo de indicador porcentual del producto, con su fichero y su bloque. */
function rotulosPorcentuales() {
  const salida: { rotulo: string; fichero: string; bloque: string }[] = [];
  for (const base of BASES) {
    for (const fichero of ficherosDeCodigo(base)) {
      for (const { rotulo, bloque } of bloquesDeRotulo(readFileSync(fichero, "utf-8"))) {
        if (rotulo.trim().startsWith("%")) salida.push({ rotulo: rotulo.trim(), fichero, bloque });
      }
    }
  }
  return salida;
}

describe("una sola definición por métrica del panel", () => {
  describe("la lectura declara SIEMPRE qué ventana midió (CA1)", () => {
    /**
     * La ventana es un parámetro **obligatorio** de `lecturaDePorcentaje`, no un adorno: no se
     * puede construir la cifra sin decir sobre qué se calculó. Es la parte del arreglo que el
     * compilador sostiene; la otra —que las pantallas la usen— la sostiene el guardián de abajo.
     */
    it("la ventana viaja con la cifra", () => {
      expect(lecturaDePorcentaje(50, 1_200_000, "Mes en curso").ventana).toBe("Mes en curso");
      expect(lecturaDePorcentaje(50, 1_200_000, "sep 25 – ago 26").ventana).toBe("sep 25 – ago 26");
    });

    /**
     * **El caso exacto de `tenant-palmas-cdmx`, que es lo que se midió.** Las dos cifras siguen
     * siendo distintas —y deben serlo: son preguntas distintas—, pero ya no son dos afirmaciones
     * contradictorias, porque cada una dice de qué habla.
     */
    it("Palmas: las dos pantallas siguen dando cifras distintas, y ahora cada una dice de qué", () => {
      const panel = lecturaDePorcentaje(0, 0, "Mes en curso");
      const cartera = lecturaDePorcentaje(50, 2_400_000, "sep 25 – ago 26");
      expect(panel.valor).not.toBe(cartera.valor);
      expect(panel.ventana).not.toBe(cartera.ventana);
      expect(panel.ventana).toBeTruthy();
      expect(cartera.ventana).toBeTruthy();
    });
  });

  describe("«sin cobros emitidos» no se disfraza de «nadie pagó» (CA2, CA3)", () => {
    it("CA2 — sin nada facturado no hay porcentaje ni alarma", () => {
      const lectura = lecturaDePorcentaje(0, 0, "Mes en curso");
      expect(lectura.valor).toBe(SIN_DATOS);
      expect(lectura.tono).toBe("neutral");
      expect(lectura.sinDatos).toBe(true);
      expect(lectura.tono).not.toBe("alert");
    });

    it("CA3 — con cobros emitidos y nada saldado sigue siendo alarma, y sigue siendo 0,0%", () => {
      const lectura = lecturaDePorcentaje(0, 1_200_000, "Mes en curso");
      expect(lectura.valor).toBe("0.0%");
      expect(lectura.tono).toBe("alert");
      expect(lectura.sinDatos).toBe(false);
    });

    /**
     * **Sin esta, CA2 pasaría con el indicador siempre en neutro** — y eso sería el defecto
     * gemelo del que `UX-003` ya cometió con las barras: color correcto, información perdida.
     * Un tono constante cumple cualquier prueba que no exija distinguir.
     */
    it("y la lectura DISTINGUE de verdad: los tres tonos del rango siguen apareciendo", () => {
      const tonos = new Set([0, 55, 90].map((pct) => lecturaDePorcentaje(pct, 1_200_000, "x").tono));
      expect(tonos).toEqual(new Set(["alert", "pending", "success"]));
      expect(lecturaDePorcentaje(0, 0, "x").tono).not.toBe(lecturaDePorcentaje(0, 1_200_000, "x").tono);
    });
  });

  describe("el mismo valor de dominio tiene un solo rótulo (CA4)", () => {
    it("CA4 — un ticket de tipo `other` se llama «General»", () => {
      expect(getTicketTypeLabel("other")).toBe("General");
    });

    /**
     * **Este es el diente que impide que vuelva la tercera copia.** El widget de antigüedad tenía
     * su propio mapa y por eso el MISMO ticket se llamaba «Otros» allí y «General» en `/admin/pqrs`.
     * Mide el código: cuenta cuántos ficheros declaran el mapa de tipos, no si uno concreto lo tiene.
     */
    it("el mapa de tipos de ticket está declarado en UN solo fichero", () => {
      const declarantes: string[] = [];
      for (const base of BASES) {
        for (const fichero of ficherosDeCodigo(base)) {
          const texto = readFileSync(fichero, "utf-8");
          if (/petition:\s*"/.test(texto) && /complaint:\s*"/.test(texto) && /claim:\s*"/.test(texto)) {
            declarantes.push(fichero);
          }
        }
      }
      // Que haya encontrado algo: con la recolección vacía esto pasaría sin verificar nada.
      expect(declarantes.length).toBeGreaterThan(0);
      expect(declarantes).toEqual([join("src", "features", "pqrs", "ticket-status.ts")]);
    });
  });

  describe("guardián de rótulos de indicador (CA5, CA7)", () => {
    /**
     * **CA7.** `R1` no prohíbe que dos pantallas enseñen «% recaudo»: prohíbe que lo hagan **sin
     * decir cada una qué mide**. Por eso el guardián no cuenta apariciones, sino que exige la
     * ventana en cada sitio donde el rótulo se repite. Recorre el código: un rótulo nuevo en una
     * pantalla nueva entra solo, que es justo lo que una lista escrita a mano no haría.
     */
    it("todo rótulo porcentual repetido en dos ficheros declara su ventana en los dos", () => {
      const encontrados = rotulosPorcentuales();

      // **CF3 vive aquí.** Con la recolección vacía —o rota— esta prueba pasaría en verde sin
      // haber mirado una sola pantalla, que es como nacen los guardianes ciegos.
      expect(encontrados.length).toBeGreaterThanOrEqual(2);

      const porRotulo = new Map<string, { fichero: string; bloque: string }[]>();
      for (const item of encontrados) {
        porRotulo.set(item.rotulo, [...(porRotulo.get(item.rotulo) ?? []), item]);
      }

      const repetidos = [...porRotulo.entries()].filter(
        ([, sitios]) => new Set(sitios.map((s) => s.fichero)).size > 1,
      );
      // El defecto que motivó la ficha es «% recaudo» en dos pantallas: si deja de estar repetido,
      // este guardián se quedaría sin nada que vigilar y hay que enterarse.
      expect(repetidos.length).toBeGreaterThan(0);

      const mudos = repetidos.flatMap(([rotulo, sitios]) =>
        sitios.filter((s) => !/scope[:=]/.test(s.bloque)).map((s) => `${rotulo} @ ${s.fichero}`),
      );
      expect(mudos).toEqual([]);
    });

    /** **CA5.** «Cartera total» suma todos los períodos y se lee al lado de un indicador del mes. */
    it("CA5 — «Cartera total» declara que es un acumulado", () => {
      const panel = readFileSync(join("src", "app", "(admin)", "admin", "page.tsx"), "utf-8");
      const bloque = bloquesDeRotulo(panel).find((b) => b.rotulo === "Cartera total");
      expect(bloque).toBeDefined();
      expect(bloque!.bloque).toMatch(/scope:\s*"Acumulado/);
    });
  });

  /**
   * **CA6.** Las tres funciones de la escala necesitan el total para distinguir «cero medido» de
   * «nada que medir». `colorPorPorcentaje` ya lo pedía —y explicaba por qué en un comentario—;
   * `tonoPorPorcentaje` no, y por eso el panel pintaba de rojo un mes sin cobros. Esta prueba
   * mide las LLAMADAS, no la firma: el compilador ya vigila la firma, y lo que se repite es que
   * alguien pinte un porcentaje nuevo por el camino corto.
   */
  it("CA6 — ninguna llamada de la escala se hace sin el total", () => {
    const sinTotal: string[] = [];
    let llamadas = 0;
    for (const base of BASES) {
      for (const fichero of ficherosDeCodigo(base)) {
        const texto = readFileSync(fichero, "utf-8");
        for (const m of texto.matchAll(/\b(tonoPorPorcentaje|colorPorPorcentaje|colorDeCarril)\(([^)]*)\)/g)) {
          llamadas += 1;
          if (!m[2].includes(",")) sinTotal.push(`${m[1]}(${m[2]}) @ ${fichero}`);
        }
      }
    }
    // Que haya encontrado llamadas: sin esto, borrar la escala entera dejaría la prueba en verde.
    expect(llamadas).toBeGreaterThan(0);
    expect(sinTotal).toEqual([]);
  });
});
