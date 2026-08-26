"use strict";
/**
 * El resolvedor ÚNICO de clave de unidad (`PRD-V-FIX-002`, R6).
 *
 * **LA CLAVE DE UNA UNIDAD ES EL ID DE SU DOCUMENTO.** Decisión D1, cerrada por
 * David el 25 de agosto de 2026, y no es una preferencia de estilo:
 *
 *   1. Es la mayoría del dato — 197 de 221 cargos en producción.
 *   2. Es lo que guarda `tenantUsers.unitId`, que es contra lo que compara
 *      `residentOwnUnit` en `firestore.rules`. Elegir el slug obligaría a migrar
 *      la raíz de los permisos.
 *   3. Es lo que escribe el código más reciente (corrida por coeficiente, prorrateo).
 *   4. **No puede colisionar.** El slug se deriva de la etiqueta y dos unidades
 *      pueden compartir etiqueta; el id de documento es único por construcción.
 *
 * **EL CAMPO `unitId` DEL DOCUMENTO DE LA UNIDAD NO ES LA CLAVE.** Es un slug que
 * `updateUnit` deriva del `displayName`, y es exactamente de donde nació la
 * convención minoritaria. Sigue existiendo —retirarlo rompería lectores que la
 * ficha deja para Fase 2— pero **nadie puede usarlo para nombrar una unidad**.
 *
 * **Por qué esto no se resuelve con una expresión regular.** Las dos migraciones
 * anteriores lo intentaron (`/^unit-[a-z0-9]+(-[a-z0-9]+)*$/` en
 * `scripts/migrate-billing-unit-ids.ts`) y no podían acertar: en producción
 * conviven slugs con prefijo (`unit-t1-101`), slugs sin prefijo (`t1-101`,
 * `1014`), ids sembrados que PARECEN slugs (`u-t1-101`, que sí es un id de
 * documento) e ids autogenerados. Un valor solo se puede clasificar
 * **mirándolo contra el catálogo de unidades del conjunto**, nunca por su forma.
 *
 * ⚠️ **ESPEJO de `src/lib/units/clave-de-unidad.ts`.** `src/` no puede importar de
 * `functions/` (rompe el build de App Hosting, ver CLAUDE.md), así que el
 * resolvedor vive dos veces y `tests/clave-de-unidad-guarda.test.ts` compara las
 * dos copias. Si cambias una, cambia la otra. Lo que vive **solo aquí** es el
 * planificador de la migración, que es una operación de plataforma.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.NO_ARCHIVABLES = exports.CAMPO_ARCHIVADO_MOTIVO = exports.CAMPO_ARCHIVADO_EN = exports.CAMPO_MIGRADO_EN = exports.CAMPO_PREVIO = exports.COLECCIONES_CON_CLAVE_DE_UNIDAD = void 0;
exports.claveDeUnidad = claveDeUnidad;
exports.normalizarEtiqueta = normalizarEtiqueta;
exports.construirCatalogo = construirCatalogo;
exports.resolverClaveDeUnidad = resolverClaveDeUnidad;
exports.planificarDocumento = planificarDocumento;
exports.camposDeLaEscritura = camposDeLaEscritura;
exports.estadoDelConjunto = estadoDelConjunto;
exports.clavesDeConsulta = clavesDeConsulta;
exports.estaArchivado = estaArchivado;
exports.llevaDineroVivo = llevaDineroVivo;
/**
 * La clave de una unidad. **Es la única forma legítima de obtenerla**, y existe
 * para que el sitio que la escribe se pueda leer y para que la guarda la pueda
 * buscar: `unitId: claveDeUnidad(unidad)` dice lo que hace, `unitId: u.id` hay
 * que ir a comprobarlo.
 */
function claveDeUnidad(unidad) {
    return unidad.id;
}
/** trim + minúsculas + espacios colapsados. Sin plegar acentos: «Casa Ñ» no es «Casa N». */
function normalizarEtiqueta(valor) {
    return (valor ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}
function construirCatalogo(unidades) {
    const ids = new Set();
    const porCampo = new Map();
    const porEtiqueta = new Map();
    for (const u of unidades) {
        if (!u.id)
            continue;
        ids.add(u.id);
        const campo = (u.slug ?? "").trim();
        // Un campo que ya es el id no aporta una segunda vía: sería resolverse a sí mismo.
        if (campo && campo !== u.id) {
            porCampo.set(campo, [...(porCampo.get(campo) ?? []), u.id]);
        }
        const etiqueta = normalizarEtiqueta(u.displayName);
        if (etiqueta) {
            porEtiqueta.set(etiqueta, [...(porEtiqueta.get(etiqueta) ?? []), u.id]);
        }
    }
    return { ids, porCampo, porEtiqueta, total: ids.size };
}
/**
 * Resuelve un valor cualquiera contra el catálogo de un conjunto.
 *
 * El orden importa y es el de R2:
 *
 *   1. ¿Es un id de documento? → ya está bien, no se toca.
 *   2. ¿Es el campo `unitId` de **exactamente una** unidad? → migrable.
 *   3. ¿Lo es de varias? → **ambiguo**, se lista. El slug puede colisionar (D1·4).
 *   4. ¿La ETIQUETA del documento casa con **exactamente una** unidad? → migrable.
 *   5. ¿Con varias? → **ambiguo** (CF1). ¿Con ninguna? → **huérfano** (CF2).
 *
 * La etiqueta es la del documento que se está migrando (`unitLabel`), no la del
 * valor: un cargo bajo la clave inexistente `unit-t1-101` dice `unitLabel: "T1-101"`,
 * y esa es la que lo salva. **Los documentos que no llevan etiqueta —`people`,
 * `survey_responses`, las firmas— solo tienen las vías 1 a 3**, y por eso sus
 * huérfanos quedan listados: adivinar sin etiqueta no es resolver.
 */
function resolverClaveDeUnidad(valor, catalogo, opciones = {}) {
    const bruto = (valor ?? "").trim();
    if (!bruto)
        return { estado: "vacio" };
    if (catalogo.ids.has(bruto))
        return { estado: "canonica", clave: bruto };
    const porCampo = catalogo.porCampo.get(bruto);
    if (porCampo && porCampo.length === 1) {
        return { estado: "migrable", clave: porCampo[0], anterior: bruto, via: "campo" };
    }
    if (porCampo && porCampo.length > 1) {
        return { estado: "ambiguo", valor: bruto, via: "campo", candidatos: [...porCampo].sort() };
    }
    const etiqueta = normalizarEtiqueta(opciones.etiqueta);
    if (etiqueta) {
        const porEtiqueta = catalogo.porEtiqueta.get(etiqueta);
        if (porEtiqueta && porEtiqueta.length === 1) {
            return { estado: "migrable", clave: porEtiqueta[0], anterior: bruto, via: "etiqueta" };
        }
        if (porEtiqueta && porEtiqueta.length > 1) {
            return { estado: "ambiguo", valor: bruto, via: "etiqueta", candidatos: [...porEtiqueta].sort() };
        }
    }
    return { estado: "huerfano", valor: bruto };
}
/**
 * **Las colecciones que llevan clave de unidad, contadas una a una.**
 *
 * La ficha decía «once» y enumeraba más: son **dieciocho**, y la cuenta importa
 * porque migrar diecisiete deja la que falte fuera del alcance de su dueño. Se
 * sacaron cruzando `firestore.rules` —quince las gobierna `residentOwnUnit`— con
 * las tres de identidad (`people`, `users`, `tenantUsers`). `clearanceCertificates`
 * no estaba en la lista de la ficha y sí en las reglas.
 *
 * `advanceApplications` y `clearanceCertificates` están VACÍAS en producción hoy;
 * se recorren igual, porque el día que dejen de estarlo nadie va a acordarse.
 */
exports.COLECCIONES_CON_CLAVE_DE_UNIDAD = [
    { nombre: "billingStatements", campoClave: "unitId", campoEtiqueta: "unitLabel" },
    { nombre: "advances", campoClave: "unitId", campoEtiqueta: "unitLabel" },
    { nombre: "advanceApplications", campoClave: "unitId", campoEtiqueta: "unitLabel" },
    { nombre: "paymentReceipts", campoClave: "unitId", campoEtiqueta: "unitLabel" },
    { nombre: "paymentVouchers", campoClave: "payerUnitId", campoEtiqueta: "payerUnitLabel" },
    { nombre: "clearanceCertificates", campoClave: "unitId", campoEtiqueta: "unitLabel" },
    { nombre: "reservations", campoClave: "unitId", campoEtiqueta: "unitLabel" },
    { nombre: "packages", campoClave: "unitId", campoEtiqueta: "unitLabel" },
    { nombre: "visitorPasses", campoClave: "unitId", campoEtiqueta: "unitLabel" },
    { nombre: "visitorAuthorizations", campoClave: "unitId" },
    { nombre: "visitorInvitations", campoClave: "unitId" },
    { nombre: "tickets", campoClave: "unitId", campoEtiqueta: "unitLabel" },
    { nombre: "survey_responses", campoClave: "unitId" },
    { nombre: "regulation_signatures", campoClave: "unitId" },
    { nombre: "committee_agreement_signatures", campoClave: "unitId" },
    { nombre: "people", campoClave: "unitId" },
    { nombre: "users", campoClave: "unitId", campoEtiqueta: "unitLabel" },
    // **La última, y a propósito (R8).** Si se migrase primero y el script muriera a
    // media pasada, el residente quedaría apuntando a una clave que casi ningún
    // documento tiene todavía: se quedaría sin ver NADA. Migrando el dato primero,
    // lo que ve solo puede aumentar, y una corrida a medias se retoma (R4).
    { nombre: "tenantUsers", campoClave: "unitId", campoEtiqueta: "unitLabel", raizDelPermiso: true },
];
function texto(valor) {
    return typeof valor === "string" && valor.trim() ? valor.trim() : null;
}
/** Planifica UN documento. Puro: no lee ni escribe nada. */
function planificarDocumento(coleccion, doc, catalogo) {
    const valor = texto(doc.datos[coleccion.campoClave]);
    const etiqueta = coleccion.campoEtiqueta ? texto(doc.datos[coleccion.campoEtiqueta]) : null;
    const r = resolverClaveDeUnidad(valor, catalogo, { etiqueta });
    switch (r.estado) {
        case "vacio":
            return { accion: "sin-clave", coleccion: coleccion.nombre, docId: doc.id };
        case "canonica":
            return { accion: "ya-canonica", coleccion: coleccion.nombre, docId: doc.id, clave: r.clave };
        case "migrable":
            return {
                accion: "escribir",
                coleccion: coleccion.nombre,
                docId: doc.id,
                campoClave: coleccion.campoClave,
                de: r.anterior,
                a: r.clave,
                via: r.via,
                etiqueta,
            };
        case "ambiguo":
            return {
                accion: "listar",
                coleccion: coleccion.nombre,
                docId: doc.id,
                motivo: "ambiguo",
                valor: r.valor,
                etiqueta,
                candidatos: r.candidatos,
            };
        case "huerfano":
            return {
                accion: "listar",
                coleccion: coleccion.nombre,
                docId: doc.id,
                motivo: "huerfano",
                valor: r.valor,
                etiqueta,
                candidatos: [],
            };
    }
}
/**
 * Los campos que la migración añade a cada documento tocado.
 *
 * **`unitIdPrevio` es lo único que hace reversible esto** (R3, §13). Sin él el
 * rollback no existe: el valor viejo y el nuevo son los dos plausibles y no hay
 * forma de reconstruir cuál era. Se llama igual en las dieciocho colecciones
 * aunque `paymentVouchers` guarde la clave en `payerUnitId`, porque cada
 * colección tiene un solo campo de clave y la vuelta atrás sabe cuál es.
 *
 * Los dos son **temporales**: se retiran cuando la migración se dé por cerrada, y
 * esa retirada es una decisión aparte con su propia fecha (§7.2).
 */
exports.CAMPO_PREVIO = "unitIdPrevio";
exports.CAMPO_MIGRADO_EN = "unitIdMigradoEn";
/**
 * Un documento ya migrado antes **no se vuelve a marcar**: `unitIdPrevio` debe
 * conservar el valor ORIGINAL, no el de la última pasada. R4 hace que esto no
 * llegue a pasar —tras migrar, el valor ya es canónico y no se reescribe—, pero
 * si algún día vuelve a moverse, el primer valor es el que permite volver.
 */
function camposDeLaEscritura(accion, datosActuales, ahora) {
    const yaTienePrevio = typeof datosActuales[exports.CAMPO_PREVIO] === "string";
    return {
        [accion.campoClave]: accion.a,
        ...(yaTienePrevio ? {} : { [exports.CAMPO_PREVIO]: accion.de }),
        [exports.CAMPO_MIGRADO_EN]: ahora,
    };
}
function estadoDelConjunto(cuenta) {
    if (cuenta.unidades === 0)
        return "sin-unidades";
    if (cuenta.huerfanos + cuenta.ambiguos > 0)
        return "bloqueado";
    if (cuenta.migrables > 0)
        return "partido";
    return "limpio";
}
/**
 * **Las claves con las que hay que BUSCAR los documentos de una unidad.**
 *
 * Después de `FIX-002` la respuesta es «una»: la clave canónica. Esta función
 * existe por el caso que sobra, y merece explicarse porque es la frontera entre
 * un parche que protege y uno que estorba.
 *
 * El certificado de paz y salvo **afirma** que una unidad no debe nada, así que
 * su error caro va en un solo sentido: certificar a quien debe. Mirar además el
 * **slug propio** de la unidad cuesta una consulta y hace ese fallo imposible
 * aunque quedara un documento sin migrar — y **no puede traer deuda ajena**,
 * porque el slug pertenece a esa unidad.
 *
 * Con una condición, que es toda la diferencia con la vía de la ETIQUETA que
 * `FIX-002` retiró: el slug **no puede ser el id de documento de otra unidad**.
 * Si lo fuera, buscar por él traería los documentos de esa otra —el único cruce
 * posible— y volveríamos a bloquear a quien está al día. La etiqueta no tiene
 * esa salvaguarda: dos unidades pueden llamarse igual y nada lo impide.
 */
function clavesDeConsulta(clave, catalogo, slugDeLaUnidad) {
    const slug = (slugDeLaUnidad ?? "").trim();
    if (!slug || slug === clave || catalogo.ids.has(slug))
        return [clave];
    return [clave, slug];
}
/**
 * **Archivar un huérfano es registrar una decisión, no esconder un documento.**
 *
 * Un huérfano es un documento cuya clave no casa con ninguna unidad y que R2 no
 * puede reasignar sin adivinar. La ficha los deja listados (D2) y dice que
 * decidir qué hacer con ellos es de negocio. Cuando esa decisión es «archivar»,
 * lo único que cambia es que **queda escrita en el propio documento**: el informe
 * deja de contarlo como pendiente y quien lo encuentre dentro de un año sabe por
 * qué sigue ahí.
 *
 * **No se toca nada más.** Ni la clave —que es la única pista de a dónde
 * apuntaba—, ni el estado, ni el documento se mueve o se borra. Los 31 de
 * `tenant-santa-maria` son documentos ya cerrados (el paquete está `delivered`
 * desde marzo, la invitación está cancelada) y **no inflan ningún número**: el
 * resumen de firmas cuenta UNIDADES que firmaron, no firmas, así que una firma
 * huérfana no suma a nadie. Archivarlos no cambia una sola pantalla; cambia que
 * dejan de ser una pregunta abierta.
 */
exports.CAMPO_ARCHIVADO_EN = "unitIdHuerfanoArchivadoEn";
exports.CAMPO_ARCHIVADO_MOTIVO = "unitIdHuerfanoMotivo";
function estaArchivado(datos) {
    return Boolean(datos[exports.CAMPO_ARCHIVADO_EN]);
}
/**
 * **Las colecciones que NO se pueden archivar, y por qué no es una lista de
 * precaución sino de significado.**
 *
 * `tenantUsers` y `users` son la membresía de una persona. Un huérfano ahí no es
 * un documento viejo sin dueño: es **alguien que hoy no ve nada de lo suyo**
 * porque su membresía nombra una unidad que no existe. Archivarlo no cierra la
 * pregunta, la tapa — y deja a esa persona fuera para siempre con la decisión
 * marcada como tomada. Lo que hay que hacer es asignarle una unidad.
 */
exports.NO_ARCHIVABLES = new Set(["tenantUsers", "users"]);
/**
 * **Y no se archiva nada que lleve dinero vivo.** Un cargo con saldo o un
 * anticipo con remanente son plata de alguien: sin dueño hacen daño donde están
 * —es lo que decía D2 de los cinco cargos de santa-maría— y taparlos con una
 * marca no la devuelve. Se listan hasta que alguien decida a quién van.
 */
function llevaDineroVivo(coleccion, datos) {
    if (coleccion === "billingStatements")
        return typeof datos.balance === "number" && datos.balance > 0;
    if (coleccion === "advances")
        return typeof datos.remaining === "number" && datos.remaining > 0;
    return false;
}
