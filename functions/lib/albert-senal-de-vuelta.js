"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DOC_CURSOR = exports.COLECCION_SENALES = exports.PAGINAS_POR_EJECUCION = exports.LIMITE_POR_PAGINA = exports.AMBIENTES_HABILITADOS = exports.WON_SIGNALS_URL = void 0;
exports.validarRespuesta = validarRespuesta;
exports.sondearSenales = sondearSenales;
exports.tokenDeIdentidad = tokenDeIdentidad;
exports.dependenciasReales = dependenciasReales;
exports.ambienteHabilitado = ambienteHabilitado;
const firestore_1 = require("firebase-admin/firestore");
/**
 * La señal de vuelta de Albert CRM: enterarse de que un deal de Vivaru se GANÓ.
 * Mitad de `REVOPS-001C`. Estado vivo del frente: `docs/prd/albert/ESTADO-ALBERT.md`,
 * contrato en `docs/prd/albert/RESPUESTA-A-007-albert-a-vivaru.md`.
 *
 * **Qué hace: SOLO REGISTRA** (decisión de David, 22 sep 2026). Cada deal ganado deja una
 * fila en `albertSenalesGanado/{dealId}` la primera vez que se ve, y nada más: no da de
 * alta un conjunto, no avisa a nadie, no toca el lead. Qué se ACTIVA con un deal ganado
 * está sin decidir, y esta capa existe para que esa decisión caiga sobre filas reales.
 *
 * ## Por qué un sondeo y no `onSnapshot`
 *
 * Los documentos de agosto daban por buena la suscripción en vivo a `tenants/vivaru/deals`.
 * No tiene dónde correr —App Hosting escala a cero y una función no sostiene una
 * suscripción—, y además exigía la contraseña de un usuario de Albert. Albert publicó un
 * endpoint privado, `vivaruWonSignals`, que se llama con el **token de identidad de nuestra
 * cuenta de servicio**: sin contraseña, sin buzón, y revocable desde su lado.
 *
 * ## Lo que hay que saber antes de tocarlo
 *
 * - **«Ganado» es `outcome === "won"`**, que calcula Albert. Nunca el texto de la etapa:
 *   su pipeline es texto libre y el día que alguien la renombre, comparar la palabra deja
 *   de disparar sin dar un error.
 * - **`since` es INCLUSIVO.** El deal del borde de cada página vuelve en la siguiente, y
 *   lo absorbe el registro, que es idempotente por `dealId` (`create`, no `set`).
 * - **El token lleva el `email`** (`format=full`). Sin él, Albert responde 403 aunque la
 *   cuenta sea la buena.
 * - **Solo corre en staging.** En producción la función existe y no llama. Encenderla es
 *   cambiar `AMBIENTES_HABILITADOS`, y lo decide David.
 */
exports.WON_SIGNALS_URL = "https://vivaruwonsignals-winvdvwn6q-uc.a.run.app";
/** Dónde corre de verdad. Añadir `hogaru-1` es decisión de David, no de una sesión. */
exports.AMBIENTES_HABILITADOS = ["vivaru-staging-02"];
/** Tope por página que acepta el endpoint (1–500). */
exports.LIMITE_POR_PAGINA = 100;
/** Tope de páginas por ejecución: con el sondeo cada 10 minutos, 500 señales sobran. */
exports.PAGINAS_POR_EJECUCION = 5;
exports.COLECCION_SENALES = "albertSenalesGanado";
exports.DOC_CURSOR = "integracionAlbert/senalesGanado";
/** Mismo juego de caracteres que acepta `src/lib/albert/crm-ref.ts` para el `dealId`. */
const DEAL_ID = /^[A-Za-z0-9_-]+$/;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
/**
 * Valida la respuesta ENTERA antes de registrar nada. Una señal malformada no se salta:
 * aborta la página sin mover el cursor, para que el fallo se vea en el log y no quede
 * un deal ganado perdido en silencio detrás de un cursor que ya avanzó.
 */
function validarRespuesta(cuerpo) {
    const r = cuerpo;
    if (!r || r.ok !== true)
        throw new Error("respuesta_sin_ok");
    if (r.tenantId !== "vivaru")
        throw new Error(`tenant_inesperado:${String(r.tenantId)}`);
    if (!Array.isArray(r.signals))
        throw new Error("signals_no_es_lista");
    r.signals.forEach((s, i) => {
        if (!s || typeof s.dealId !== "string" || !DEAL_ID.test(s.dealId))
            throw new Error(`senal_${i}_dealId`);
        if (s.outcome !== "won")
            throw new Error(`senal_${i}_outcome`);
        if (typeof s.updatedAt !== "string" || !ISO.test(s.updatedAt))
            throw new Error(`senal_${i}_updatedAt`);
        if (s.leadId !== null && typeof s.leadId !== "string")
            throw new Error(`senal_${i}_leadId`);
    });
    return r;
}
/**
 * Recorre las páginas desde el cursor, registra cada señal una vez y avanza el cursor
 * al `updatedAt` más alto visto. El cursor se guarda SOLO después de registrar la
 * página entera: si algo falla a mitad, la siguiente ejecución repite desde donde
 * estaba y el registro idempotente absorbe lo repetido.
 */
async function sondearSenales(dep) {
    const desde = await dep.leerCursor();
    let cursor = desde;
    const resumen = { paginas: 0, recibidas: 0, nuevas: 0, repetidas: 0, sinAvance: false, desde, hasta: desde };
    for (let pagina = 0; pagina < exports.PAGINAS_POR_EJECUCION; pagina++) {
        const respuesta = validarRespuesta(await dep.pedirPagina(cursor, exports.LIMITE_POR_PAGINA));
        resumen.paginas++;
        resumen.recibidas += respuesta.signals.length;
        let maximo = cursor;
        for (const senal of respuesta.signals) {
            if (await dep.registrar(senal))
                resumen.nuevas++;
            else
                resumen.repetidas++;
            if (maximo === null || senal.updatedAt > maximo)
                maximo = senal.updatedAt;
        }
        const llena = respuesta.signals.length >= exports.LIMITE_POR_PAGINA;
        // Con `since` inclusivo, una página llena de deals con el MISMO `updatedAt` que el
        // cursor no lo mueve: repetir la consulta devolvería la misma página para siempre.
        // Se corta y se avisa en vez de girar en vacío.
        if (llena && maximo === cursor) {
            resumen.sinAvance = true;
            break;
        }
        cursor = maximo;
        resumen.hasta = cursor;
        await dep.guardarCursor(cursor, resumen);
        if (!llena)
            break;
    }
    return resumen;
}
/**
 * Token de identidad de la cuenta de servicio con la que corre la función. Lo usan los
 * dos endpoints de Albert (`vivaruWonSignals` y `vivaruPushLead`), cada uno con su audiencia.
 */
async function tokenDeIdentidad(audiencia) {
    const url = "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity" +
        `?audience=${encodeURIComponent(audiencia)}&format=full`;
    const r = await fetch(url, { headers: { "Metadata-Flavor": "Google" } });
    if (!r.ok)
        throw new Error(`metadata_${r.status}`);
    return r.text();
}
async function pedirPaginaReal(since, limit) {
    const token = await tokenDeIdentidad(exports.WON_SIGNALS_URL);
    const params = new URLSearchParams({ limit: String(limit) });
    if (since)
        params.set("since", since);
    const r = await fetch(`${exports.WON_SIGNALS_URL}?${params}`, { headers: { Authorization: `Bearer ${token}` } });
    // El cuerpo de un error trae solo un código (`invalid_token`, `forbidden`…): se puede
    // registrar. El de un 200 lleva importes y ids y no va al log.
    if (!r.ok)
        throw new Error(`won_signals_${r.status}:${(await r.text()).slice(0, 200)}`);
    return (await r.json());
}
function dependenciasReales(db) {
    const cursorRef = db.doc(exports.DOC_CURSOR);
    return {
        pedirPagina: pedirPaginaReal,
        async leerCursor() {
            const snap = await cursorRef.get();
            const since = snap.get("since");
            return typeof since === "string" ? since : null;
        },
        async registrar(senal) {
            try {
                await db.collection(exports.COLECCION_SENALES).doc(senal.dealId).create({
                    dealId: senal.dealId,
                    leadId: senal.leadId,
                    amount: typeof senal.amount === "number" ? senal.amount : null,
                    closedAt: senal.closedAt ?? null,
                    updatedAtAlbert: senal.updatedAt,
                    crmRef: `albert:deal:vivaru:${senal.dealId}`,
                    recibidaEn: firestore_1.FieldValue.serverTimestamp(),
                });
                return true;
            }
            catch (error) {
                // 6 = ALREADY_EXISTS: ya estaba registrada. Cualquier otro error sube.
                if (error.code === 6)
                    return false;
                throw error;
            }
        },
        async guardarCursor(since, resumen) {
            await cursorRef.set({ since, ultimaEjecucion: firestore_1.FieldValue.serverTimestamp(), ultimoResumen: resumen }, { merge: true });
        },
    };
}
function ambienteHabilitado(proyecto = process.env.GCLOUD_PROJECT ?? "") {
    return exports.AMBIENTES_HABILITADOS.includes(proyecto);
}
