"use strict";
/**
 * ¿El borrador afirma una acción de la administración?
 *
 * **Fuente única del criterio.** Lo usan la comprobación de servidor —que fuerza
 * `needsHumanReview` cuando marca— y el contador de la evaluación offline
 * (`functions/scripts/medir-afirmaciones-pqrs.mjs`, que importa de aquí). Dos
 * copias divergirían, y este repositorio ya tiene un caso vivo de eso: los
 * rótulos de `type` están duplicados en tres pantallas y **ya no coinciden**.
 *
 * ## Qué problema resuelve
 *
 * La v1 de `pqrs-asistir` prohibía PROMETER y CITAR. El modelo cumplía las dos
 * mientras afirmaba acciones propias —«estamos verificando con el equipo de
 * mantenimiento»—, que no es una promesa ni una cita. La v2 lo prohíbe con esas
 * palabras y **baja de 32 a 10 borradores de 152**; pero ocho de los diez que
 * quedan son la frase que la regla cita literalmente. Un prompt compra el grueso
 * y nunca la cola: por eso además se comprueba.
 *
 * ## Lo que esta comprobación NO hace
 *
 * **No convierte el borrador en verdadero y no lo reescribe.** Editar en
 * silencio la salida del modelo sería peor: pasaríamos a ser autores del texto
 * sin que nadie lo haya decidido. Lo que hace es marcar el caso para que lo mire
 * una persona, exactamente igual que el guardrail de `high`.
 *
 * ## Su límite, dicho
 *
 * Sobre el gold set el criterio es exacto porque **los 152 casos tienen historial
 * vacío**: ninguna acción de la administración puede constar, así que toda
 * afirmación está sin sustento por construcción. **Sobre un ticket de producción
 * con `responseHistory` eso ya no vale**: la administración pudo haber hecho lo
 * que el borrador dice. Aquí se marca igual, a propósito — un falso positivo
 * cuesta una revisión humana que en el piloto es obligatoria de todas formas, y
 * un falso negativo cuesta publicar algo falso. Comprobar que la acción afirmada
 * es la misma que consta en el historial es un juicio que una expresión regular
 * no puede hacer, y fingir que sí lo hace sería el quinto instrumento del
 * programa que falla antes que la cosa medida.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CASOS_AUTOPRUEBA = exports.COMPROMISO_FUTURO = exports.AFIRMA_ACCION = void 0;
exports.afirmacionesDeAccion = afirmacionesDeAccion;
exports.afirmaAccion = afirmaAccion;
exports.prometeFuturo = prometeFuturo;
exports.fallosDeAutoprueba = fallosDeAutoprueba;
const PARTICIPIO = "(verificado|revisado|coordinado|contactado|notificado|programado|activado|canalizado|" +
    "gestionado|inspeccionado|escalado|trasladado|remitido|analizado|evaluado|iniciado|" +
    "solicitado|reportado|comunicado)";
const GERUNDIO = "(verificando|revisando|coordinando|contactando|notificando|programando|activando|" +
    "canalizando|gestionando|inspeccionando|escalando|trasladando|remitiendo|analizando|" +
    "evaluando|iniciando|solicitando|reportando|comunicando|trabajando|dando\\s+seguimiento)";
const PRETERITO = "(verificamos|revisamos|coordinamos|contactamos|notificamos|programamos|activamos|" +
    "canalizamos|gestionamos|solicitamos|reportamos|procedimos|nos\\s+comunicamos)";
/**
 * Formas verbales explícitas, NO raíces. Con raíces, «hemos recibido su
 * **report**e» cuenta como «reportar» y el conteo salta de 32 a 109 de 152: el
 * acuse de recibo es un acto de habla sobre el mensaje, siempre verdadero, y no
 * puede entrar.
 */
exports.AFIRMA_ACCION = new RegExp(`\\b(?:hemos|habíamos)\\s+(?:ya\\s+)?${PARTICIPIO}` +
    `|\\b(?:estamos|nos\\s+encontramos)\\s+(?:ya\\s+)?${GERUNDIO}` +
    `|\\bya\\s+${PRETERITO}` +
    `|\\bse\\s+(?:ha|han)\\s+${PARTICIPIO}` +
    `|\\bse\\s+encuentra\\s+en\\s+(?:proceso|revisión)`, "i");
/**
 * Compromiso operativo futuro. **Se mide y no se bloquea**: prometer trabajo
 * futuro es lo que hace una administración, y casi todos son condicionales
 * («una vez contemos con esta información, procederemos a…»). Vive aquí para
 * que el contador pueda vigilar que la regla de arriba no lo dispare sin querer
 * — y de hecho lo desplazó, de 45 a 59 de 152.
 */
exports.COMPROMISO_FUTURO = new RegExp("\\b(procederemos|realizaremos|coordinaremos|programaremos|verificaremos|revisaremos|" +
    "contactaremos|notificaremos|gestionaremos|inspeccionaremos|daremos\\s+seguimiento|" +
    "nos\\s+comunicaremos|se\\s+procederá|se\\s+realizará|se\\s+coordinará|se\\s+programará|" +
    "se\\s+verificará)", "i");
/**
 * TODOS los fragmentos que afirman una acción, con su posición.
 *
 * **Devuelve posiciones y no solo texto** porque la pantalla resalta el trozo
 * dentro del borrador: buscando el texto otra vez podría resaltar una segunda
 * aparición de las mismas palabras, y ya tenemos la posición buena aquí.
 *
 * **Y devuelve todos, no el primero.** En la corrida de la v2 ninguno de los 10
 * marcados tiene dos, pero en la v1 había uno («Estamos verificando» y «se ha
 * gestionado»). Resaltar uno y callar el otro enseñaría que lo no resaltado está
 * comprobado, que es peor que no resaltar nada.
 */
function afirmacionesDeAccion(texto) {
    if (!texto)
        return [];
    // Una expresión NUEVA en cada llamada, no una constante compartida: con `g`,
    // el objeto guarda `lastIndex` entre llamadas y el segundo borrador empezaría
    // a buscar donde acabó el primero. Mismo `source`, así que mismo criterio.
    const barrido = new RegExp(exports.AFIRMA_ACCION.source, "gi");
    const fragmentos = [];
    for (let m = barrido.exec(texto); m !== null; m = barrido.exec(texto)) {
        fragmentos.push({ texto: m[0], desde: m.index, hasta: m.index + m[0].length });
    }
    return fragmentos;
}
/**
 * El fragmento que disparó la marca, o `null`. Devuelve el texto para poder
 * registrarlo.
 *
 * **Delega, no reimplementa.** La cifra del 6,6% sale de aquí a través del
 * contador offline, así que dos caminos distintos para el mismo criterio serían
 * exactamente la divergencia contra la que avisa la cabecera de este archivo. El
 * primer fragmento de la lista es el mismo que devolvía `.match()`.
 */
function afirmaAccion(texto) {
    return afirmacionesDeAccion(texto)[0]?.texto ?? null;
}
function prometeFuturo(texto) {
    if (!texto)
        return null;
    return texto.match(exports.COMPROMISO_FUTURO)?.[0] ?? null;
}
/**
 * Los casos con los que el criterio se prueba a sí mismo.
 *
 * Viven aquí y no en el test para que el contador de la evaluación offline corra
 * **la misma** autoprueba antes de contar. Un contador que no demuestra que
 * atrapa es el patrón que ya falló cuatro veces en este programa: el tamiz que
 * se creía sus cifras, los checks de inyección que premiaban el rechazo, `npm
 * test` corriendo cero tests, y un campo que nadie renderizaba.
 */
exports.CASOS_AUTOPRUEBA = [
    // Positivos de A.
    { espera: "A", texto: "Estamos verificando con el equipo de mantenimiento el avance de las labores." },
    { espera: "A", texto: "Hemos coordinado con el proveedor la visita técnica." },
    { espera: "A", texto: "Ya notificamos a la empresa encargada del ascensor." },
    { espera: "A", texto: "Se ha programado la inspección para la próxima semana." },
    { espera: "A", texto: "Su caso se encuentra en proceso con el área contable." },
    // Negativos de A: acuse de recibo y futuro condicional. Si estos marcan, el
    // criterio se ha vuelto inútil — marcaría casi todos los borradores.
    { espera: "-", texto: "Hemos recibido su reporte sobre el estado del bota aguas." },
    { espera: "-", texto: "Hemos tomado nota de su solicitud y la compartiremos con el consejo." },
    { espera: "-", texto: "Agradecemos su reporte sobre el ruido en el elevador." },
    { espera: "-", texto: "Una vez contemos con esta información, procederemos a revisar su estado de cuenta." },
    { espera: "-", texto: "Le agradecemos nos indique el número de su unidad." },
    // B sin A.
    { espera: "B", texto: "Coordinaremos con el área técnica apenas nos confirme el horario." },
];
/** Devuelve los fallos de la autoprueba. Vacío = el criterio se comporta. */
function fallosDeAutoprueba() {
    const fallos = [];
    for (const { espera, texto } of exports.CASOS_AUTOPRUEBA) {
        const a = afirmaAccion(texto) !== null;
        const b = prometeFuturo(texto) !== null;
        if (espera === "A" && !a)
            fallos.push(`no atrapó A: «${texto}»`);
        if (espera === "-" && a)
            fallos.push(`falso positivo en A: «${texto}»`);
        if (espera === "B" && (!b || a))
            fallos.push(`B mal clasificado: «${texto}»`);
    }
    return fallos;
}
