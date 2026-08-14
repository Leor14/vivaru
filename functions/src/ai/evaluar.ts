/**
 * Calificación de un caso del conjunto de evaluación (Paso 2.4).
 *
 * **Función pura: no llama a nadie, no lee nada.** Recibe el caso y lo que
 * devolvió el modelo, y dice si pasa y por qué no. Así se puede probar entera
 * sin gastar un centavo, que es lo que permite confiar en el número que salga
 * el día que sí se gaste.
 *
 * El vocabulario de afirmaciones está documentado en
 * `datasets/evaluacion/README.md`. Aquí solo se implementa.
 */

export interface CasoEspera {
  assumptionsVacio?: boolean;
  missingInformationVacio?: boolean;
  missingInformationMenciona?: string[];
  /**
   * Comprueba la CATEGORÍA del dato que falta, no cómo se llamó.
   *
   * Es el remedio al defecto que la corrida del 12 de agosto destapó dos veces
   * en un día: `missingInformationMenciona` busca palabras dentro de texto
   * libre, y cuando el modelo dijo «ilógico» donde se esperaba «contradicción»
   * la afirmación midió el diccionario de quien la escribió, no al modelo.
   * Con la categoría eso ya no puede pasar.
   *
   * **Ningún caso lo usa todavía, y es a propósito.** Cambiar la forma de la
   * salida y endurecer las afirmaciones en la misma corrida haría imposible
   * saber a cuál de las dos cosas se debe un número distinto. Primero se
   * comprueba que la forma nueva no mueve el resultado; después se migran las
   * afirmaciones frágiles, una a una.
   */
  missingInformationCategorias?: string[];
  /**
   * Categorías que el modelo **no** debía pedir. Ninguna puede aparecer.
   *
   * Nace el 14 de agosto de 2026 con el contexto del conjunto: sin esto no hay
   * forma de medir lo único que ese cambio persigue —que en un edificio único
   * deje de preguntar por las torres—, porque «pidió de menos» y «pidió lo
   * correcto» se cuentan igual en las demás afirmaciones.
   *
   * **Es una afirmación peligrosa y por eso llega acompañada.** Premiar el
   * silencio es la trampa que la lectura del 2.4 nombró por su nombre: si el
   * conjunto solo castigara preguntar, ganaría el prompt más callado, que es lo
   * contrario del valor del producto. Por cada caso que exige no pedir el
   * alcance hay otro —`unico-zonas-comunes-sin-alcance`— que exige pedirlo en un
   * edificio sin torres. Si el modelo aprende a callarse, ese cae.
   */
  missingInformationSinCategorias?: string[];
  /**
   * Palabras que **ninguna** pregunta puede usar. Busca en `detalle`, nunca en
   * `categoria`, por la misma razón que su gemela positiva.
   *
   * Nace el 14 de agosto de 2026 corrigiendo una afirmación mal escrita el mismo
   * día. `missingInformationSinCategorias: ["alcance"]` prohibía *cualquier*
   * pregunta de alcance en un edificio único, y la decisión que implementaba
   * decía lo contrario: un edificio sin torres sí tiene pisos y zonas, y
   * preguntar por ellos es legítimo —el corpus de Quito no dice «torre» ni una
   * vez y dice «piso» 109—. Lo que no puede hacer es preguntar por lo que no
   * existe.
   *
   * **La distinción que salva esto de ser un listón movido para aprobar:** el
   * criterio se escribió antes de correr —está en la frase que recibe el modelo
   * y en una prueba llamada «NO le prohíbe preguntar por el alcance»— y la
   * afirmación nunca lo reflejó. No se relaja el examen: se corrige una pregunta
   * del examen que medía otra cosa.
   */
  missingInformationNoMenciona?: string[];
  bodyContiene?: string[];
  /**
   * Basta con que UNA aparezca. Sirve para comprobar que el cuerpo **dice algo**
   * —que reconoce que aún no hay hora de restablecimiento, por ejemplo— sin
   * obligarle a decirlo con unas palabras concretas. `bodyContiene` exige todas
   * y para eso no vale: convertiría una comprobación de contenido en una de
   * redacción.
   */
  bodyContieneAlguna?: string[];
  bodyNoContiene?: string[];
  bodyNoCoincideCon?: string[];
  /**
   * Un dato que el administrador dio y que el borrador no puede reformular a
   * otra cosa.
   *
   * **Es la tercera forma de fallar, y no se descubrió pensando.** El 13 de
   * agosto de 2026, en la primera sesión con un administrador real, él escribió
   * «2500 pesos por residente» en un hecho y «por unidad» en otro —contradicción
   * que no notó— y el borrador publicó «por unidad» descartando lo otro, sin
   * avisar. Reproducido 3 de 3 contra el modelo real.
   *
   * No inventó nada —así que INVENTADO no lo caza— y las dos expresiones
   * estaban en la entrada, así que REPETIDO lo habría etiquetado mal. Hacía
   * falta una tercera clase.
   *
   * Lo grave no es que eligiera mal: puede que eligiera bien, porque las cuotas
   * suelen ir por unidad. **Lo grave es que eligiera.** Ante hechos que se
   * contradicen la salida correcta es marcarlo y dejar decidir a la persona; en
   * un cobro esa palabra decide si una unidad con tres residentes debe 2.500 o
   * 7.500. Es el caso más peligroso del conjunto justamente porque parece un
   * acierto.
   */
  preservaDato?: Array<{ dado: string; noPor: string[] }>;
  titleContiene?: string[];
  bodyMaxLongitud?: number;
  qualityFlagsMenciona?: string[];
  notas: string;
}

export interface CasoEvaluacion {
  id: string;
  categoria: string;
  dificultad: "rutinario" | "incomodo";
  requiereJuicioHumano?: boolean;
  decisionDeProducto?: boolean;
  input: unknown;
  /**
   * Cómo es el conjunto en el que ocurre este caso. Si el caso no lo declara,
   * manda el que fije la corrida (`--contexto` del corredor), y eso es lo que
   * permite pasar los mismos 60 casos por «con torres», «sin torres» y «sin
   * decir nada» sin duplicarlos.
   *
   * Los casos que sí lo declaran son los que solo tienen sentido en un tipo de
   * conjunto: un aviso de edificio único no se mide con torres.
   */
  contexto?: { tieneAgrupaciones?: boolean };
  espera: CasoEspera;
}

/**
 * Un dato que falta, con su categoría (contrato v2 de la operación).
 *
 * `detalle` es la misma frase libre en español que antes viajaba suelta, así
 * que las afirmaciones escritas contra la forma anterior siguen midiendo
 * exactamente lo mismo. Esa continuidad es lo que permite comparar la corrida
 * nueva con las cinco anteriores.
 */
export interface DatoFaltante {
  categoria: string;
  detalle: string;
}

/** Lo que devolvió el modelo, ya parseado y validado por el catálogo. */
export interface SalidaBorrador {
  title: string;
  body: string;
  notificationSummary: string;
  missingInformation: DatoFaltante[];
  qualityFlags: string[];
  assumptions: string[];
}

export interface Calificacion {
  id: string;
  pasa: boolean;
  fallos: string[];
  /** El resultado automático no es concluyente: alguien tiene que leerlo. */
  requiereJuicioHumano: boolean;
}

/** Comparación tolerante a mayúsculas y acentos: la gente escribe como escribe. */
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function contiene(texto: string, aguja: string): boolean {
  return normalizar(texto).includes(normalizar(aguja));
}

export function evaluarCaso(caso: CasoEvaluacion, salida: SalidaBorrador): Calificacion {
  const fallos: string[] = [];
  const e = caso.espera;

  // La regla dura de la PRD. Va primero porque es la que invalida la respuesta
  // entera, no solo la califica mal.
  if (e.assumptionsVacio && salida.assumptions.length > 0) {
    fallos.push(`assumptions no está vacío: ${JSON.stringify(salida.assumptions)}`);
  }

  // Lo que pidió el modelo, legible. Se usa en las afirmaciones y en los
  // mensajes de fallo, que es donde alguien tiene que entender qué pasó.
  const pedido = salida.missingInformation.map((d) => `${d.categoria}: ${d.detalle}`).join(" · ");
  const detalles = salida.missingInformation.map((d) => d.detalle).join(" · ");

  if (e.missingInformationVacio === true && salida.missingInformation.length > 0) {
    fallos.push(`pidió datos que sí se dieron: ${pedido}`);
  }

  if (e.missingInformationVacio === false && salida.missingInformation.length === 0) {
    fallos.push("no pidió nada, y faltaban datos");
  }

  // Basta con que UNA de las palabras aparezca en ALGUNO de los ítems: se está
  // comprobando que pidió el dato, no cómo lo redactó.
  //
  // Busca solo en `detalle`, nunca en `categoria`. Si buscara en las dos, la
  // palabra «duracion» de la categoría haría pasar sola una afirmación que
  // espera «duración» — la afirmación dejaría de medir al modelo y pasaría a
  // medir el nombre que le pusimos a la etiqueta.
  if (e.missingInformationMenciona?.length) {
    if (!e.missingInformationMenciona.some((p) => contiene(detalles, p))) {
      fallos.push(
        `no pidió el dato que falta (esperaba alguna de: ${e.missingInformationMenciona.join(", ")}) — pidió: ${pedido || "nada"}`,
      );
    }
  }

  // La versión que no depende del vocabulario. Basta con que UNA categoría de
  // las esperadas aparezca.
  if (e.missingInformationCategorias?.length) {
    const categorias = new Set(salida.missingInformation.map((d) => d.categoria));
    if (!e.missingInformationCategorias.some((c) => categorias.has(c))) {
      fallos.push(
        `no pidió el dato que falta (esperaba categoría: ${e.missingInformationCategorias.join(", ")}) — pidió: ${pedido || "nada"}`,
      );
    }
  }

  // Lo que NO debía pedir. Se nombran todas las sobrantes, no solo la primera:
  // si el modelo pide dos categorías prohibidas, saber solo una obligaría a
  // otra corrida para enterarse de la segunda.
  if (e.missingInformationSinCategorias?.length) {
    const prohibidas = new Set(e.missingInformationSinCategorias);
    const sobran = [...new Set(salida.missingInformation.map((d) => d.categoria))].filter((c) => prohibidas.has(c));
    if (sobran.length > 0) {
      fallos.push(`pidió una categoría que aquí no aplica (${sobran.join(", ")}) — pidió: ${pedido}`);
    }
  }

  // Palabras que ninguna pregunta puede usar. Se nombra la que apareció y en
  // qué pregunta: «preguntó por torres» sin la frase obliga a abrir el JSON.
  for (const aguja of e.missingInformationNoMenciona ?? []) {
    const culpable = salida.missingInformation.find((d) => contiene(d.detalle, aguja));
    if (culpable) {
      fallos.push(`preguntó por «${aguja}», que este conjunto no tiene: ${culpable.categoria}: ${culpable.detalle}`);
    }
  }

  for (const aguja of e.bodyContiene ?? []) {
    if (!contiene(salida.body, aguja)) fallos.push(`el cuerpo no menciona «${aguja}»`);
  }

  if (e.bodyContieneAlguna?.length && !e.bodyContieneAlguna.some((a) => contiene(salida.body, a))) {
    fallos.push(`el cuerpo se lo calla (esperaba alguna de: ${e.bodyContieneAlguna.join(", ")})`);
  }

  for (const aguja of e.titleContiene ?? []) {
    if (!contiene(salida.title, aguja)) fallos.push(`el título no menciona «${aguja}»`);
  }

  // LA comprobación de alucinación. Si aparece algo que no se le dio, se lo
  // inventó — y ese es el fallo que arruina la confianza del administrador.
  // Dos fallos distintos con la misma comprobación, y distinguirlos importa:
  // si el texto prohibido NO estaba en la entrada, el modelo se lo inventó; si
  // SÍ estaba, es que obedeció algo que no debía —una instrucción incrustada,
  // un insulto—. Confundirlos oculta cuál de los dos problemas se tiene.
  const entrada = JSON.stringify(caso.input ?? "");
  const etiquetar = (aguja: string, encontrado: string) =>
    contiene(entrada, aguja)
      ? `REPETIDO: el cuerpo dice «${encontrado}», que venía en la entrada y no debía salir`
      : `INVENTADO: el cuerpo dice «${encontrado}» y nadie se lo dio`;

  for (const aguja of e.bodyNoContiene ?? []) {
    if (contiene(salida.body, aguja)) fallos.push(etiquetar(aguja, aguja));
  }

  for (const patron of e.bodyNoCoincideCon ?? []) {
    let regex: RegExp;
    try {
      regex = new RegExp(patron, "i");
    } catch {
      fallos.push(`la expresión regular «${patron}» del caso no compila`);
      continue;
    }
    const m = regex.exec(salida.body);
    if (m) fallos.push(etiquetar(m[0], m[0]));
  }

  // ALTERADO: el dato dado desapareció Y en su lugar hay otro. Se exigen las
  // dos condiciones a propósito. Si el dato sigue estando, no hubo sustitución
  // aunque también aparezca la otra palabra por otro motivo; y si no aparece
  // ninguna de las dos, el fallo es que se lo calló, que es otra cosa y la
  // cazan `bodyContiene` o `missingInformation`.
  for (const regla of e.preservaDato ?? []) {
    const conserva = contiene(salida.body, regla.dado);
    const sustituto = regla.noPor.find((alternativa) => contiene(salida.body, alternativa));
    if (!conserva && sustituto) {
      fallos.push(`ALTERADO: el cuerpo dice «${sustituto}» donde el administrador escribió «${regla.dado}»`);
    }
  }

  if (e.bodyMaxLongitud !== undefined && salida.body.length > e.bodyMaxLongitud) {
    fallos.push(`el cuerpo se infló: ${salida.body.length} caracteres, máximo ${e.bodyMaxLongitud}`);
  }

  if (e.qualityFlagsMenciona?.length) {
    const todo = salida.qualityFlags.join(" · ");
    if (!e.qualityFlagsMenciona.some((p) => contiene(todo, p))) {
      fallos.push(
        `no marcó el problema (esperaba alguna de: ${e.qualityFlagsMenciona.join(", ")}) — marcó: ${todo || "nada"}`,
      );
    }
  }

  return {
    id: caso.id,
    pasa: fallos.length === 0,
    fallos,
    requiereJuicioHumano: caso.requiereJuicioHumano === true,
  };
}

export interface ResumenEvaluacion {
  total: number;
  pasan: number;
  fallan: number;
  tasa: number;
  /** Pasaron la parte automática pero alguien tiene que leerlos. */
  porRevisar: number;
  /** Desglose por categoría: un 90% global puede esconder un 40% en lo urgente. */
  porCategoria: Array<{ categoria: string; total: number; pasan: number; tasa: number }>;
  porDificultad: Array<{ dificultad: string; total: number; pasan: number; tasa: number }>;
  /** Datos que el modelo se sacó de la manga. Es el fallo más grave. */
  inventos: Array<{ id: string; fallo: string }>;
  /** Texto de la entrada que no debía salir: instrucciones incrustadas, insultos. */
  repeticiones: Array<{ id: string; fallo: string }>;
  /**
   * Datos dados que el borrador reformuló a otra cosa. Se cuenta aparte de las
   * invenciones porque **es más difícil de ver**: no aparece nada nuevo, solo
   * cambia una palabra, y encima suele parecer una corrección acertada.
   */
  alteraciones: Array<{ id: string; fallo: string }>;
}

function agrupar(
  calificaciones: Array<{ clave: string; pasa: boolean }>,
): Array<{ clave: string; total: number; pasan: number; tasa: number }> {
  const mapa = new Map<string, { total: number; pasan: number }>();
  for (const c of calificaciones) {
    const g = mapa.get(c.clave) ?? { total: 0, pasan: 0 };
    g.total += 1;
    if (c.pasa) g.pasan += 1;
    mapa.set(c.clave, g);
  }
  return [...mapa.entries()]
    .map(([clave, g]) => ({ clave, ...g, tasa: Math.round((g.pasan / g.total) * 100) }))
    .sort((a, b) => a.tasa - b.tasa);
}

/**
 * Resume una corrida.
 *
 * **Desglosa por categoría a propósito.** Un 90% global puede esconder un 40%
 * en la categoría que importa, y el plan avisa de ese error por su nombre:
 * medir un promedio.
 */
export function resumirEvaluacion(casos: CasoEvaluacion[], calificaciones: Calificacion[]): ResumenEvaluacion {
  const porId = new Map(calificaciones.map((c) => [c.id, c]));
  const pares = casos
    .map((caso) => ({ caso, cal: porId.get(caso.id) }))
    .filter((p): p is { caso: CasoEvaluacion; cal: Calificacion } => Boolean(p.cal));

  const pasan = pares.filter((p) => p.cal.pasa).length;

  return {
    total: pares.length,
    pasan,
    fallan: pares.length - pasan,
    tasa: pares.length ? Math.round((pasan / pares.length) * 100) : 0,
    porRevisar: pares.filter((p) => p.cal.pasa && p.cal.requiereJuicioHumano).length,
    porCategoria: agrupar(pares.map((p) => ({ clave: p.caso.categoria, pasa: p.cal.pasa }))).map((g) => ({
      categoria: g.clave,
      total: g.total,
      pasan: g.pasan,
      tasa: g.tasa,
    })),
    porDificultad: agrupar(pares.map((p) => ({ clave: p.caso.dificultad, pasa: p.cal.pasa }))).map((g) => ({
      dificultad: g.clave,
      total: g.total,
      pasan: g.pasan,
      tasa: g.tasa,
    })),
    inventos: calificaciones.flatMap((c) =>
      c.fallos.filter((f) => f.startsWith("INVENTADO")).map((fallo) => ({ id: c.id, fallo })),
    ),
    repeticiones: calificaciones.flatMap((c) =>
      c.fallos.filter((f) => f.startsWith("REPETIDO")).map((fallo) => ({ id: c.id, fallo })),
    ),
    alteraciones: calificaciones.flatMap((c) =>
      c.fallos.filter((f) => f.startsWith("ALTERADO")).map((fallo) => ({ id: c.id, fallo })),
    ),
  };
}
