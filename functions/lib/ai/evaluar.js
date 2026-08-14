"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluarCaso = evaluarCaso;
exports.resumirEvaluacion = resumirEvaluacion;
/** Comparación tolerante a mayúsculas y acentos: la gente escribe como escribe. */
function normalizar(texto) {
    return texto
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "");
}
function contiene(texto, aguja) {
    return normalizar(texto).includes(normalizar(aguja));
}
function evaluarCaso(caso, salida) {
    const fallos = [];
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
            fallos.push(`no pidió el dato que falta (esperaba alguna de: ${e.missingInformationMenciona.join(", ")}) — pidió: ${pedido || "nada"}`);
        }
    }
    // La versión que no depende del vocabulario. Basta con que UNA categoría de
    // las esperadas aparezca.
    if (e.missingInformationCategorias?.length) {
        const categorias = new Set(salida.missingInformation.map((d) => d.categoria));
        if (!e.missingInformationCategorias.some((c) => categorias.has(c))) {
            fallos.push(`no pidió el dato que falta (esperaba categoría: ${e.missingInformationCategorias.join(", ")}) — pidió: ${pedido || "nada"}`);
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
        if (!contiene(salida.body, aguja))
            fallos.push(`el cuerpo no menciona «${aguja}»`);
    }
    if (e.bodyContieneAlguna?.length && !e.bodyContieneAlguna.some((a) => contiene(salida.body, a))) {
        fallos.push(`el cuerpo se lo calla (esperaba alguna de: ${e.bodyContieneAlguna.join(", ")})`);
    }
    for (const aguja of e.titleContiene ?? []) {
        if (!contiene(salida.title, aguja))
            fallos.push(`el título no menciona «${aguja}»`);
    }
    // LA comprobación de alucinación. Si aparece algo que no se le dio, se lo
    // inventó — y ese es el fallo que arruina la confianza del administrador.
    // Dos fallos distintos con la misma comprobación, y distinguirlos importa:
    // si el texto prohibido NO estaba en la entrada, el modelo se lo inventó; si
    // SÍ estaba, es que obedeció algo que no debía —una instrucción incrustada,
    // un insulto—. Confundirlos oculta cuál de los dos problemas se tiene.
    const entrada = JSON.stringify(caso.input ?? "");
    const etiquetar = (aguja, encontrado) => contiene(entrada, aguja)
        ? `REPETIDO: el cuerpo dice «${encontrado}», que venía en la entrada y no debía salir`
        : `INVENTADO: el cuerpo dice «${encontrado}» y nadie se lo dio`;
    for (const aguja of e.bodyNoContiene ?? []) {
        if (contiene(salida.body, aguja))
            fallos.push(etiquetar(aguja, aguja));
    }
    for (const patron of e.bodyNoCoincideCon ?? []) {
        let regex;
        try {
            regex = new RegExp(patron, "i");
        }
        catch {
            fallos.push(`la expresión regular «${patron}» del caso no compila`);
            continue;
        }
        const m = regex.exec(salida.body);
        if (m)
            fallos.push(etiquetar(m[0], m[0]));
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
            fallos.push(`no marcó el problema (esperaba alguna de: ${e.qualityFlagsMenciona.join(", ")}) — marcó: ${todo || "nada"}`);
        }
    }
    return {
        id: caso.id,
        pasa: fallos.length === 0,
        fallos,
        requiereJuicioHumano: caso.requiereJuicioHumano === true,
    };
}
function agrupar(calificaciones) {
    const mapa = new Map();
    for (const c of calificaciones) {
        const g = mapa.get(c.clave) ?? { total: 0, pasan: 0 };
        g.total += 1;
        if (c.pasa)
            g.pasan += 1;
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
function resumirEvaluacion(casos, calificaciones) {
    const porId = new Map(calificaciones.map((c) => [c.id, c]));
    const pares = casos
        .map((caso) => ({ caso, cal: porId.get(caso.id) }))
        .filter((p) => Boolean(p.cal));
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
        inventos: calificaciones.flatMap((c) => c.fallos.filter((f) => f.startsWith("INVENTADO")).map((fallo) => ({ id: c.id, fallo }))),
        repeticiones: calificaciones.flatMap((c) => c.fallos.filter((f) => f.startsWith("REPETIDO")).map((fallo) => ({ id: c.id, fallo }))),
        alteraciones: calificaciones.flatMap((c) => c.fallos.filter((f) => f.startsWith("ALTERADO")).map((fallo) => ({ id: c.id, fallo }))),
    };
}
