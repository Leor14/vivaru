"use strict";
/**
 * Decisión de autorización de la puerta de entrada de IA — función pura, sin
 * Firestore y sin `firebase-functions` (Paso 1.2 de `docs/hoja-de-ruta-ia.md`).
 *
 * Está separada del callable a propósito, por la misma razón que la precedencia
 * de las banderas: es la parte que puede estar mal de forma peligrosa, y una
 * función pura se prueba entera —incluidos los casos que nadie provoca a mano—
 * sin levantar emuladores ni fabricar sesiones.
 *
 * **La regla que sostiene todo el paso: el conjunto sale de la sesión.** El
 * cliente no lo manda; si lo manda, se rechaza aunque acierte. No es que no le
 * creamos: es que no le preguntamos.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.authorizeGatewayCall = authorizeGatewayCall;
/**
 * Roles que pueden pedir una operación asistida mientras no exista el catálogo
 * de operaciones (Paso 1.3), que es quien fijará los permisos por operación.
 *
 * El superadmin **no** está y no es un olvido: no tiene conjunto en su sesión,
 * así que dejarle invocar exigiría aceptar un `tenantId` del cliente — justo lo
 * que este paso existe para impedir. Para operar sobre un conjunto, se entra
 * al conjunto.
 */
const ROLES_AUTORIZADOS = new Set(["tenant_admin", "admin_tenant"]);
function asString(value) {
    return typeof value === "string" && value.length > 0 ? value : undefined;
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
 *  6. **Puerta encendida** — antes que el rol, porque «está apagado» es una
 *     respuesta más honesta que «no tienes permiso» cuando no lo tiene nadie.
 *  7. **Rol.**
 *  8. **Operación** — última, y hoy siempre falla: el catálogo llega en 1.3.
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
    // El cliente no manda el conjunto. Si lo manda, se rechaza aunque coincida:
    // aceptarlo «porque acertó» es exactamente la costumbre que abre la puerta.
    const data = caller.data;
    if (data && typeof data === "object" && !Array.isArray(data) && "tenantId" in data) {
        return {
            ok: false,
            code: "invalid-argument",
            reason: "tenant_en_la_peticion",
            message: "Esta operación no recibe el conjunto: se toma de tu sesión.",
        };
    }
    const claimTenantId = asString(caller.claims?.tenantId);
    const claimRole = asString(caller.claims?.role);
    if (!claimTenantId || !claimRole) {
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
    if (asString(membership.tenantId) !== claimTenantId) {
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
    // El rol efectivo es el de la membresía, no el del token, por lo mismo.
    const role = asString(membership.role) ?? claimRole;
    if (!ROLES_AUTORIZADOS.has(role)) {
        return {
            ok: false,
            code: "permission-denied",
            reason: "rol_no_autorizado",
            message: "Tu rol no puede usar esta función.",
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
    if (!env.knownOperations.has(operationKey)) {
        return {
            ok: false,
            code: "unimplemented",
            reason: "operacion_desconocida",
            message: "Esa operación no existe.",
        };
    }
    return { ok: true, uid, tenantId: claimTenantId, role, operationKey };
}
