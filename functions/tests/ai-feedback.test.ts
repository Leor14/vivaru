import { describe, expect, it } from "vitest";

import { authorizeFeedbackCall, type FeedbackEnvironment, type GatewayCaller } from "../src/ai/authorize";
import { feedbackSchema } from "../src/ai/feedback";

/**
 * Registro de feedback del borrador asistido — Paso 2.5.
 *
 * Es un endpoint «de métricas», y esa etiqueta es justo lo que lo hace
 * peligroso: invita a relajar las comprobaciones porque «solo son números». Un
 * cliente que pudiera escribir en el conjunto del vecino contaminaría la
 * evidencia con la que se decide si la funcionalidad sigue o se retira.
 */

const ROLES = ["tenant_admin", "admin_tenant"] as const;

function llamante(over: Partial<GatewayCaller> = {}): GatewayCaller {
  return {
    appCheckPresent: true,
    uid: "u1",
    claims: { tenantId: "t1", role: "tenant_admin" },
    data: { operationKey: "comunicaciones-redactar" },
    ...over,
  };
}

function entorno(over: Partial<FeedbackEnvironment> = {}): FeedbackEnvironment {
  return {
    membership: { tenantId: "t1", role: "tenant_admin", status: "active" },
    appCheckMonitor: true,
    allowedRoles: ROLES,
    ...over,
  };
}

describe("el conjunto sale de la sesión, también en métricas", () => {
  it("acepta una llamada normal y resuelve el conjunto del token", () => {
    const d = authorizeFeedbackCall(llamante(), entorno());
    expect(d.ok).toBe(true);
    if (d.ok) expect(d.tenantId).toBe("t1");
  });

  /**
   * **Cambió el contrato el 25 de agosto de 2026, no la exigencia.** Rechazar
   * el conjunto del cuerpo dejó de valer con el selector de `PLAT-002`: el
   * claim ya no dice dónde se está trabajando. Lo que protege sigue siendo la
   * membresía, y aquí importa más que en ningún sitio — estas filas son la
   * evidencia con la que se decide el producto, y escribirlas en el conjunto
   * del vecino la contamina.
   */
  it("acepta el conjunto del cuerpo, y GANA al del claim", () => {
    // El claim dice otro conjunto a propósito: con claim y cuerpo iguales, esto
    // pasaría en verde con una implementación que ignorase el cuerpo.
    const d = authorizeFeedbackCall(
      llamante({
        claims: { tenantId: "conjunto-viejo", role: "tenant_admin" },
        data: { operationKey: "comunicaciones-redactar", tenantId: "t1" },
      }),
      entorno(),
    );
    expect(d.ok).toBe(true);
    if (d.ok) expect(d.tenantId).toBe("t1");
  });

  it("y NO lo acepta cuando no la hay: escribir en el conjunto del vecino sigue cerrado", () => {
    const d = authorizeFeedbackCall(
      llamante({ data: { operationKey: "comunicaciones-redactar", tenantId: "conjunto-ajeno" } }),
      entorno({ membership: null }),
    );
    expect(d.ok).toBe(false);
    if (!d.ok) expect(d.reason).toBe("sin_membresia");
  });

  it("ni aunque llegue la membresía de OTRO conjunto", () => {
    const d = authorizeFeedbackCall(
      llamante({ data: { operationKey: "comunicaciones-redactar", tenantId: "conjunto-ajeno" } }),
      entorno(),
    );
    expect(d.ok).toBe(false);
    if (!d.ok) expect(d.reason).toBe("membresia_de_otro_conjunto");
  });

  it("manda la membresía, no el token", () => {
    // Un token que sobrevivió a una baja no puede seguir escribiendo filas.
    const d = authorizeFeedbackCall(llamante(), entorno({ membership: null }));
    expect(d.ok).toBe(false);
    if (!d.ok) expect(d.reason).toBe("sin_membresia");
  });

  it("rechaza una membresía de otro conjunto", () => {
    const d = authorizeFeedbackCall(llamante(), entorno({ membership: { tenantId: "t2", role: "tenant_admin" } }));
    expect(d.ok).toBe(false);
    if (!d.ok) expect(d.reason).toBe("membresia_de_otro_conjunto");
  });

  it("rechaza una membresía inactiva", () => {
    const d = authorizeFeedbackCall(
      llamante(),
      entorno({ membership: { tenantId: "t1", role: "tenant_admin", status: "inactive" } }),
    );
    expect(d.ok).toBe(false);
    if (!d.ok) expect(d.reason).toBe("membresia_inactiva");
  });

  it("rechaza un rol que no puede pedir el borrador", () => {
    const d = authorizeFeedbackCall(
      llamante({ claims: { tenantId: "t1", role: "resident" } }),
      entorno({ membership: { tenantId: "t1", role: "resident", status: "active" } }),
    );
    expect(d.ok).toBe(false);
    if (!d.ok) expect(d.reason).toBe("rol_no_autorizado");
  });

  it("sin sesión no pasa", () => {
    const d = authorizeFeedbackCall(llamante({ uid: undefined }), entorno());
    expect(d.ok).toBe(false);
    if (!d.ok) expect(d.code).toBe("unauthenticated");
  });
});

describe("las banderas NO cierran esta puerta", () => {
  it("registra aunque la capacidad se haya apagado entre medias", () => {
    // El feedback describe algo que YA ocurrió. Apagar una capacidad tiene que
    // dejar de gastar dinero, no dejar de saber qué pasó. Por eso este entorno
    // ni siquiera tiene campos de bandera: no hay dónde equivocarse.
    const d = authorizeFeedbackCall(llamante(), entorno());
    expect(d.ok).toBe(true);
  });
});

describe("el esquema no tiene dónde meter contenido", () => {
  const valido = {
    sesionId: "3f2a9c1e-7b4d-4a1f-9e2c-8d5b6a0f1c33",
    operationKey: "comunicaciones-redactar" as const,
    propuestas: 1,
    aplicada: true,
    deshecha: false,
    guardada: true,
    mostrados: ["duracion", "fecha"],
    descartados: ["fecha"],
    respondidos: ["duracion"],
    distanciaEdicion: 12,
  };

  it("acepta una carga bien formada", () => {
    expect(feedbackSchema.safeParse(valido).success).toBe(true);
  });

  it("RECHAZA una clave de más — por ahí entraría el texto", () => {
    const conTexto = { ...valido, detalle: "¿Hasta qué hora cierra la alberca de la torre 3?" };
    expect(feedbackSchema.safeParse(conTexto).success).toBe(false);
  });

  it("RECHAZA una categoría inventada", () => {
    // Sin el enum, `descartados` sería un campo de texto libre con otro nombre.
    expect(feedbackSchema.safeParse({ ...valido, descartados: ["la hora de cierre"] }).success).toBe(false);
  });

  it("RECHAZA listas absurdamente largas", () => {
    const largo = Array.from({ length: 41 }, () => "fecha");
    expect(feedbackSchema.safeParse({ ...valido, descartados: largo }).success).toBe(false);
  });

  it("RECHAZA una edición medida sin haber guardado", () => {
    expect(feedbackSchema.safeParse({ ...valido, guardada: false, distanciaEdicion: 12 }).success).toBe(false);
  });

  it("RECHAZA un guardado sin medir la edición", () => {
    expect(feedbackSchema.safeParse({ ...valido, guardada: true, distanciaEdicion: null }).success).toBe(false);
  });

  it("RECHAZA deshacer algo que no se aplicó", () => {
    expect(feedbackSchema.safeParse({ ...valido, aplicada: false, deshecha: true }).success).toBe(false);
  });

  it("RECHAZA cero propuestas — no habría nada que contar", () => {
    expect(feedbackSchema.safeParse({ ...valido, propuestas: 0 }).success).toBe(false);
  });

  it("RECHAZA una sesión sin identificador — sin él, cada envío duplicaría la fila", () => {
    expect(feedbackSchema.safeParse({ ...valido, sesionId: "" }).success).toBe(false);
    const { sesionId: _omitido, ...sinSesion } = valido;
    expect(feedbackSchema.safeParse(sinSesion).success).toBe(false);
  });

  it("RECHAZA un identificador que pueda torcer la ruta del documento", () => {
    // El id compone la ruta en Firestore: una barra lo convertiría en
    // subcolección y un `..` en algo peor.
    expect(feedbackSchema.safeParse({ ...valido, sesionId: "abc/../otro" }).success).toBe(false);
    expect(feedbackSchema.safeParse({ ...valido, sesionId: "conjunto/ajeno" }).success).toBe(false);
  });

  it("RECHAZA un identificador absurdamente largo", () => {
    // El id compone la ruta del documento en Firestore. Un valor libre de
    // longitud arbitraria es una invitación a fabricar rutas raras.
    expect(feedbackSchema.safeParse({ ...valido, sesionId: "x".repeat(65) }).success).toBe(false);
  });

  it("acepta no haber guardado, que es un resultado válido y frecuente", () => {
    const sinGuardar = { ...valido, aplicada: false, deshecha: false, guardada: false, distanciaEdicion: null };
    expect(feedbackSchema.safeParse(sinGuardar).success).toBe(true);
  });
});

/**
 * Rama de PQRS — Fase 3 de `PRD-VAI-FEAT-002`.
 *
 * Lo que se prueba aquí, más que la forma, es que el par sugerida/guardada
 * quepa entero: es la comparación con la que se cobran las dos puertas de G7 y
 * la única que el gold set no puede dar.
 */
describe("el feedback de PQRS mide la corrección, no solo el uso", () => {
  const valido = {
    sesionId: "9c1e3f2a-4d7b-4a1f-9e2c-8d5b6a0f1c33",
    operationKey: "pqrs-asistir" as const,
    lecturas: 1,
    sugerida: { category: "maintenance" as const, type: "claim" as const, priority: "high" as const },
    clasificacionAplicada: true,
    guardada: { category: "pqrs" as const, type: "claim" as const, priority: "medium" as const },
    borradorCopiado: true,
    respuestaGuardada: true,
    distanciaEdicion: 34,
  };

  it("acepta una carga bien formada", () => {
    expect(feedbackSchema.safeParse(valido).success).toBe(true);
  });

  it("guarda a la vez lo sugerido y lo que quedó escrito", () => {
    // Es LA fila que necesita G7: sin las dos mitades juntas, «¿cuántas veces
    // corrigió la categoría?» vuelve a contestarse de memoria.
    const parsed = feedbackSchema.safeParse(valido);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data).toMatchObject({
      sugerida: { category: "maintenance" },
      guardada: { category: "pqrs" },
    });
  });

  it("RECHAZA una clave de más — por ahí entraría el texto del ticket", () => {
    const conTexto = { ...valido, mensaje: "Se está inundando el sótano de la torre 2" };
    expect(feedbackSchema.safeParse(conTexto).success).toBe(false);
  });

  it("RECHAZA valores fuera del catálogo", () => {
    expect(
      feedbackSchema.safeParse({ ...valido, guardada: { ...valido.guardada, category: "otra cosa" } }).success,
    ).toBe(false);
    expect(
      feedbackSchema.safeParse({ ...valido, sugerida: { ...valido.sugerida, priority: "urgentísima" } }).success,
    ).toBe(false);
  });

  it("acepta no haber guardado nada: mirar y seguir a mano es un resultado", () => {
    const soloMiro = {
      ...valido,
      clasificacionAplicada: false,
      guardada: null,
      borradorCopiado: false,
      respuestaGuardada: false,
      distanciaEdicion: null,
    };
    expect(feedbackSchema.safeParse(soloMiro).success).toBe(true);
  });

  it("RECHAZA una distancia de edición sin haber copiado el borrador", () => {
    // Mediría cuánto se parece a la propuesta un texto escrito a mano, que es
    // justo lo contrario de lo que el número dice.
    expect(feedbackSchema.safeParse({ ...valido, borradorCopiado: false }).success).toBe(false);
  });

  it("RECHAZA haber copiado y guardado sin medir la edición", () => {
    expect(feedbackSchema.safeParse({ ...valido, distanciaEdicion: null }).success).toBe(false);
  });

  it("RECHAZA clasificación aplicada en buzón simple", () => {
    // Ahí el modelo devuelve nulls por contrato y la pantalla no pinta ni el
    // editor ni el botón: si llega, el cliente está roto.
    const buzon = {
      ...valido,
      sugerida: { category: null, type: null, priority: "medium" as const },
      guardada: null,
      clasificacionAplicada: true,
    };
    expect(feedbackSchema.safeParse(buzon).success).toBe(false);
  });

  it("acepta buzón simple sin clasificación, que es su forma correcta", () => {
    const buzon = {
      ...valido,
      sugerida: { category: null, type: null, priority: "medium" as const },
      clasificacionAplicada: false,
      guardada: null,
    };
    expect(feedbackSchema.safeParse(buzon).success).toBe(true);
  });

  it("RECHAZA cero lecturas — no habría nada que contar", () => {
    expect(feedbackSchema.safeParse({ ...valido, lecturas: 0 }).success).toBe(false);
  });

  it("RECHAZA un identificador que pueda torcer la ruta del documento", () => {
    // Mismo riesgo que en comunicaciones: el id compone la ruta en Firestore.
    expect(feedbackSchema.safeParse({ ...valido, sesionId: "abc/../otro" }).success).toBe(false);
  });

  it("no deja pasar una carga de comunicaciones disfrazada de PQRS", () => {
    // La unión tiene que separar las dos ramas de verdad, no aceptar la mezcla.
    const mezcla = { ...valido, propuestas: 1, aplicada: true, deshecha: false };
    expect(feedbackSchema.safeParse(mezcla).success).toBe(false);
  });
});
