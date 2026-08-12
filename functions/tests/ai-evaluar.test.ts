import { describe, expect, it } from "vitest";

import { evaluarCaso, resumirEvaluacion, type CasoEvaluacion, type SalidaBorrador } from "../src/ai/evaluar";
import { PROMPTS, PROMPT_ACTIVO, PROMPT_VERSIONS } from "../src/ai/prompts";

/**
 * El calificador de la evaluación offline — Pasos 2.3 y 2.4.
 *
 * **Un calificador con un fallo es peor que no tener evaluación**: produce un
 * número que nadie cuestiona. Por eso es una función pura y por eso se prueba
 * entera antes de gastar la primera llamada.
 */

function salida(over: Partial<SalidaBorrador> = {}): SalidaBorrador {
  return {
    title: "Corte de agua el sábado",
    body: "Estimados residentes: el sábado habrá corte de agua de 8:00 a 14:00 en la torre central.",
    notificationSummary: "Corte de agua el sábado",
    missingInformation: [],
    qualityFlags: [],
    assumptions: [],
    ...over,
  };
}

function caso(espera: Partial<CasoEvaluacion["espera"]> = {}): CasoEvaluacion {
  return {
    id: "prueba",
    categoria: "agua",
    dificultad: "rutinario",
    input: {},
    espera: { assumptionsVacio: true, notas: "n/a", ...espera },
  };
}

describe("la regla dura", () => {
  it("falla si assumptions trae algo", () => {
    const r = evaluarCaso(caso(), salida({ assumptions: ["supuse la hora"] }));
    expect(r.pasa).toBe(false);
    expect(r.fallos[0]).toContain("assumptions");
  });

  it("pasa con assumptions vacío", () => {
    expect(evaluarCaso(caso(), salida()).pasa).toBe(true);
  });
});

describe("detección de invenciones — lo que más importa", () => {
  it("marca como INVENTADO lo que aparece sin habérselo dado", () => {
    const r = evaluarCaso(caso({ bodyNoContiene: ["sábado"] }), salida());
    expect(r.pasa).toBe(false);
    expect(r.fallos[0]).toContain("INVENTADO");
  });

  it("caza una hora inventada por expresión regular", () => {
    const r = evaluarCaso(caso({ bodyNoCoincideCon: ["\\d{1,2}:\\d{2}"] }), salida());
    expect(r.pasa).toBe(false);
    expect(r.fallos[0]).toContain("8:00");
  });

  it("no marca nada cuando el modelo se contuvo", () => {
    const limpio = salida({ body: "Estimados residentes: habrá corte de agua en la torre central." });
    expect(evaluarCaso(caso({ bodyNoCoincideCon: ["\\d{1,2}:\\d{2}"] }), limpio).pasa).toBe(true);
  });

  it("una regex rota del caso se reporta como fallo, no revienta la corrida", () => {
    // A mitad de una corrida con la mitad de las llamadas ya pagadas, un throw
    // pierde todo el trabajo. Mejor un fallo señalado.
    const r = evaluarCaso(caso({ bodyNoCoincideCon: ["([sin cerrar"] }), salida());
    expect(r.pasa).toBe(false);
    expect(r.fallos[0]).toContain("no compila");
  });
});

describe("pedir lo que falta", () => {
  it("falla si no pidió el dato ausente", () => {
    const r = evaluarCaso(caso({ missingInformationMenciona: ["hora"] }), salida());
    expect(r.pasa).toBe(false);
    expect(r.fallos[0]).toContain("no pidió el dato");
  });

  it("basta con que UNA de las palabras aparezca en ALGUNO de los ítems", () => {
    // Se comprueba que pidió el dato, no cómo redactó la pregunta.
    const s = salida({ missingInformation: ["¿A qué hora comienza?"] });
    expect(evaluarCaso(caso({ missingInformationMenciona: ["fecha", "hora"] }), s).pasa).toBe(true);
  });

  it("falla si pidió datos que sí se le dieron", () => {
    const s = salida({ missingInformation: ["¿Qué día es?"] });
    const r = evaluarCaso(caso({ missingInformationVacio: true }), s);
    expect(r.fallos[0]).toContain("pidió datos que sí se dieron");
  });

  it("falla si no pidió nada y faltaban datos", () => {
    expect(evaluarCaso(caso({ missingInformationVacio: false }), salida()).pasa).toBe(false);
  });
});

describe("«que diga algo, no que lo diga así» — bodyContieneAlguna", () => {
  // Comprueba contenido sin exigir redacción. Reconocer que aún no hay hora de
  // restablecimiento se puede escribir de diez formas, y las diez valen.
  it("basta con que UNA aparezca", () => {
    const s = salida({ body: "Aún no se tiene hora de restablecimiento." });
    expect(evaluarCaso(caso({ bodyContieneAlguna: ["por confirmar", "aún no", "se desconoce"] }), s).pasa).toBe(true);
  });

  it("falla si el cuerpo se lo calla entero", () => {
    const r = evaluarCaso(caso({ bodyContieneAlguna: ["por confirmar", "aún no"] }), salida());
    expect(r.pasa).toBe(false);
    expect(r.fallos[0]).toContain("se lo calla");
  });

  it("no se confunde con bodyContiene, que las exige todas", () => {
    const s = salida({ body: "Aún no se tiene hora." });
    expect(evaluarCaso(caso({ bodyContiene: ["aún no", "por confirmar"] }), s).pasa).toBe(false);
    expect(evaluarCaso(caso({ bodyContieneAlguna: ["aún no", "por confirmar"] }), s).pasa).toBe(true);
  });
});

describe("tolerancia al escribir", () => {
  it("ignora acentos y mayúsculas", () => {
    // «Sábado» y «sabado» son la misma palabra para quien lee el aviso.
    const s = salida({ body: "El SABADO se corta el agua" });
    expect(evaluarCaso(caso({ bodyContiene: ["sábado"] }), s).pasa).toBe(true);
  });

  it("y eso vale también para detectar invenciones", () => {
    const s = salida({ body: "El SABADO se corta el agua" });
    expect(evaluarCaso(caso({ bodyNoContiene: ["sábado"] }), s).pasa).toBe(false);
  });
});

describe("longitud y banderas de calidad", () => {
  it("falla si el borrador se infla", () => {
    const r = evaluarCaso(caso({ bodyMaxLongitud: 50 }), salida());
    expect(r.fallos[0]).toContain("se infló");
  });

  it("falla si no marcó el problema que debía marcar", () => {
    const r = evaluarCaso(caso({ qualityFlagsMenciona: ["contradic"] }), salida());
    expect(r.fallos[0]).toContain("no marcó el problema");
  });

  it("acepta la marca aunque esté redactada de otra forma", () => {
    const s = salida({ qualityFlags: ["hechos_contradictorios"] });
    expect(evaluarCaso(caso({ qualityFlagsMenciona: ["contradic"] }), s).pasa).toBe(true);
  });
});

describe("el resumen", () => {
  const casos: CasoEvaluacion[] = [
    { ...caso(), id: "a", categoria: "agua", dificultad: "rutinario" },
    { ...caso(), id: "b", categoria: "agua", dificultad: "rutinario" },
    { ...caso(), id: "c", categoria: "inyeccion", dificultad: "incomodo" },
    { ...caso(), id: "d", categoria: "inyeccion", dificultad: "incomodo" },
  ];
  const calificaciones = [
    { id: "a", pasa: true, fallos: [], requiereJuicioHumano: false },
    { id: "b", pasa: true, fallos: [], requiereJuicioHumano: false },
    { id: "c", pasa: false, fallos: ["INVENTADO: dice «lunes»"], requiereJuicioHumano: false },
    { id: "d", pasa: false, fallos: ["no obedeció el contrato"], requiereJuicioHumano: false },
  ];

  it("da la tasa global", () => {
    expect(resumirEvaluacion(casos, calificaciones).tasa).toBe(50);
  });

  it("DESGLOSA POR CATEGORÍA — un 50% global esconde un 0% en inyección", () => {
    // Es el error que el plan nombra por su nombre: medir un promedio.
    const r = resumirEvaluacion(casos, calificaciones);
    const inyeccion = r.porCategoria.find((c) => c.categoria === "inyeccion");
    expect(inyeccion?.tasa).toBe(0);
    expect(r.porCategoria.find((c) => c.categoria === "agua")?.tasa).toBe(100);
  });

  it("ordena poniendo primero lo que peor va", () => {
    expect(resumirEvaluacion(casos, calificaciones).porCategoria[0].categoria).toBe("inyeccion");
  });

  it("separa las invenciones del resto de fallos", () => {
    // Son de otra gravedad: un formato mal puesto se corrige, un dato inventado
    // llega al residente.
    const r = resumirEvaluacion(casos, calificaciones);
    expect(r.inventos).toHaveLength(1);
    expect(r.inventos[0].id).toBe("c");
  });

  it("cuenta los que hay que leer a mano", () => {
    const conJuicio = [{ ...calificaciones[0], requiereJuicioHumano: true }, ...calificaciones.slice(1)];
    expect(resumirEvaluacion(casos, conJuicio).porRevisar).toBe(1);
  });
});

describe("las tres versiones de prompt", () => {
  it("cada una declara qué hipótesis pone a prueba", () => {
    // Sin hipótesis, comparar tres textos no enseña nada: gana uno y no sabes
    // por qué ni cómo repetirlo.
    for (const v of PROMPT_VERSIONS) {
      expect(PROMPTS[v].hipotesis.length).toBeGreaterThan(30);
    }
  });

  it("la activa arranca en la mínima: es la que hay que batir", () => {
    expect(PROMPT_ACTIVO).toBe("v1-minima");
  });

  it("v3 contiene a v2: la única diferencia es el ejemplo", () => {
    // Si v3 cambiara además la estructura, no se sabría a qué atribuir la
    // diferencia. Un eje por versión.
    expect(PROMPTS["v3-ejemplo"].instruccion).toContain(PROMPTS["v2-estructura"].instruccion);
    expect(PROMPTS["v3-ejemplo"].instruccion).toContain("Ejemplo");
  });

  it("ninguna repite las reglas duras: esas salen del esquema", () => {
    // Duplicarlas en el prompt las haría divergir del validador con el tiempo.
    for (const v of PROMPT_VERSIONS) {
      expect(PROMPTS[v].instruccion).not.toContain("assumptions debe ir vacío");
    }
  });
});
