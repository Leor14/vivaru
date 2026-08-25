import type { OperationDefinition } from "./catalog";

/**
 * Decisión de autorización de la puerta de entrada de IA — función pura, sin
 * Firestore y sin `firebase-functions` (Paso 1.2 de `docs/hoja-de-ruta-ia.md`).
 *
 * Está separada del callable a propósito, por la misma razón que la precedencia
 * de las banderas: es la parte que puede estar mal de forma peligrosa, y una
 * función pura se prueba entera —incluidos los casos que nadie provoca a mano—
 * sin levantar emuladores ni fabricar sesiones.
 *
 * **La regla que sostiene todo el paso: el conjunto se COMPRUEBA.**
 *
 * Decía «sale de la sesión: el cliente no lo manda, y si lo manda se rechaza
 * aunque acierte». Eso valía mientras la sesión tuviera un solo conjunto. Desde
 * `PRD-V-PLAT-002` una persona puede administrar varios y cambiar entre ellos
 * sin volver a autenticarse, y **el claim no puede seguirla**: pasó a significar
 * «el último conjunto conocido» (§7.4). Rechazar el conjunto del cuerpo dejaba
 * a la IA trabajando sobre el conjunto equivocado — denegando lo que sí se
 * administra, y cargando cuota y telemetría a OTRO cliente.
 *
 * Lo que hacía seguro al claim nunca fue venir del token: era estar verificado
 * contra la membresía, que es lo que esta función ya hacía justo después. Así
 * que el conjunto se acepta del cuerpo y **la membresía sigue siendo la única
 * autoridad**. Es exactamente el movimiento que hicieron las seis callables del
 * dinero (§11.2). Sin conjunto en el cuerpo se usa el claim, que es el
 * comportamiento de siempre.
 */

/** Códigos de `HttpsError` que puede devolver la puerta. */
export type GatewayErrorCode =
  | "unauthenticated"
  | "permission-denied"
  | "invalid-argument"
  | "failed-precondition"
  | "unimplemented";

/** Motivo legible en logs y pruebas. El mensaje es lo que ve el usuario. */
export type GatewayDenialReason =
  | "app_check_ausente"
  | "sin_sesion"
  | "claims_incompletos"
  | "sin_membresia"
  | "membresia_inactiva"
  | "membresia_de_otro_conjunto"
  | "rol_no_autorizado"
  | "puerta_apagada"
  | "capacidad_apagada"
  | "operacion_ausente"
  | "operacion_desconocida";

export interface GatewayDenial {
  ok: false;
  code: GatewayErrorCode;
  reason: GatewayDenialReason;
  /** Texto para el usuario. Nunca revela de qué conjunto es el que llama. */
  message: string;
}

export interface GatewayGrant {
  ok: true;
  uid: string;
  /** Resuelto desde la sesión. Único `tenantId` que puede usar el resto del sistema. */
  tenantId: string;
  role: string;
  /** La entrada del catálogo, ya resuelta: nadie vuelve a buscarla por clave. */
  operation: OperationDefinition;
}

export type GatewayDecision = GatewayGrant | GatewayDenial;

/** Lo que la puerta sabe del llamante antes de tocar Firestore. */
export interface GatewayCaller {
  /** `true` si la petición trajo un token de App Check válido. */
  appCheckPresent: boolean;
  uid?: string;
  /** Custom claims del token de sesión. Los pone Vivaru al crear el usuario. */
  claims?: Record<string, unknown>;
  /** Cuerpo crudo de la petición, tal y como lo mandó el cliente. */
  data?: unknown;
}

/** Documento `tenantUsers/{tenantId}_{uid}`, o `null` si no existe. */
export interface GatewayMembership {
  tenantId?: unknown;
  role?: unknown;
  status?: unknown;
}

export interface GatewayEnvironment {
  membership: GatewayMembership | null;
  /** `ai-gateway`: sin esto, la puerta no abre para nadie. */
  gatewayEnabled: boolean;
  /**
   * `operacion-app-check-monitor`: encendida, una llamada sin App Check pasa y
   * se registra. Apagada, se rechaza.
   */
  appCheckMonitor: boolean;
  /** La operación pedida, ya buscada en el catálogo. `null` si no existe. */
  operation: OperationDefinition | null;
  /** Bandera propia de esa operación. Permite apagar una capacidad sin apagar el resto. */
  operationFlagEnabled: boolean;
}

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
function asString(value: unknown): string | undefined {
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
export function conjuntoPedido(caller: GatewayCaller): string | undefined {
  const data = caller.data;
  const delCuerpo =
    data && typeof data === "object" && !Array.isArray(data)
      ? asString((data as { tenantId?: unknown }).tenantId)
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
export function authorizeGatewayCall(caller: GatewayCaller, env: GatewayEnvironment): GatewayDecision {
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

  const operationKey = asString((data as { operationKey?: unknown } | undefined)?.operationKey);
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

/** Igual que un permiso de la puerta, pero sin operación: aquí no se ejecuta nada. */
export type FeedbackDecision = { ok: true; uid: string; tenantId: string; role: string } | GatewayDenial;

export interface FeedbackEnvironment {
  membership: GatewayMembership | null;
  appCheckMonitor: boolean;
  /** Los mismos roles que pueden pedir el borrador. Los pasa quien llama. */
  allowedRoles: readonly string[];
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
export function authorizeFeedbackCall(caller: GatewayCaller, env: FeedbackEnvironment): FeedbackDecision {
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
