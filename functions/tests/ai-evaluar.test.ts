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
    const s = salida({ missingInformation: [{ categoria: "fecha", detalle: "¿A qué hora comienza?" }] });
    expect(evaluarCaso(caso({ missingInformationMenciona: ["fecha", "hora"] }), s).pasa).toBe(true);
  });

  it("busca en el detalle y NUNCA en la categoría", () => {
    // Si buscara en la categoría, la etiqueta «duracion» haría pasar sola una
    // afirmación que espera «duración» — y la afirmación pasaría a medir el
    // nombre que le pusimos nosotros a la etiqueta, no lo que hizo el modelo.
    const s = salida({ missingInformation: [{ categoria: "duracion", detalle: "¿Hasta qué hora?" }] });
    expect(evaluarCaso(caso({ missingInformationMenciona: ["duración"] }), s).pasa).toBe(false);
    expect(evaluarCaso(caso({ missingInformationMenciona: ["hasta"] }), s).pasa).toBe(true);
  });

  it("la categoría no depende del vocabulario, que es para lo que existe", () => {
    // El modelo dijo «ilógico» donde se esperaba «contradicción» y se contó
    // como fallo suyo. Con la categoría eso ya no puede pasar.
    const s = salida({ missingInformation: [{ categoria: "duracion", detalle: "¿Hasta cuándo se alarga?" }] });
    expect(evaluarCaso(caso({ missingInformationCategorias: ["duracion"] }), s).pasa).toBe(true);
    expect(evaluarCaso(caso({ missingInformationCategorias: ["fecha"] }), s).pasa).toBe(false);
  });

  it("basta con que UNA de las categorías esperadas aparezca", () => {
    const s = salida({
      missingInformation: [
        { categoria: "alcance", detalle: "¿Qué torres?" },
        { categoria: "duracion", detalle: "¿Cuánto dura?" },
      ],
    });
    expect(evaluarCaso(caso({ missingInformationCategorias: ["duracion", "accion"] }), s).pasa).toBe(true);
  });

  it("falla si pidió datos que sí se le dieron, y dice cuál", () => {
    const s = salida({ missingInformation: [{ categoria: "fecha", detalle: "¿Qué día es?" }] });
    const r = evaluarCaso(caso({ missingInformationVacio: true }), s);
    expect(r.fallos[0]).toContain("pidió datos que sí se dieron");
    // El mensaje tiene que ser legible: quien lo lee está decidiendo si el
    // fallo es del modelo o del caso, y con un `[object Object]` no puede.
    expect(r.fallos[0]).toContain("¿Qué día es?");
    expect(r.fallos[0]).toContain("fecha");
  });

  it("falla si no pidió nada y faltaban datos", () => {
    expect(evaluarCaso(caso({ missingInformationVacio: false }), salida()).pasa).toBe(false);
  });
});

/**
 * Lo que NO debía pedir — 14 de agosto de 2026.
 *
 * Nace con el contexto del conjunto: sin esta afirmación no hay forma de medir
 * si el modelo dejó de preguntar por las torres en un edificio que no las
 * tiene, que es lo único que ese cambio persigue.
 */
describe("categorías que no debía pedir", () => {
  it("falla si pidió una categoría prohibida, y dice cuál", () => {
    const s = salida({ missingInformation: [{ categoria: "alcance", detalle: "¿A qué torres afecta?" }] });
    const r = evaluarCaso(caso({ missingInformationSinCategorias: ["alcance"] }), s);
    expect(r.pasa).toBe(false);
    expect(r.fallos[0]).toContain("alcance");
    expect(r.fallos[0]).toContain("no aplica");
  });

  it("pasa si pidió otras cosas y no la prohibida", () => {
    const s = salida({ missingInformation: [{ categoria: "duracion", detalle: "¿Cuánto dura?" }] });
    expect(evaluarCaso(caso({ missingInformationSinCategorias: ["alcance"] }), s).pasa).toBe(true);
  });

  it("no pedir NADA nunca incumple esta afirmación", () => {
    // Y por eso sola no basta: un modelo mudo la cumple siempre. Lo que impide
    // que el conjunto premie el silencio son los casos que exigen preguntar,
    // no esta comprobación.
    expect(evaluarCaso(caso({ missingInformationSinCategorias: ["alcance"] }), salida()).pasa).toBe(true);
  });

  it("prohibir la PALABRA no prohíbe la categoría, y esa es la diferencia", () => {
    // La corrección del 14 de agosto de 2026. Preguntar por el alcance en un
    // edificio único es legítimo —tiene pisos y zonas—; preguntar por sus
    // torres no, porque no las tiene. La misma categoría pasa o falla según lo
    // que diga la frase.
    const porTorres = salida({ missingInformation: [{ categoria: "alcance", detalle: "¿A qué torres afecta?" }] });
    const porPisos = salida({
      missingInformation: [{ categoria: "alcance", detalle: "¿Afecta a todo el edificio o a pisos específicos?" }],
    });
    const c = caso({ missingInformationNoMenciona: ["torre", "bloque", "manzana"] });

    expect(evaluarCaso(c, porTorres).pasa).toBe(false);
    expect(evaluarCaso(c, porTorres).fallos[0]).toContain("que este conjunto no tiene");
    expect(evaluarCaso(c, porPisos).pasa).toBe(true);
  });

  it("la palabra se busca en el detalle, tolerando plural y acentos", () => {
    const s = salida({ missingInformation: [{ categoria: "alcance", detalle: "¿A qué TORRES o zonas?" }] });
    expect(evaluarCaso(caso({ missingInformationNoMenciona: ["torre"] }), s).pasa).toBe(false);
  });

  it("nombra TODAS las sobrantes, no solo la primera", () => {
    // Con una sola haría falta otra corrida —y otro gasto— para enterarse de
    // la segunda.
    const s = salida({
      missingInformation: [
        { categoria: "alcance", detalle: "¿Qué torres?" },
        { categoria: "otro", detalle: "¿Quién es el proveedor?" },
      ],
    });
    const r = evaluarCaso(caso({ missingInformationSinCategorias: ["alcance", "otro"] }), s);
    expect(r.fallos[0]).toContain("alcance");
    expect(r.fallos[0]).toContain("otro");
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

  it("la activa es la que ganó la evaluación, no la que parecía mejor", () => {
    // Arrancó en `v1-minima` porque era la que había que batir. El 12 de agosto
    // de 2026 `v2-estructura` la batió en las CINCO corridas reales (80, 80, 86,
    // 88, 95%) y además fue la única estable — v1 y v3 oscilan casi diez puntos
    // entre corridas idénticas.
    //
    // Esta prueba existe para que cambiar el prompt de producción cueste
    // justificarlo: si alguien la toca, tiene que venir con corridas.
    expect(PROMPT_ACTIVO).toBe("v2-estructura");
    expect(PROMPT_VERSIONS).toContain(PROMPT_ACTIVO);
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

describe("ALTERADO — el dato dado que el borrador reformula", () => {
  const reglaCuota = { dado: "por residente", noPor: ["por unidad", "por departamento"] };

  it("caza la sustitución que apareció con un administrador real", () => {
    // Él escribió «$2500 por residente»; el borrador publicó «por unidad».
    const s = salida({ body: "El pago de 2500 pesos por unidad debe realizarse del 15 al 20." });
    const r = evaluarCaso(caso({ preservaDato: [reglaCuota] }), s);
    expect(r.pasa).toBe(false);
    expect(r.fallos[0]).toContain("ALTERADO");
    expect(r.fallos[0]).toContain("por unidad");
    expect(r.fallos[0]).toContain("por residente");
  });

  it("pasa si conserva el dato tal como se lo dieron", () => {
    const s = salida({ body: "El pago de 2500 pesos por residente debe realizarse del 15 al 20." });
    expect(evaluarCaso(caso({ preservaDato: [reglaCuota] }), s).pasa).toBe(true);
  });

  it("no falla si conserva el dato aunque la otra palabra aparezca por otro motivo", () => {
    // «por unidad» puede salir hablando del depósito sin que haya sustitución.
    const s = salida({
      body: "El pago de 2500 pesos por residente. El depósito se concilia por unidad.",
    });
    expect(evaluarCaso(caso({ preservaDato: [reglaCuota] }), s).pasa).toBe(true);
  });

  it("no confunde callarse el dato con alterarlo", () => {
    // Si no aparece ninguna de las dos, el fallo es otro y lo cazan
    // `bodyContiene` o `missingInformation`. Aquí no se inventa un ALTERADO.
    const s = salida({ body: "El pago debe realizarse del 15 al 20." });
    const r = evaluarCaso(caso({ preservaDato: [reglaCuota] }), s);
    expect(r.fallos.filter((f) => f.startsWith("ALTERADO"))).toHaveLength(0);
  });

  it("las alteraciones se cuentan aparte de las invenciones", () => {
    // Son distintas de ver: una añade algo, la otra solo cambia una palabra.
    const c = caso({ preservaDato: [reglaCuota] });
    const s = salida({ body: "El pago de 2500 pesos por unidad." });
    const resumen = resumirEvaluacion([c], [evaluarCaso(c, s)]);
    expect(resumen.alteraciones).toHaveLength(1);
    expect(resumen.inventos).toHaveLength(0);
  });
});
