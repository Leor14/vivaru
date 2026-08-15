import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Gold set de clasificación de PQRS — Fase 1 de `PRD-VAI-FEAT-002`.
 *
 * Esto NO evalúa al modelo. Garantiza que **el conjunto es utilizable**: que
 * ninguna etiqueta se sale del catálogo de `Ticket`, que no hay identificadores
 * repetidos, y que la cobertura mínima por etiqueta se sostiene. Un conjunto
 * roto tiene que fallar aquí y no el día de la evaluación, cuando ya se están
 * mirando resultados.
 *
 * Vive en `functions/tests/` a propósito, y no en `tests/` de la raíz: esa
 * suite hoy corre CERO tests por un glob que el `sh` de npm no expande
 * —documentado en `docs/pendientes.md`—, así que un test allí no protegería
 * nada. No importa nada de `functions/src`: solo lee el JSON del repo.
 *
 * El archivo se GENERA con `scripts/construir-gold-set-pqrs.mjs`. Si este test
 * falla tras editar `etiquetas.tsv`, hay que volver a generarlo.
 */

// Los catálogos son los de `src/types/domain.ts`. Se copian como literales a
// propósito: importar desde `src/` dentro de `functions/` es justo lo que
// rompe el build de App Hosting. Si el dominio cambia, este test debe fallar
// —y esa es la señal de que el gold set quedó desalineado del producto.
const CATEGORIAS = ["pqrs", "maintenance", "billing"];
const TIPOS = ["petition", "complaint", "claim", "suggestion", "other"];
const PRIORIDADES = ["low", "medium", "high"];
const TEMAS = [
  "agua", "cuotas_pagos", "asamblea_administracion", "obra_mantenimiento",
  "elevadores", "seguridad_porteria", "luz_electricidad", "convivencia_ruido",
  "amenidades", "accesos_estacionamiento", "limpieza_basura",
];

interface Caso {
  id: string;
  fuente: string;
  pais: string | null;
  texto: string;
  contextoPrevio?: Array<{ autor: string; texto: string }>;
  variante: string;
  espera: {
    category: string;
    type: string;
    priority: string;
    tema: string;
    temasSecundarios?: string[];
    banderas?: string[];
  };
  porQue: string;
}

const conjunto = JSON.parse(
  readFileSync(join(__dirname, "../../datasets/pqrs/gold-set.json"), "utf8"),
) as { operationKey: string; version: number; casos: Caso[] };

const casos = conjunto.casos;

describe("gold set de PQRS", () => {
  it("tiene casos y una versión", () => {
    expect(casos.length).toBeGreaterThan(100);
    expect(conjunto.version).toBeGreaterThanOrEqual(1);
  });

  it("no repite identificadores", () => {
    const ids = casos.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("toda etiqueta pertenece a su catálogo", () => {
    for (const c of casos) {
      expect(CATEGORIAS, c.id).toContain(c.espera.category);
      expect(TIPOS, c.id).toContain(c.espera.type);
      expect(PRIORIDADES, c.id).toContain(c.espera.priority);
      expect(TEMAS, c.id).toContain(c.espera.tema);
      for (const t of c.espera.temasSecundarios ?? []) expect(TEMAS, c.id).toContain(t);
    }
  });

  it("ningún caso se queda sin texto ni sin justificación", () => {
    for (const c of casos) {
      expect(c.texto.trim().length, c.id).toBeGreaterThan(0);
      expect(c.porQue.trim().length, c.id).toBeGreaterThan(0);
    }
  });

  it("un tema secundario nunca repite al principal", () => {
    for (const c of casos) {
      expect(c.espera.temasSecundarios ?? [], c.id).not.toContain(c.espera.tema);
    }
  });

  /**
   * Un caso marcado `sin_contexto` sin su hilo es exactamente el defecto que la
   * bandera denuncia: solo no se puede clasificar, y menos su prioridad.
   */
  it("los casos sin_contexto traen el hilo previo", () => {
    const sinContexto = casos.filter((c) => c.espera.banderas?.includes("sin_contexto"));
    expect(sinContexto.length).toBeGreaterThan(10);
    for (const c of sinContexto) {
      expect(c.contextoPrevio?.length, c.id).toBeGreaterThan(0);
    }
  });

  /** Los ocho de inyección son los únicos que no salen de un corpus real. */
  it("los sintéticos están marcados y son solo los de inyección", () => {
    const sinteticos = casos.filter((c) => c.fuente === "sintetico");
    expect(sinteticos.length).toBeGreaterThanOrEqual(8);
    for (const c of sinteticos) {
      expect(c.espera.banderas, c.id).toContain("prompt_injection");
      expect(c.pais, c.id).toBeNull();
    }
    // Y al revés: nada real puede colarse como inyección.
    for (const c of casos.filter((x) => x.espera.banderas?.includes("prompt_injection"))) {
      expect(c.fuente, c.id).toBe("sintetico");
    }
  });

  /**
   * El criterio de aceptación más duro de la PRD es «recall de `high` ≥95%».
   * Sin suficientes casos `high` esa cifra no significa nada: con cinco casos,
   * fallar uno son veinte puntos.
   */
  it("hay casos high suficientes para medir su recall", () => {
    const high = casos.filter((c) => c.espera.priority === "high");
    expect(high.length).toBeGreaterThanOrEqual(15);
  });

  it("los once temas están representados", () => {
    for (const tema of TEMAS) {
      const n = casos.filter((c) => c.espera.tema === tema).length;
      expect(n, `tema ${tema}`).toBeGreaterThanOrEqual(3);
    }
  });

  /** Dos países, o el conjunto vuelve a medir un solo edificio. */
  it("los dos corpus están representados", () => {
    for (const pais of ["MX", "EC"]) {
      expect(casos.filter((c) => c.pais === pais).length, pais).toBeGreaterThanOrEqual(30);
    }
  });

  /**
   * Un conjunto de casos fáciles da un número alto y no dice nada — la misma
   * razón por la que el de comunicaciones es 46% incómodo.
   */
  it("los casos difíciles no son una minoría decorativa", () => {
    const dificiles = casos.filter((c) => (c.espera.banderas ?? []).length > 0);
    expect(dificiles.length / casos.length).toBeGreaterThan(0.2);
  });
});
