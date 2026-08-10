import { describe, expect, it } from "vitest";

import {
  authorizeGatewayCall,
  type GatewayCaller,
  type GatewayEnvironment,
} from "../src/ai/authorize";

/**
 * Puerta de entrada única de IA — Paso 1.2 de docs/hoja-de-ruta-ia.md.
 *
 * El criterio del plan es literalmente una prueba: «una prueba que intenta
 * pasar un `tenantId` ajeno falla». Está aquí, y con ella el resto del orden de
 * comprobaciones, que es lo que decide si un fallo se cuenta como «apagado» o
 * como «no tienes permiso».
 *
 * Son las primeras pruebas de `functions/`: hasta ahora no había banco, y el
 * Paso 1.7 va a pedir bastante más (cuota bajo concurrencia, proveedor caído).
 */

const CONJUNTO = "conjunto-a";
const AJENO = "conjunto-b";
const UID = "admin-1";
const OPERACION = "comunicaciones.redactar";

function caller(overrides: Partial<GatewayCaller> = {}): GatewayCaller {
  return {
    appCheckPresent: true,
    uid: UID,
    claims: { tenantId: CONJUNTO, role: "tenant_admin" },
    data: { operationKey: OPERACION },
    ...overrides,
  };
}

function env(overrides: Partial<GatewayEnvironment> = {}): GatewayEnvironment {
  return {
    membership: { tenantId: CONJUNTO, role: "tenant_admin", status: "active" },
    gatewayEnabled: true,
    appCheckMonitor: true,
    knownOperations: new Set([OPERACION]),
    ...overrides,
  };
}

describe("el conjunto sale de la sesión, nunca de la petición", () => {
  it("rechaza un tenantId ajeno en el cuerpo de la petición", () => {
    // LA prueba del Paso 1.2.
    const decision = authorizeGatewayCall(
      caller({ data: { operationKey: OPERACION, tenantId: AJENO } }),
      env(),
    );

    expect(decision.ok).toBe(false);
    expect(decision).toMatchObject({ code: "invalid-argument", reason: "tenant_en_la_peticion" });
  });

  it("rechaza también un tenantId que COINCIDE con el de la sesión", () => {
    // Aceptarlo «porque acertó» es la costumbre que abre la puerta: el día que
    // una comprobación se olvide, el cliente ya estaba mandando el conjunto.
    const decision = authorizeGatewayCall(
      caller({ data: { operationKey: OPERACION, tenantId: CONJUNTO } }),
      env(),
    );

    expect(decision).toMatchObject({ ok: false, reason: "tenant_en_la_peticion" });
  });

  it("concede usando el conjunto de los claims", () => {
    const decision = authorizeGatewayCall(caller(), env());

    expect(decision).toEqual({
      ok: true,
      uid: UID,
      tenantId: CONJUNTO,
      role: "tenant_admin",
      operationKey: OPERACION,
    });
  });
});

describe("sesión y membresía", () => {
  it("rechaza sin sesión", () => {
    expect(authorizeGatewayCall(caller({ uid: undefined }), env())).toMatchObject({
      code: "unauthenticated",
      reason: "sin_sesion",
    });
  });

  it("rechaza claims sin conjunto — incluido el superadmin, que no tiene", () => {
    expect(
      authorizeGatewayCall(caller({ claims: { role: "superadmin" } }), env()),
    ).toMatchObject({ code: "permission-denied", reason: "claims_incompletos" });
  });

  it("rechaza a quien ya no tiene membresía aunque el token diga que sí", () => {
    // El claim viaja en el token y sobrevive a la baja hasta que caduca.
    expect(authorizeGatewayCall(caller(), env({ membership: null }))).toMatchObject({
      reason: "sin_membresia",
    });
  });

  it("rechaza si la membresía es de otro conjunto", () => {
    expect(
      authorizeGatewayCall(caller(), env({ membership: { tenantId: AJENO, role: "tenant_admin", status: "active" } })),
    ).toMatchObject({ reason: "membresia_de_otro_conjunto" });
  });

  it("rechaza una membresía inactiva", () => {
    expect(
      authorizeGatewayCall(
        caller(),
        env({ membership: { tenantId: CONJUNTO, role: "tenant_admin", status: "inactive" } }),
      ),
    ).toMatchObject({ reason: "membresia_inactiva" });
  });

  it("da por activa una membresía sin campo status", () => {
    expect(
      authorizeGatewayCall(caller(), env({ membership: { tenantId: CONJUNTO, role: "tenant_admin" } })),
    ).toMatchObject({ ok: true });
  });
});

describe("rol", () => {
  it("rechaza a un residente", () => {
    expect(
      authorizeGatewayCall(
        caller({ claims: { tenantId: CONJUNTO, role: "resident" } }),
        env({ membership: { tenantId: CONJUNTO, role: "resident", status: "active" } }),
      ),
    ).toMatchObject({ code: "permission-denied", reason: "rol_no_autorizado" });
  });

  it("acepta el nombre legado admin_tenant", () => {
    expect(
      authorizeGatewayCall(
        caller({ claims: { tenantId: CONJUNTO, role: "admin_tenant" } }),
        env({ membership: { tenantId: CONJUNTO, role: "admin_tenant", status: "active" } }),
      ),
    ).toMatchObject({ ok: true });
  });

  it("el rol que manda es el de la membresía, no el del token", () => {
    // Un token viejo puede decir tenant_admin después de una degradación.
    expect(
      authorizeGatewayCall(
        caller({ claims: { tenantId: CONJUNTO, role: "tenant_admin" } }),
        env({ membership: { tenantId: CONJUNTO, role: "resident", status: "active" } }),
      ),
    ).toMatchObject({ reason: "rol_no_autorizado" });
  });
});

describe("App Check", () => {
  it("en modo monitor deja pasar una llamada sin token", () => {
    expect(
      authorizeGatewayCall(caller({ appCheckPresent: false }), env({ appCheckMonitor: true })),
    ).toMatchObject({ ok: true });
  });

  it("con el modo monitor apagado, rechaza la llamada sin token", () => {
    expect(
      authorizeGatewayCall(caller({ appCheckPresent: false }), env({ appCheckMonitor: false })),
    ).toMatchObject({ code: "permission-denied", reason: "app_check_ausente" });
  });

  it("con el modo monitor apagado y token presente, pasa", () => {
    expect(
      authorizeGatewayCall(caller({ appCheckPresent: true }), env({ appCheckMonitor: false })),
    ).toMatchObject({ ok: true });
  });
});

describe("bandera y operación", () => {
  it("con la puerta apagada no abre para nadie", () => {
    expect(authorizeGatewayCall(caller(), env({ gatewayEnabled: false }))).toMatchObject({
      code: "failed-precondition",
      reason: "puerta_apagada",
    });
  });

  it("exige indicar la operación", () => {
    expect(authorizeGatewayCall(caller({ data: {} }), env())).toMatchObject({
      code: "invalid-argument",
      reason: "operacion_ausente",
    });
  });

  it("responde unimplemented mientras el catálogo esté vacío", () => {
    // Es el estado real al cerrar el Paso 1.2: la puerta abre y no hay nada
    // detrás. El catálogo llega en el 1.3.
    expect(authorizeGatewayCall(caller(), env({ knownOperations: new Set() }))).toMatchObject({
      code: "unimplemented",
      reason: "operacion_desconocida",
    });
  });
});

describe("orden de las comprobaciones", () => {
  it("App Check gana sobre cualquier otro problema", () => {
    expect(
      authorizeGatewayCall(
        { appCheckPresent: false, uid: undefined, claims: {}, data: {} },
        env({ appCheckMonitor: false, membership: null, gatewayEnabled: false }),
      ),
    ).toMatchObject({ reason: "app_check_ausente" });
  });

  it('"está apagado" gana sobre "no tienes permiso"', () => {
    // Cuando no lo tiene nadie, decir que le falta permiso al usuario es
    // mandarlo a pedir un permiso que no existe.
    expect(
      authorizeGatewayCall(
        caller({ claims: { tenantId: CONJUNTO, role: "resident" } }),
        env({ gatewayEnabled: false, membership: { tenantId: CONJUNTO, role: "resident", status: "active" } }),
      ),
    ).toMatchObject({ reason: "puerta_apagada" });
  });

  it("el conjunto en la petición se rechaza antes de mirar la membresía", () => {
    expect(
      authorizeGatewayCall(
        caller({ data: { operationKey: OPERACION, tenantId: AJENO } }),
        env({ membership: null }),
      ),
    ).toMatchObject({ reason: "tenant_en_la_peticion" });
  });
});
