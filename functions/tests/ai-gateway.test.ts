import { describe, expect, it } from "vitest";

import {
  authorizeGatewayCall,
  type GatewayCaller,
  type GatewayEnvironment,
} from "../src/ai/authorize";
import { findOperation } from "../src/ai/catalog";

/**
 * Puerta de entrada única de IA — Pasos 1.2 y 1.3 de docs/hoja-de-ruta-ia.md.
 *
 * El criterio del 1.2 es literalmente una prueba: «una prueba que intenta pasar
 * un `tenantId` ajeno falla». Está aquí, y con ella el resto del orden de
 * comprobaciones, que es lo que decide si un fallo se cuenta como «apagado» o
 * como «no tienes permiso».
 *
 * Los casos usan la operación REAL del catálogo, no una inventada: si mañana
 * cambian sus roles o su bandera, estas pruebas lo acusan.
 */

const CONJUNTO = "conjunto-a";
const AJENO = "conjunto-b";
const UID = "admin-1";

const OPERACION = findOperation("comunicaciones-redactar");
if (!OPERACION) throw new Error("El catálogo perdió comunicaciones-redactar.");

function caller(overrides: Partial<GatewayCaller> = {}): GatewayCaller {
  return {
    appCheckPresent: true,
    uid: UID,
    claims: { tenantId: CONJUNTO, role: "tenant_admin" },
    data: { operationKey: OPERACION!.key },
    ...overrides,
  };
}

function env(overrides: Partial<GatewayEnvironment> = {}): GatewayEnvironment {
  return {
    membership: { tenantId: CONJUNTO, role: "tenant_admin", status: "active" },
    gatewayEnabled: true,
    appCheckMonitor: true,
    operation: OPERACION,
    operationFlagEnabled: true,
    ...overrides,
  };
}

describe("el conjunto sale de la sesión, nunca de la petición", () => {
  it("rechaza un tenantId ajeno en el cuerpo de la petición", () => {
    // LA prueba del Paso 1.2.
    const decision = authorizeGatewayCall(
      caller({ data: { operationKey: OPERACION!.key, tenantId: AJENO } }),
      env(),
    );

    expect(decision.ok).toBe(false);
    expect(decision).toMatchObject({ code: "invalid-argument", reason: "tenant_en_la_peticion" });
  });

  it("rechaza también un tenantId que COINCIDE con el de la sesión", () => {
    // Aceptarlo «porque acertó» es la costumbre que abre la puerta: el día que
    // una comprobación se olvide, el cliente ya estaba mandando el conjunto.
    const decision = authorizeGatewayCall(
      caller({ data: { operationKey: OPERACION!.key, tenantId: CONJUNTO } }),
      env(),
    );

    expect(decision).toMatchObject({ ok: false, reason: "tenant_en_la_peticion" });
  });

  it("concede usando el conjunto de los claims y devuelve la operación resuelta", () => {
    const decision = authorizeGatewayCall(caller(), env());

    expect(decision).toMatchObject({
      ok: true,
      uid: UID,
      tenantId: CONJUNTO,
      role: "tenant_admin",
    });
    expect(decision.ok && decision.operation.key).toBe("comunicaciones-redactar");
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

describe("rol, según lo que declare la operación", () => {
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

  it("los roles salen de la operación: si ella los cambia, la puerta cambia", () => {
    const soloGuardas = { ...OPERACION!, allowedRoles: ["security_guard"] as const };
    expect(authorizeGatewayCall(caller(), env({ operation: soloGuardas }))).toMatchObject({
      reason: "rol_no_autorizado",
    });
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

describe("banderas y operación", () => {
  it("con la puerta apagada no abre para nadie", () => {
    expect(authorizeGatewayCall(caller(), env({ gatewayEnabled: false }))).toMatchObject({
      code: "failed-precondition",
      reason: "puerta_apagada",
    });
  });

  it("con la capacidad apagada se cierra solo esa operación", () => {
    expect(authorizeGatewayCall(caller(), env({ operationFlagEnabled: false }))).toMatchObject({
      code: "failed-precondition",
      reason: "capacidad_apagada",
    });
  });

  it("exige indicar la operación", () => {
    expect(authorizeGatewayCall(caller({ data: {} }), env())).toMatchObject({
      code: "invalid-argument",
      reason: "operacion_ausente",
    });
  });

  it("responde unimplemented para una clave que no está en el catálogo", () => {
    expect(
      authorizeGatewayCall(caller({ data: { operationKey: "inventada" } }), env({ operation: null })),
    ).toMatchObject({ code: "unimplemented", reason: "operacion_desconocida" });
  });

  it("no acepta una operación resuelta que no sea la pedida", () => {
    // Defensa contra un fallo del llamador: si la búsqueda y la clave se
    // desincronizan, la puerta no abre con la operación equivocada.
    expect(
      authorizeGatewayCall(caller({ data: { operationKey: "otra-cosa" } }), env()),
    ).toMatchObject({ reason: "operacion_desconocida" });
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

  it('"la plataforma está apagada" gana sobre "esta capacidad está apagada"', () => {
    expect(
      authorizeGatewayCall(caller(), env({ gatewayEnabled: false, operationFlagEnabled: false })),
    ).toMatchObject({ reason: "puerta_apagada" });
  });

  it('"está apagado" gana sobre "no tienes permiso"', () => {
    // Cuando no lo tiene nadie, decir que le falta permiso al usuario es
    // mandarlo a pedir un permiso que no existe.
    expect(
      authorizeGatewayCall(
        caller({ claims: { tenantId: CONJUNTO, role: "resident" } }),
        env({
          operationFlagEnabled: false,
          membership: { tenantId: CONJUNTO, role: "resident", status: "active" },
        }),
      ),
    ).toMatchObject({ reason: "capacidad_apagada" });
  });

  it("el conjunto en la petición se rechaza antes de mirar la membresía", () => {
    expect(
      authorizeGatewayCall(
        caller({ data: { operationKey: OPERACION!.key, tenantId: AJENO } }),
        env({ membership: null }),
      ),
    ).toMatchObject({ reason: "tenant_en_la_peticion" });
  });
});
