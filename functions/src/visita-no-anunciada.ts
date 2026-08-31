import { Timestamp, getFirestore } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";

import { estadoDeAutorizacion, estaResuelta, type EstadoDeAutorizacion } from "./autorizacion-de-visita";
import { esAdminActivoDelConjunto, esMiembroDelConjunto } from "./tenant-membership";
import { assertTenantOperable } from "./tenant-status";

/**
 * `PRD-V-FLOW-005` — autorizar la visita que llega sin avisar, del lado del servidor.
 *
 * **Por qué callable y no escritura del cliente. Cumple CINCO criterios a la vez**, y con uno
 * bastaba: hay lógica de negocio (la caducidad y la carrera entre dos residentes), permisos
 * cruzados, avisos, escritura en varias colecciones, y **datos que el cliente no debe poder
 * falsificar** — quién autorizó y por qué medio.
 *
 * **Y hay una razón dura, medida en las reglas de hoy:** el `update` de `visitorPasses` deja al
 * residente tocar **solo lo que él creó** (`resource.data.createdBy == request.auth.uid`). Un pase
 * creado por portería lleva el uid del guardia, así que **con las reglas actuales el residente no
 * puede autorizarlo**. Abrir esa rama para que el cliente escriba el estado sería exactamente el
 * agujero que esta ficha viene a evitar.
 */

const db = () => getFirestore();
const texto = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export type MedioDeAutorizacion = "app" | "llamada";

export type ResolverAutorizacionInput = {
  tenantId: string;
  visitorPassId: string;
  decision: "autorizar" | "rechazar";
  /** Obligatorio al autorizar (`R5`). El residente resuelve por `app`; el guardia, por `llamada`. */
  medio?: MedioDeAutorizacion;
};

export type ResolverAutorizacionResultado = {
  ok: true;
  /** `false` cuando alguien se adelantó: no es un error, es información (`R6`, `CA4`). */
  aplicada: boolean;
  estado: EstadoDeAutorizacion;
  resueltaPor: string;
};

type PaseDoc = {
  tenantId?: string;
  unitId?: string;
  unitLabel?: string;
  visitorName?: string;
  status?: string;
  origen?: string;
  authorizationStatus?: string;
  authorizationRequestedAt?: Timestamp;
  authorizedByName?: string;
  authorizationMedium?: string;
};

/** Milisegundos de un `Timestamp` de Firestore, o `null`. La función pura no sabe de Firestore. */
function comoMs(valor: unknown): number | null {
  const t = valor as { toMillis?: () => number } | undefined;
  return typeof t?.toMillis === "function" ? t.toMillis() : null;
}

/**
 * Quién puede resolver, y con qué medio.
 *
 * **Las dos vías no son el mismo permiso con distinto nombre.** El residente de la unidad resuelve
 * por `app` porque le llegó el aviso; el guardia resuelve por `llamada` porque habló por fuera de
 * la plataforma y lo declara. **El administrador NO resuelve** (`CF5`): si pudiera autorizar en
 * nombre de un residente, la constancia dejaría de significar algo — y significar algo es todo lo
 * que esta ficha aporta.
 */
async function quienResuelve(
  tenantId: string,
  unitId: string,
  uid: string,
  rol: unknown,
): Promise<{ via: "residente" | "guardia"; medio: MedioDeAutorizacion }> {
  const r = typeof rol === "string" ? rol : "";
  if (r === "security_guard" || r === "security") {
    if (!(await esMiembroDelConjunto(tenantId, uid))) {
      throw new HttpsError("permission-denied", "No perteneces a este conjunto.");
    }
    return { via: "guardia", medio: "llamada" };
  }
  if (r === "resident") {
    const membresia = await db().collection("tenantUsers").doc(`${tenantId}_${uid}`).get();
    const datos = membresia.data() as { unitId?: string; status?: string } | undefined;
    // `CF1`: un residente resuelve la de SU unidad y ninguna otra.
    if (!membresia.exists || datos?.status !== "active" || texto(datos?.unitId) !== unitId) {
      throw new HttpsError("permission-denied", "Esta visita no es de tu unidad.");
    }
    return { via: "residente", medio: "app" };
  }
  // `CF5`: el administrador y el superadministrador ven y auditan; no autorizan.
  if (r === "tenant_admin" || r === "superadmin" || (await esAdminActivoDelConjunto(tenantId, uid))) {
    throw new HttpsError(
      "permission-denied",
      "La autorización la da el residente de la unidad o la portería declarando el medio. " +
        "La administración la consulta, no la firma.",
    );
  }
  throw new HttpsError("permission-denied", "No tienes permiso para resolver esta visita.");
}

/**
 * Resuelve una petición de autorización — la usan el residente y el guardia, con ramas distintas.
 *
 * **Va en transacción por `CA4`**, que es una carrera de verdad: dos residentes de la misma unidad
 * pueden pulsar a la vez. El segundo **no recibe un error**: recibe quién la resolvió, porque
 * «alguien se te adelantó» es información y «algo falló» es mentira.
 */
export async function resolverAutorizacionDeVisita(
  input: ResolverAutorizacionInput,
  actor: { uid?: string; role?: unknown },
): Promise<ResolverAutorizacionResultado> {
  const tenantId = texto(input?.tenantId);
  const visitorPassId = texto(input?.visitorPassId);
  const decision = input?.decision;

  if (!tenantId || !visitorPassId) {
    throw new HttpsError("invalid-argument", "Falta el conjunto o la visita.");
  }
  if (decision !== "autorizar" && decision !== "rechazar") {
    throw new HttpsError("invalid-argument", "La decisión solo puede ser autorizar o rechazar.");
  }
  if (!actor.uid) throw new HttpsError("unauthenticated", "Debes iniciar sesión.");

  const firestore = db();
  const ref = firestore.collection("visitorPasses").doc(visitorPassId);
  const previo = await ref.get();
  const datosPrevios = previo.data() as PaseDoc | undefined;
  if (!previo.exists || texto(datosPrevios?.tenantId) !== tenantId) {
    throw new HttpsError("not-found", "Esa visita no existe en este conjunto.");
  }
  if (!datosPrevios?.authorizationStatus) {
    throw new HttpsError("failed-precondition", "Esta visita no es de las que se autorizan en portería.");
  }

  const { via, medio } = await quienResuelve(tenantId, texto(datosPrevios.unitId), actor.uid, actor.role);
  // `CF6`: el estado del conjunto va DESPUÉS del rol, para no filtrarle a un extraño que el
  // conjunto está suspendido. Y se comprueba aquí y no solo en las reglas, porque el Admin SDK
  // no las evalúa.
  await assertTenantOperable(tenantId);

  // `R5` y `CF3`. El medio no lo elige el cliente: lo determina quién resuelve. Se acepta el que
  // manda solo para poder rechazarlo si miente — un cliente que dice «app» siendo el guardia
  // estaría fabricando la constancia.
  const medioPedido = input?.medio;
  if (decision === "autorizar" && medioPedido && medioPedido !== medio) {
    throw new HttpsError(
      "invalid-argument",
      `El medio de esta autorización es «${medio}» y no se puede declarar otro.`,
    );
  }

  const nombre = await nombreDelActor(tenantId, actor.uid);

  return firestore.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const datos = snap.data() as PaseDoc;
    const ahora = Timestamp.now();
    const estadoActual = estadoDeAutorizacion(
      datos.authorizationStatus,
      comoMs(datos.authorizationRequestedAt),
      ahora.toMillis(),
    );

    // `R6` y `CA4`/`CF7`: lo ya resuelto no se pisa, y se dice QUIÉN lo resolvió.
    if (estaResuelta(estadoActual)) {
      return {
        ok: true as const,
        aplicada: false,
        estado: estadoActual as EstadoDeAutorizacion,
        resueltaPor: texto(datos.authorizedByName) || "otra persona",
      };
    }

    // `CA6`: una expirada NO está resuelta, y **solo la rescata la vía B**. Si el residente
    // pudiera resolverla pasados los cinco minutos, el guardia ya habría decidido por otra vía
    // y tendríamos dos verdades sobre la misma visita.
    if (estadoActual === "expirada" && via === "residente") {
      throw new HttpsError(
        "failed-precondition",
        "Pasaron los cinco minutos y la portería ya resolvió esta visita por otra vía.",
      );
    }

    const nuevo: EstadoDeAutorizacion = decision === "autorizar" ? "autorizada" : "rechazada";
    tx.update(ref, {
      authorizationStatus: nuevo,
      authorizedBy: actor.uid,
      authorizedByName: nombre,
      // `R5`: siempre, sin excepción. Sin esto las dos vías serían indistinguibles y la
      // constancia no valdría para nada — que es justo lo que la ficha viene a arreglar.
      authorizationMedium: medio,
      authorizationResolvedAt: ahora,
      updatedAt: ahora,
      updatedBy: actor.uid,
    });

    return { ok: true as const, aplicada: true, estado: nuevo, resueltaPor: nombre };
  });
}

async function nombreDelActor(tenantId: string, uid: string): Promise<string> {
  const membresia = await db().collection("tenantUsers").doc(`${tenantId}_${uid}`).get();
  const deMembresia = texto((membresia.data() as { fullName?: string } | undefined)?.fullName);
  if (deMembresia) return deMembresia;
  const usuario = await db().collection("users").doc(uid).get();
  return texto((usuario.data() as { fullName?: string } | undefined)?.fullName) || "Alguien de la unidad";
}

/** Los residentes activos de una unidad. `R7`: sin ninguno, la vía A no se puede ofrecer. */
export async function residentesActivosDeLaUnidad(tenantId: string, unitId: string): Promise<string[]> {
  const snap = await db()
    .collection("tenantUsers")
    .where("tenantId", "==", tenantId)
    .where("role", "==", "resident")
    .where("unitId", "==", unitId)
    .get();
  return snap.docs
    .map((d) => d.data() as { uid?: string; status?: string })
    .filter((d) => !d.status || d.status === "active")
    .map((d) => texto(d.uid))
    .filter(Boolean);
}

/** Los campos de autorización con los que nace el pase, según la vía. */
export function camposDeAutorizacionAlCrear(
  via: "app" | "llamada",
  ahora: Timestamp,
  uid: string,
  nombre: string,
): Record<string, unknown> {
  if (via === "app") {
    return {
      origen: "porteria",
      authorizationStatus: "pendiente",
      authorizationRequestedAt: ahora,
    };
  }
  return {
    origen: "porteria",
    // `R4`: la vía B no espera nada y está disponible desde el primer momento.
    authorizationStatus: "autorizada",
    authorizedBy: uid,
    authorizedByName: nombre,
    authorizationMedium: "llamada",
    authorizationResolvedAt: ahora,
  };
}

export type RegistrarVisitaInput = {
  tenantId: string;
  unitId: string;
  unitLabel: string;
  visitorName: string;
  documentNumber: string;
  hostResidentName?: string;
  via?: "app" | "llamada";
  date?: string;
  scheduledTime?: string;
};

export type RegistrarVisitaResultado = {
  visitorPassId: string;
  authorizationStatus: "pendiente" | "autorizada";
  /** A quién hay que avisar. Vacío = a nadie, y con la vía A eso no puede pasar (`R7`). */
  residentes: string[];
};

/**
 * Captura una visita que llegó sin avisar. **La escritura y la decisión viven aquí; el aviso lo
 * manda quien llama**, porque el catálogo de avisos y su entrega viven en `index.ts` y traérselos
 * aquí arrastraría medio fichero. El resultado dice a quién hay que avisar.
 */
export async function registrarVisitaNoAnunciada(
  input: RegistrarVisitaInput,
  actor: { uid: string; rol: unknown; nombre: string },
): Promise<RegistrarVisitaResultado> {
  const tenantId = texto(input?.tenantId);
  const unitId = texto(input?.unitId);
  const unitLabel = texto(input?.unitLabel);
  const visitorName = texto(input?.visitorName);
  const documentNumber = texto(input?.documentNumber);
  if (!tenantId || !unitId || !unitLabel || !visitorName || !documentNumber) {
    throw new HttpsError("invalid-argument", "Datos incompletos para registrar la visita.");
  }

  const rol = typeof actor.rol === "string" ? actor.rol : "";
  const esGuardia = rol === "security_guard" || rol === "security";
  if (!esGuardia && rol !== "tenant_admin" && rol !== "superadmin") {
    throw new HttpsError("permission-denied", "No tienes permisos para registrar visitas.");
  }
  if (!(await esMiembroDelConjunto(tenantId, actor.uid)) && rol !== "superadmin") {
    throw new HttpsError("permission-denied", "No perteneces a este conjunto.");
  }
  // `CF6`: el estado del conjunto, DESPUÉS del rol y en el servidor.
  await assertTenantOperable(tenantId);

  const via = input?.via === "llamada" ? "llamada" : "app";
  const residentes = await residentesActivosDeLaUnidad(tenantId, unitId);

  // **`R7` y `CA11`: sin residentes activos la vía A no existe**, y hay que decirlo aquí y no solo
  // ocultarla en la pantalla — una vía que el servidor acepta y nadie puede contestar deja al
  // visitante esperando cinco minutos a nadie.
  if (via === "app" && residentes.length === 0) {
    throw new HttpsError(
      "failed-precondition",
      "Esta unidad no tiene residentes con acceso, así que no hay a quién preguntarle. " +
        "Llama por teléfono y autoriza declarando el medio.",
    );
  }

  const ahora = Timestamp.now();
  const serverDate = ahora.toDate();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(texto(input?.date))
    ? texto(input.date)
    : serverDate.toISOString().slice(0, 10);
  const scheduledTime = /^\d{2}:\d{2}/.test(texto(input?.scheduledTime))
    ? texto(input.scheduledTime).slice(0, 5)
    : `${String(serverDate.getUTCHours()).padStart(2, "0")}:${String(serverDate.getUTCMinutes()).padStart(2, "0")}`;
  const [torre, unidad] = unitLabel.split("-");

  const ref = await db().collection("visitorPasses").add({
    tenantId,
    unitId,
    unitLabel,
    visitorName,
    documentNumber,
    qrCodeValue: "",
    hostResidentName: texto(input?.hostResidentName),
    tower: torre?.trim() || "-",
    unit: unidad?.trim() || unitLabel,
    date,
    eventDate: date,
    scheduledTime,
    // **`scheduled`, NO `inside`.** El ingreso lo registra el guardia después, y solo si está
    // autorizada: la regla de Firestore exige `authorizationStatus == "autorizada"` para ese paso.
    status: "scheduled",
    checkInAt: null,
    checkOutAt: null,
    registeredByGuard: true,
    ...camposDeAutorizacionAlCrear(via, ahora, actor.uid, actor.nombre),
    createdBy: actor.uid,
    createdByName: actor.nombre,
    residentName: texto(input?.hostResidentName),
    createdAt: ahora,
    updatedAt: ahora,
  });

  return {
    visitorPassId: ref.id,
    authorizationStatus: via === "app" ? "pendiente" : "autorizada",
    residentes,
  };
}
