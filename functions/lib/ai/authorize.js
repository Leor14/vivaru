"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.conjuntoPedido = conjuntoPedido;
exports.authorizeGatewayCall = authorizeGatewayCall;
exports.authorizeFeedbackCall = authorizeFeedbackCall;
/**
 * Los roles autorizados los declara cada operación en el catálogo (Paso 1.3).
 * Antes vivían aquí, escritos a mano, que era lo aceptable mientras no existía
 * el catálogo.
 *
 * El superadmin no aparece en ninguno y no es un olvido: no tiene conjunto en
 * su sesión, así que dejarle invocar exigiría aceptar un `tenantId` del cliente
 * — justo lo que la puerta existe para impedir. Para operar sobre un conjunto,
 * se entra al conjunto.
 */
function asString(value) {
    return typeof value === "string" && value.length > 0 ? value : undefined;
}
/**
 * Sobre qué conjunto se pide trabajar: el del cuerpo si viene, y si no el del
 * claim.
 *
 * **Vive aquí y se exporta a propósito.** `gateway.ts` tiene que leer la
 * membresía y las banderas DEL MISMO conjunto que esta decisión va a autorizar;
 * si cada uno lo dedujera por su cuenta, el día que uno cambie se autorizaría
 * un conjunto y se leerían las banderas de otro, sin error y sin síntoma.
 *
 * Devolverlo NO es concederlo: quien llama sigue teniendo que comprobar la
 * membresía en él.
 */
function conjuntoPedido(caller) {
    const data = caller.data;
    const delCuerpo = data && typeof data === "object" && !Array.isArray(data)
        ? asString(data.tenantId)
        : undefined;
    return delCuerpo ?? asString(caller.claims?.tenantId);
}
/**
 * Orden de las comprobaciones, y el porqué de que sea este:
 *
 *  1. **App Check** — antes que nada: ¿esto viene de la aplicación o de un
 *     script con la URL copiada? Es la pregunta más barata y la que protege el
 *     endpoint que cuesta dinero.
 *  2. **Sesión** — ¿hay alguien detrás?
 *  3. **El cliente no manda conjunto** — se rechaza *antes* de resolver nada,
 *     para que el error diga la verdad: el contrato es no mandarlo.
 *  4. **Claims** → conjunto y rol salen de aquí, de ningún otro sitio.
 *  5. **Membresía viva** — los claims pueden quedar viejos; el documento manda.
 *  6. **Puerta encendida** — antes que nada de la operación: si la plataforma
 *     está apagada, da igual qué pidieras.
 *  7. **La operación existe** en el catálogo.
 *  8. **Capacidad encendida** — la bandera propia de esa operación.
 *  9. **Rol**, según lo que declare la operación. Va el último de los
 *     rechazos porque «está apagado» es una respuesta más honesta que «no
 *     tienes permiso» cuando no lo tiene nadie: lo segundo manda a la persona
 *     a pedir un permiso que no existe.
 */
function authorizeGatewayCall(caller, env) {
    if (!caller.appCheckPresent && !env.appCheckMonitor) {
        return {
            ok: false,
            code: "permission-denied",
            reason: "app_check_ausente",
            message: "No pudimos verificar que esta solicitud venga de la aplicación de Vivaru.",
        };
    }
    const uid = asString(caller.uid);
    if (!uid) {
        return {
            ok: false,
            code: "unauthenticated",
            reason: "sin_sesion",
            message: "Debes iniciar sesión para usar esta función.",
        };
    }
    // El conjunto sobre el que se trabaja: el del cuerpo si viene, si no el del
    // claim. Lo que decide no es de dónde sale, es que haya membresía en él — y
    // eso se comprueba tres líneas más abajo, contra el documento que `gateway.ts`
    // leyó de ESTE mismo conjunto.
    const data = caller.data;
    const tenantId = conjuntoPedido(caller);
    const claimRole = asString(caller.claims?.role);
    if (!tenantId || !claimRole) {
        return {
            ok: false,
            code: "permission-denied",
            reason: "claims_incompletos",
            message: "Tu sesión no tiene un conjunto asignado. Vuelve a iniciar sesión.",
        };
    }
    // Los claims viajan en el token y pueden quedar viejos: un usuario dado de
    // baja conserva el suyo hasta que caduque. El documento de membresía es el
    // que manda.
    const membership = env.membership;
    if (!membership) {
        return {
            ok: false,
            code: "permission-denied",
            reason: "sin_membresia",
            message: "Tu usuario ya no pertenece a este conjunto.",
        };
    }
    if (asString(membership.tenantId) !== tenantId) {
        return {
            ok: false,
            code: "permission-denied",
            reason: "membresia_de_otro_conjunto",
            message: "Tu usuario ya no pertenece a este conjunto.",
        };
    }
    if ((asString(membership.status) ?? "active") !== "active") {
        return {
            ok: false,
            code: "permission-denied",
            reason: "membresia_inactiva",
            message: "Tu usuario está inactivo en este conjunto.",
        };
    }
    if (!env.gatewayEnabled) {
        return {
            ok: false,
            code: "failed-precondition",
            reason: "puerta_apagada",
            message: "Las funciones asistidas no están disponibles en este momento.",
        };
    }
    const operationKey = asString(data?.operationKey);
    if (!operationKey) {
        return {
            ok: false,
            code: "invalid-argument",
            reason: "operacion_ausente",
            message: "Falta indicar la operación.",
        };
    }
    const operation = env.operation;
    if (!operation || operation.key !== operationKey) {
        return {
            ok: false,
            code: "unimplemented",
            reason: "operacion_desconocida",
            message: "Esa operación no existe.",
        };
    }
    if (!env.operationFlagEnabled) {
        return {
            ok: false,
            code: "failed-precondition",
            reason: "capacidad_apagada",
            message: "Esta función asistida no está disponible en este momento.",
        };
    }
    // El rol efectivo es el de la membresía, no el del token, por lo mismo de
    // arriba. Los roles permitidos los declara la operación, no esta función.
    const role = asString(membership.role) ?? claimRole;
    if (!operation.allowedRoles.includes(role)) {
        return {
            ok: false,
            code: "permission-denied",
            reason: "rol_no_autorizado",
            message: "Tu rol no puede usar esta función.",
        };
    }
    return { ok: true, uid, tenantId, role, operation };
}
/**
 * Autoriza el registro de feedback del borrador asistido (Paso 2.5).
 *
 * **Mismas reglas de sesión que la puerta, y a propósito NINGUNA bandera.** El
 * feedback describe algo que ya ocurrió: si alguien apaga la capacidad entre
 * que el administrador pide el borrador y que guarda el comunicado, lo que
 * queremos es enterarnos de qué hizo, no perder la medición. Apagar una
 * capacidad tiene que dejar de gastar dinero, no dejar de saber.
 *
 * **No comparte código con `authorizeGatewayCall` por decisión, no por
 * descuido.** Se podría extraer la parte común de sesión y membresía, y eso
 * pondría el camino que decide si se gasta dinero a merced de un cambio hecho
 * pensando en una métrica. Dos funciones que se parecen son más baratas de
 * revisar que una abstracción compartida que se desvía. Las dos están probadas
 * por separado.
 */
function authorizeFeedbackCall(caller, env) {
    if (!caller.appCheckPresent && !env.appCheckMonitor) {
        return {
            ok: false,
            code: "permission-denied",
            reason: "app_check_ausente",
            message: "No pudimos verificar que esta solicitud venga de la aplicación de Vivaru.",
        };
    }
    const uid = asString(caller.uid);
    if (!uid) {
        return { ok: false, code: "unauthenticated", reason: "sin_sesion", message: "Debes iniciar sesión." };
    }
    // Mismo criterio que la puerta principal, y aquí importa más: escribir filas
    // de métricas en el conjunto del vecino contamina la evidencia con la que se
    // decide el producto. Por eso NO basta con aceptar el conjunto del cuerpo —
    // hace falta la membresía, que es lo que se comprueba justo debajo.
    const tenantId = conjuntoPedido(caller);
    const claimRole = asString(caller.claims?.role);
    if (!tenantId || !claimRole) {
        return {
            ok: false,
            code: "permission-denied",
            reason: "claims_incompletos",
            message: "Tu sesión no tiene un conjunto asignado.",
        };
    }
    const membership = env.membership;
    if (!membership) {
        return {
            ok: false,
            code: "permission-denied",
            reason: "sin_membresia",
            message: "Tu usuario ya no pertenece a este conjunto.",
        };
    }
    if (asString(membership.tenantId) !== tenantId) {
        return {
            ok: false,
            code: "permission-denied",
            reason: "membresia_de_otro_conjunto",
            message: "Tu usuario ya no pertenece a este conjunto.",
        };
    }
    if ((asString(membership.status) ?? "active") !== "active") {
        return {
            ok: false,
            code: "permission-denied",
            reason: "membresia_inactiva",
            message: "Tu usuario está inactivo en este conjunto.",
        };
    }
    const role = asString(membership.role) ?? claimRole;
    if (!env.allowedRoles.includes(role)) {
        return {
            ok: false,
            code: "permission-denied",
            reason: "rol_no_autorizado",
            message: "Tu rol no puede usar esta función.",
        };
    }
    return { ok: true, uid, tenantId, role };
}
