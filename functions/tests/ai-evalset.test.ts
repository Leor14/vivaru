import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { findOperation, validateOperationInput, type OperationDefinition } from "../src/ai/catalog";

/**
 * Conjunto de evaluación del borrador de comunicaciones — Paso 2.2.
 *
 * Esto NO evalúa al modelo: eso es el Paso 2.4 y todavía no existe. Lo que hace
 * es garantizar que **el conjunto es ejecutable**. Un caso que no cumple el
 * esquema de entrada no falla el día que se escribe, falla el día de la
 * evaluación —cuando ya estás mirando resultados y no quieres estar depurando
 * datos de prueba.
 */

const OPERACION = findOperation("comunicaciones-redactar") as OperationDefinition;

interface Caso {
  id: string;
  categoria: string;
  dificultad: "rutinario" | "incomodo";
  porQue: string;
  decisionDeProducto?: boolean;
  /** El criterio principal lo tiene que juzgar una persona: tono, claridad, estructura. */
  requiereJuicioHumano?: boolean;
  input: unknown;
  /** Cómo es el conjunto del caso. Ausente = lo fija la corrida. */
  contexto?: { tieneAgrupaciones?: boolean };
  espera: {
    assumptionsVacio?: boolean;
    missingInformationVacio?: boolean;
    missingInformationMenciona?: string[];
    missingInformationCategorias?: string[];
    missingInformationSinCategorias?: string[];
    bodyContiene?: string[];
    bodyContieneAlguna?: string[];
    bodyNoContiene?: string[];
    bodyNoCoincideCon?: string[];
    titleContiene?: string[];
    bodyMaxLongitud?: number;
    qualityFlagsMenciona?: string[];
    notas: string;
  };
}

const conjunto = JSON.parse(
  readFileSync(join(__dirname, "../../datasets/evaluacion/comunicaciones-redactar.json"), "utf8"),
) as { operationKey: string; version: number; casos: Caso[] };

describe("el conjunto apunta a una operación que existe", () => {
  it("la clave y la versión coinciden con el catálogo", () => {
    // Si el contrato sube de versión y el conjunto no, se estaría evaluando
    // contra un esquema que ya no es el que corre.
    expect(conjunto.operationKey).toBe(OPERACION.key);
    expect(conjunto.version).toBe(OPERACION.version);
  });
});

describe("los casos son EJECUTABLES", () => {
  it("todas las entradas cumplen el esquema real del catálogo", () => {
    const invalidos = conjunto.casos
      .map((c) => ({ id: c.id, r: validateOperationInput(OPERACION, c.input) }))
      .filter((x) => !x.r.ok)
      .map((x) => `${x.id}: ${x.r.ok === false ? x.r.detail : ""}`);

    expect(invalidos).toEqual([]);
  });

  it("ninguna entrada supera el límite de tamaño de la operación", () => {
    for (const caso of conjunto.casos) {
      expect(JSON.stringify(caso.input).length).toBeLessThanOrEqual(OPERACION.limits.maxInputChars);
    }
  });

  it("las expresiones regulares de las afirmaciones compilan", () => {
    // Una regex rota no se nota hasta que el evaluador revienta a mitad de la
    // corrida, con la mitad de los casos ya consumidos y pagados.
    for (const caso of conjunto.casos) {
      for (const patron of caso.espera.bodyNoCoincideCon ?? []) {
        expect(() => new RegExp(patron)).not.toThrow();
      }
    }
  });
});

describe("higiene del conjunto", () => {
  it("no hay identificadores repetidos", () => {
    const ids = conjunto.casos.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("cada caso explica POR QUÉ está en el conjunto", () => {
    // Un caso sin justificación es un caso que nadie sabrá si puede borrar.
    for (const caso of conjunto.casos) {
      expect(caso.porQue.length).toBeGreaterThan(20);
      expect(caso.espera.notas.length).toBeGreaterThan(10);
    }
  });

  it("TODOS exigen assumptions vacío", () => {
    // Es la regla dura de la PRD. Si un caso la relajara, el conjunto estaría
    // enseñando que a veces se puede inventar.
    for (const caso of conjunto.casos) {
      expect(caso.espera.assumptionsVacio).toBe(true);
    }
  });

  it("cada caso afirma algo más que «assumptions vacío»", () => {
    // Un caso cuya única expectativa es la regla que cumplen los 50 no aporta
    // nada al conjunto: siempre pasa o siempre falla con todos los demás.
    for (const caso of conjunto.casos) {
      const otras = Object.keys(caso.espera).filter((k) => k !== "assumptionsVacio" && k !== "notas");
      expect(otras.length, `el caso ${caso.id} no comprueba nada específico`).toBeGreaterThan(0);
    }
  });

  it("el juicio humano es explícito y excepcional", () => {
    // Hay criterios que una máquina no puede decidir —si el tono suena a
    // reproche, si la estructura es legible—. Marcarlos es honesto; que sean
    // muchos convertiría la evaluación automática en decorativa.
    const conJuicio = conjunto.casos.filter((c) => c.requiereJuicioHumano);
    expect(conJuicio.length / conjunto.casos.length).toBeLessThanOrEqual(0.2);

    // Y aun marcados, tienen que comprobar algo por su cuenta.
    for (const caso of conJuicio) {
      const otras = Object.keys(caso.espera).filter((k) => k !== "assumptionsVacio" && k !== "notas");
      expect(otras.length, `${caso.id} se apoya solo en el juicio humano`).toBeGreaterThan(0);
    }
  });
});

describe("la mezcla del conjunto", () => {
  it("hay al menos 50 casos", () => {
    expect(conjunto.casos.length).toBeGreaterThanOrEqual(50);
  });

  it("al menos un tercio son incómodos", () => {
    // Un conjunto lleno de casos fáciles da un número alto y no dice nada.
    const incomodos = conjunto.casos.filter((c) => c.dificultad === "incomodo");
    expect(incomodos.length / conjunto.casos.length).toBeGreaterThanOrEqual(0.33);
  });

  it("cubre las familias que el plan exige explícitamente", () => {
    const categorias = new Set(conjunto.casos.map((c) => c.categoria));
    for (const obligatoria of ["incompleto", "contradiccion", "mezcla", "ambiguo", "inyeccion"]) {
      expect(categorias, `falta la familia ${obligatoria}`).toContain(obligatoria);
    }
  });

  it("cubre los temas que de verdad aparecen en el corpus", () => {
    // Frecuencias observadas en datasets/chat-vecinal/analisis.md.
    const categorias = new Set(conjunto.casos.map((c) => c.categoria));
    for (const tema of ["agua", "cuotas", "asamblea", "obra", "elevadores", "seguridad", "convivencia"]) {
      expect(categorias, `falta el tema ${tema}`).toContain(tema);
    }
  });

  it("hay varios casos de comprobación de alucinación", () => {
    // Son los que impiden que el modelo rellene lo que no se le dio, y el fallo
    // que más rápido destruye la confianza del administrador.
    const conNoInventar = conjunto.casos.filter(
      (c) => (c.espera.bodyNoContiene?.length ?? 0) > 0 || (c.espera.bodyNoCoincideCon?.length ?? 0) > 0,
    );
    expect(conNoInventar.length).toBeGreaterThanOrEqual(10);
  });

  it("la DURACIÓN pesa lo que pesa en la realidad", () => {
    // El hueco más frecuente del corpus: falta en el 95% de los avisos y en el
    // 68% de los de agua (`datasets/linea-base/hipotesis-de-valor.md`). Estuvo
    // representado con 2 casos de 50 hasta el 12 de agosto de 2026 — la
    // evaluación habría medido muy bien lo que no importa.
    const duracion = conjunto.casos.filter((c) => c.categoria === "duracion");
    expect(duracion.length).toBeGreaterThanOrEqual(6);

    // Y no basta con que existan: la mitad tiene que comprobar que NO se
    // inventa la hora de fin, que es el fallo concreto.
    const noInventanElFinal = duracion.filter((c) => (c.espera.bodyNoCoincideCon?.length ?? 0) > 0);
    expect(noInventanElFinal.length).toBeGreaterThanOrEqual(3);
  });

  it("los casos de inyección exigen que NO se obedezca", () => {
    const inyecciones = conjunto.casos.filter((c) => c.categoria === "inyeccion");
    expect(inyecciones.length).toBeGreaterThanOrEqual(3);
    for (const caso of inyecciones) {
      expect(caso.espera.bodyNoContiene?.length ?? 0).toBeGreaterThan(0);
    }
  });
});

/**
 * Contexto del conjunto — 14 de agosto de 2026.
 *
 * Los casos se pasan por tres corridas: sin contexto (la referencia), con torres
 * y sin torres. Lo que se protege aquí es que ese barrido no produzca casos
 * incoherentes ni un conjunto que premie el silencio.
 */
describe("el conjunto sabe en qué tipo de conjunto ocurre cada caso", () => {
  it("todo caso que nombre una torre declara que su conjunto las tiene", () => {
    // Si no lo declarara, la corrida «sin torres» le diría al modelo que el
    // edificio no tiene torres mientras los hechos le hablan de la torre 2. El
    // resultado no mediría el contexto, mediría una contradicción que nosotros
    // metimos.
    const incoherentes = conjunto.casos
      .filter((c) => JSON.stringify(c.input).toLowerCase().includes("torre"))
      .filter((c) => c.contexto?.tieneAgrupaciones !== true)
      .map((c) => c.id);

    expect(incoherentes).toEqual([]);
  });

  it("los casos de edificio único están y declaran lo suyo", () => {
    const unicos = conjunto.casos.filter((c) => c.categoria === "edificio-unico");
    expect(unicos.length).toBeGreaterThanOrEqual(6);
    for (const caso of unicos) {
      expect(caso.contexto?.tieneAgrupaciones, `${caso.id} no declara su contexto`).toBe(false);
    }
  });

  it("hay contrapeso: en un edificio único TAMBIÉN se pregunta por el alcance", () => {
    // La prueba que impide que este cambio degenere. Si el conjunto solo
    // castigara preguntar por el alcance, el mejor prompt sería el más callado
    // —«la trampa de la métrica», dicha en la lectura del 2.4— y estaríamos
    // destruyendo el valor del producto mientras el número sube.
    const unicos = conjunto.casos.filter((c) => c.categoria === "edificio-unico");
    const exigenAlcance = unicos.filter((c) => c.espera.missingInformationCategorias?.includes("alcance"));
    const prohibenAlcance = unicos.filter((c) => c.espera.missingInformationSinCategorias?.includes("alcance"));

    expect(exigenAlcance.length).toBeGreaterThanOrEqual(1);
    expect(prohibenAlcance.length).toBeGreaterThanOrEqual(1);
  });

  it("ninguna afirmación nombra una categoría que no existe", () => {
    // Una categoría mal escrita en «lo que no debe pedir» no falla nunca: el
    // caso pasaría siempre y nadie se enteraría de que no comprueba nada.
    const validas = new Set(["duracion", "fecha", "alcance", "accion", "otro"]);
    for (const caso of conjunto.casos) {
      for (const c of [
        ...(caso.espera.missingInformationCategorias ?? []),
        ...(caso.espera.missingInformationSinCategorias ?? []),
      ]) {
        expect(validas, `${caso.id} nombra la categoría «${c}»`).toContain(c);
      }
    }
  });

  it("ningún caso exige y prohíbe la misma categoría", () => {
    for (const caso of conjunto.casos) {
      const exige = new Set(caso.espera.missingInformationCategorias ?? []);
      for (const c of caso.espera.missingInformationSinCategorias ?? []) {
        expect(exige.has(c), `${caso.id} exige y prohíbe «${c}»`).toBe(false);
      }
    }
  });
});

describe("las decisiones de producto están marcadas y trazadas", () => {
  it("los casos sin respuesta técnica correcta llevan bandera", () => {
    // Para que quien revise el conjunto sepa cuáles son decisiones que alguien
    // tomó, y no criterios que salieron de la ingeniería.
    const decisiones = conjunto.casos.filter((c) => c.decisionDeProducto);
    expect(decisiones.length).toBeGreaterThanOrEqual(3);
  });

  it("cada decisión de producto dice en sus notas que lo es", () => {
    for (const caso of conjunto.casos.filter((c) => c.decisionDeProducto)) {
      expect(caso.espera.notas).toContain("DECISIÓN DE PRODUCTO");
    }
  });

  it("están las tres que se resolvieron el 11 de agosto de 2026", () => {
    const ids = conjunto.casos.filter((c) => c.decisionDeProducto).map((c) => c.id);
    expect(ids).toContain("senalar-vecino-por-nombre");
    expect(ids).toContain("datos-personales-en-hechos");
    expect(ids.some((id) => id.startsWith("tono-agresivo"))).toBe(true);
  });
});
