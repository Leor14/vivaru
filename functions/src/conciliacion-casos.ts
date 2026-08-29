import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";

import {
  clasificar,
  efectoContable,
  idDeCaso,
  incoherenciasDelPar,
  motivoValido,
  porQueNoEsCandidato,
  transicionValida,
  type AsientoDelLibro,
  type EstadoCaso,
  type Incoherencia,
  type LineaDeBanco,
  type MotivoCodigo,
} from "./conciliacion";
import { esAdminActivoDelConjunto } from "./tenant-membership";
import { assertTenantOperable } from "./tenant-status";

/**
 * `PRD-V-FLOW-004` — el expediente, del lado del servidor.
 *
 * **Por qué esto es una callable y no una escritura del cliente**, que es la
 * decisión que más agujeros de permisos ha causado en este producto, y aquí
 * cualquiera de las cuatro razones basta:
 *
 * 1. **Escribe en tres colecciones** —`bankStatementLines`, `ledgerEntries` y
 *    `reconciliationCases`— y las tres tienen que moverse juntas o ninguna.
 * 2. **R2 es aritmética que el cliente no debe poder saltarse.** El defecto que
 *    motiva la ficha es exactamente eso: `matchLine` escribía lo que le pidieran.
 * 3. **La cascada R7 tiene que vivir donde vive el reverso**, y el reverso ya es
 *    una callable.
 * 4. **Una regla de Firestore no puede sostener el invariante sola**: el Admin
 *    SDK no las evalúa. La regla queda como refuerzo que cierra el camino del
 *    cliente (R8), no como guardián.
 *
 * **Y NO va detrás de la bandera** (§11.4). La bandera gobierna la bandeja y el
 * expediente; la coherencia entra sin interruptor, porque apagarla devolvería el
 * producto al estado que permitió casar −300.000 contra +40.000.
 */

const db = () => getFirestore();

export const COLECCION_CASOS = "reconciliationCases";

type CasoDoc = {
  tenantId: string;
  bankAccountId: string;
  bankStatementLineId: string;
  status: EstadoCaso;
  version: number;
  candidateLedgerEntryIds: string[];
  matchedLedgerEntryId: string | null;
  excepcion: "sin_contraparte" | "varios_candidatos" | "no_identificada" | null;
  incoherencias: Incoherencia[];
  motivoCodigo?: MotivoCodigo | null;
  motivoTexto?: string | null;
};

type Transicion = {
  de: EstadoCaso;
  a: EstadoCaso;
  cuando: Timestamp;
  quien: string;
  motivoCodigo: MotivoCodigo | null;
  /** Cómo ocurrió: a mano desde la bandeja, o arrastrado por otra operación. */
  mecanismo: "bandeja" | "cascada_reverso" | "cascada_borrado" | "relleno" | "importacion";
};

function texto(valor: unknown, campo: string): string {
  const v = typeof valor === "string" ? valor.trim() : "";
  if (!v) throw new HttpsError("invalid-argument", `Falta ${campo}.`);
  return v;
}

/**
 * Misma frontera que `assertPuedeCobrar` y `assertPuedeOperarAnticipos`, y por
 * las mismas razones: la autoridad es la **membresía**, no el claim del token
 * —que es de un solo conjunto y bloquearía al administrador de varios—, y el
 * estado del conjunto va al final porque conciliar es **escribir**.
 */
async function assertPuedeConciliar(role: unknown, uid: string, tenantId: string) {
  const rol = typeof role === "string" ? role : "";
  if (rol === "superadmin" || rol === "super_admin") return;
  const esAdmin = rol === "tenant_admin" || rol === "admin_tenant";
  if (!esAdmin || !(await esAdminActivoDelConjunto(tenantId, uid))) {
    throw new HttpsError("permission-denied", "No tienes permiso para conciliar en este conjunto.");
  }
  await assertTenantOperable(tenantId);
}

const dinero = (n: number) => new Intl.NumberFormat("es-MX", { maximumFractionDigits: 2 }).format(n);

// ── Lectura y creación del caso ─────────────────────────────────────────────

function comoLinea(id: string, d: FirebaseFirestore.DocumentData): LineaDeBanco {
  return {
    id,
    tenantId: String(d.tenantId ?? ""),
    bankAccountId: String(d.bankAccountId ?? ""),
    date: String(d.date ?? ""),
    description: typeof d.description === "string" ? d.description : "",
    amount: Number(d.amount ?? 0),
  };
}

function comoAsiento(id: string, d: FirebaseFirestore.DocumentData): AsientoDelLibro {
  return {
    id,
    tenantId: String(d.tenantId ?? ""),
    bankAccountId: d.bankAccountId ?? null,
    date: String(d.date ?? ""),
    type: d.type === "egreso" ? "egreso" : "ingreso",
    amount: Number(d.amount ?? 0),
    reconciled: d.reconciled === true,
    reversedByEntryId: d.reversedByEntryId ?? null,
  };
}

/**
 * El caso de una línea, creándolo si no existe.
 *
 * **Existe porque las 27 líneas de producción son anteriores al expediente.**
 * Si las callables exigieran un caso ya escrito, no se podría conciliar nada
 * hasta que corriera el relleno — y un despliegue que necesita un script para
 * no romperse es un despliegue que rompe si el script falla.
 */
function casoNuevo(linea: LineaDeBanco, status: EstadoCaso, extra: Partial<CasoDoc> = {}): CasoDoc {
  return {
    tenantId: linea.tenantId,
    bankAccountId: linea.bankAccountId,
    bankStatementLineId: linea.id,
    status,
    version: 0,
    candidateLedgerEntryIds: [],
    matchedLedgerEntryId: null,
    excepcion: null,
    incoherencias: [],
    motivoCodigo: null,
    motivoTexto: null,
    ...extra,
  };
}

// ── La transición, en un solo sitio ─────────────────────────────────────────

/**
 * **Toda transición pasa por aquí**, y por eso el historial no puede quedarse a
 * medias: quien escribe el estado escribe la línea de historia en la misma
 * operación. Un estado sin su porqué es exactamente lo que esta ficha viene a
 * arreglar.
 */
function escribirTransicion(
  tx: FirebaseFirestore.Transaction,
  ref: FirebaseFirestore.DocumentReference,
  caso: CasoDoc,
  a: EstadoCaso,
  quien: string,
  mecanismo: Transicion["mecanismo"],
  motivoCodigo: MotivoCodigo | null,
  motivoTexto: string | null,
  campos: Partial<CasoDoc> = {},
  existe = true,
) {
  if (existe && !transicionValida(caso.status, a)) {
    throw new HttpsError("failed-precondition", `Un caso ${caso.status} no puede pasar a ${a}.`);
  }
  if (!motivoValido(a, motivoCodigo, motivoTexto)) {
    throw new HttpsError("invalid-argument", "Esa salida necesita un motivo del catálogo, y «otro» necesita texto.");
  }
  const transicion: Transicion = {
    de: caso.status,
    a,
    cuando: Timestamp.now(),
    quien,
    motivoCodigo,
    mecanismo,
  };
  const cuerpo = {
    ...caso,
    ...campos,
    status: a,
    version: caso.version + 1,
    motivoCodigo,
    motivoTexto,
    history: FieldValue.arrayUnion(transicion),
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: quien,
  };
  if (existe) {
    tx.update(ref, cuerpo);
  } else {
    tx.set(ref, { ...cuerpo, history: [transicion], createdAt: FieldValue.serverTimestamp(), createdBy: quien });
  }
}

// ── Aplicar ─────────────────────────────────────────────────────────────────

export type AplicarCasoInput = {
  tenantId: string;
  bankStatementLineId: string;
  ledgerEntryId: string;
  /** Si viene, la operación falla cuando el caso ya se movió (CF7). */
  expectedVersion?: number;
};

export type AplicarCasoResultado = {
  ok: true;
  /** `false` cuando ya estaba aplicado a ese mismo asiento (R10). */
  applied: boolean;
  status: EstadoCaso;
  version: number;
};

export async function aplicarCaso(input: AplicarCasoInput, uid: string, role: unknown): Promise<AplicarCasoResultado> {
  const tenantId = texto(input.tenantId, "el conjunto");
  const lineaId = texto(input.bankStatementLineId, "la línea del extracto");
  const asientoId = texto(input.ledgerEntryId, "el movimiento del libro");
  await assertPuedeConciliar(role, uid, tenantId);

  const firestore = db();
  const lineaRef = firestore.collection("bankStatementLines").doc(lineaId);
  const asientoRef = firestore.collection("ledgerEntries").doc(asientoId);
  const casoRef = firestore.collection(COLECCION_CASOS).doc(idDeCaso(lineaId));

  return firestore.runTransaction(async (tx) => {
    // ── Lecturas, todas antes de escribir ────────────────────────────────────
    const [lineaSnap, asientoSnap, casoSnap] = await Promise.all([
      tx.get(lineaRef),
      tx.get(asientoRef),
      tx.get(casoRef),
    ]);
    if (!lineaSnap.exists) throw new HttpsError("not-found", "Esa línea del extracto ya no existe.");
    if (!asientoSnap.exists) throw new HttpsError("not-found", "Ese movimiento del libro ya no existe.");

    const lineaData = lineaSnap.data() as FirebaseFirestore.DocumentData;
    const asientoData = asientoSnap.data() as FirebaseFirestore.DocumentData;
    const linea = comoLinea(lineaId, lineaData);
    const asiento = comoAsiento(asientoId, asientoData);

    if (linea.tenantId !== tenantId) throw new HttpsError("permission-denied", "Esa línea es de otro conjunto.");
    if (asiento.tenantId !== tenantId) throw new HttpsError("permission-denied", "Ese movimiento es de otro conjunto.");

    const caso = casoSnap.exists ? (casoSnap.data() as CasoDoc) : casoNuevo(linea, "detectado");
    if (typeof input.expectedVersion === "number" && input.expectedVersion !== caso.version) {
      throw new HttpsError("failed-precondition", "Alguien movió este caso mientras lo mirabas. Vuelve a abrirlo.");
    }

    // **R10 · idempotencia.** Reaplicar lo mismo no duplica ni sube la versión.
    if (lineaData.reconciled === true && lineaData.matchedLedgerEntryId === asientoId) {
      return { ok: true as const, applied: false, status: caso.status, version: caso.version };
    }
    if (lineaData.reconciled === true) {
      throw new HttpsError("failed-precondition", "Esa línea ya está conciliada con otro movimiento.");
    }

    // ── Las reglas, y el mensaje lleva los números delante ───────────────────
    const descarte = porQueNoEsCandidato(linea, asiento);
    if (descarte === "ya_conciliado") {
      throw new HttpsError("failed-precondition", "Ese movimiento ya fue conciliado con otra línea.");
    }
    if (descarte === "anulado") {
      throw new HttpsError("failed-precondition", "Ese movimiento está anulado por un reverso.");
    }
    if (descarte === "otra_cuenta") {
      throw new HttpsError("failed-precondition", "Ese movimiento es de otra cuenta bancaria.");
    }
    if (descarte === "efecto") {
      throw new HttpsError(
        "failed-precondition",
        `No cuadran: el banco mueve ${dinero(linea.amount)} y el movimiento ${dinero(efectoContable(asiento))}.`,
      );
    }
    if (descarte === "fecha") {
      throw new HttpsError(
        "failed-precondition",
        `Se llevan más de 3 días: la línea es del ${linea.date} y el movimiento del ${asiento.date}.`,
      );
    }

    // ── Escrituras: las tres, o ninguna ─────────────────────────────────────
    tx.update(lineaRef, { reconciled: true, matchedLedgerEntryId: asientoId });
    tx.update(asientoRef, {
      reconciled: true,
      bankStatementLineId: lineaId,
      reconciledAt: new Date().toISOString().slice(0, 10),
      updatedBy: uid,
      updatedAt: FieldValue.serverTimestamp(),
    });
    escribirTransicion(
      tx, casoRef, caso, "aplicado", uid, "bandeja", null, null,
      { matchedLedgerEntryId: asientoId, excepcion: null, incoherencias: [], candidateLedgerEntryIds: [asientoId] },
      casoSnap.exists,
    );

    return { ok: true as const, applied: true, status: "aplicado" as const, version: caso.version + 1 };
  });
}

// ── Rechazar ────────────────────────────────────────────────────────────────

export type RechazarCasoInput = {
  tenantId: string;
  bankStatementLineId: string;
  motivoCodigo: MotivoCodigo;
  motivoTexto?: string;
  expectedVersion?: number;
};

export async function rechazarCaso(input: RechazarCasoInput, uid: string, role: unknown) {
  const tenantId = texto(input.tenantId, "el conjunto");
  const lineaId = texto(input.bankStatementLineId, "la línea del extracto");
  await assertPuedeConciliar(role, uid, tenantId);

  const firestore = db();
  const lineaRef = firestore.collection("bankStatementLines").doc(lineaId);
  const casoRef = firestore.collection(COLECCION_CASOS).doc(idDeCaso(lineaId));

  return firestore.runTransaction(async (tx) => {
    const [lineaSnap, casoSnap] = await Promise.all([tx.get(lineaRef), tx.get(casoRef)]);
    if (!lineaSnap.exists) throw new HttpsError("not-found", "Esa línea del extracto ya no existe.");
    const linea = comoLinea(lineaId, lineaSnap.data() as FirebaseFirestore.DocumentData);
    if (linea.tenantId !== tenantId) throw new HttpsError("permission-denied", "Esa línea es de otro conjunto.");

    const caso = casoSnap.exists ? (casoSnap.data() as CasoDoc) : casoNuevo(linea, "detectado");
    if (typeof input.expectedVersion === "number" && input.expectedVersion !== caso.version) {
      throw new HttpsError("failed-precondition", "Alguien movió este caso mientras lo mirabas. Vuelve a abrirlo.");
    }
    escribirTransicion(
      tx, casoRef, caso, "rechazado", uid, "bandeja",
      (input.motivoCodigo ?? null) as MotivoCodigo | null,
      typeof input.motivoTexto === "string" ? input.motivoTexto : null,
      {}, casoSnap.exists,
    );
    return { ok: true as const, status: "rechazado" as const, version: caso.version + 1 };
  });
}

// ── Reabrir ─────────────────────────────────────────────────────────────────

export type ReabrirCasoInput = {
  tenantId: string;
  bankStatementLineId: string;
  expectedVersion?: number;
};

/**
 * Devuelve un caso a `detectado`. Si estaba **aplicado**, deshace el
 * emparejamiento — **es el descasado de siempre, pero dejando rastro**.
 */
export async function reabrirCaso(input: ReabrirCasoInput, uid: string, role: unknown) {
  const tenantId = texto(input.tenantId, "el conjunto");
  const lineaId = texto(input.bankStatementLineId, "la línea del extracto");
  await assertPuedeConciliar(role, uid, tenantId);

  const firestore = db();
  const lineaRef = firestore.collection("bankStatementLines").doc(lineaId);
  const casoRef = firestore.collection(COLECCION_CASOS).doc(idDeCaso(lineaId));

  return firestore.runTransaction(async (tx) => {
    const [lineaSnap, casoSnap] = await Promise.all([tx.get(lineaRef), tx.get(casoRef)]);
    if (!lineaSnap.exists) throw new HttpsError("not-found", "Esa línea del extracto ya no existe.");
    const lineaData = lineaSnap.data() as FirebaseFirestore.DocumentData;
    const linea = comoLinea(lineaId, lineaData);
    if (linea.tenantId !== tenantId) throw new HttpsError("permission-denied", "Esa línea es de otro conjunto.");

    const caso = casoSnap.exists ? (casoSnap.data() as CasoDoc) : casoNuevo(linea, "detectado");
    if (typeof input.expectedVersion === "number" && input.expectedVersion !== caso.version) {
      throw new HttpsError("failed-precondition", "Alguien movió este caso mientras lo mirabas. Vuelve a abrirlo.");
    }

    const asientoId = typeof lineaData.matchedLedgerEntryId === "string" ? lineaData.matchedLedgerEntryId : null;
    const asientoRef = asientoId ? firestore.collection("ledgerEntries").doc(asientoId) : null;
    const asientoSnap = asientoRef ? await tx.get(asientoRef) : null;

    tx.update(lineaRef, { reconciled: false, matchedLedgerEntryId: null });
    if (asientoRef && asientoSnap?.exists) {
      tx.update(asientoRef, {
        reconciled: false,
        bankStatementLineId: null,
        reconciledAt: null,
        updatedBy: uid,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    escribirTransicion(
      tx, casoRef, caso, "detectado", uid, "bandeja", null, null,
      { matchedLedgerEntryId: null, incoherencias: [] },
      casoSnap.exists,
    );
    return { ok: true as const, status: "detectado" as const, version: caso.version + 1 };
  });
}

// ── R7 · La cascada ─────────────────────────────────────────────────────────

/**
 * Suelta la conciliación de un asiento **dentro de una transacción ajena**.
 *
 * **Es la primitiva de R7 y vive aquí para que los tres caminos usen la misma.**
 * Los tres son distintos y ninguno es intercambiable: `revertirPago` (callable,
 * Admin SDK — la única vía para asientos `billingStatement`/`advance`),
 * `reverseLedgerEntry` (cliente, alcanza `manual` y `expense`) y
 * `deleteLedgerEntry` (borrado físico, alcanza `expense`). Implementarla en uno
 * solo deja los otros dos vivos, que es justo el fallo que la falsación de la
 * ficha exige provocar camino por camino.
 *
 * **Las lecturas se hacen fuera** (`leerCascada`), porque Firestore exige que
 * toda lectura de una transacción ocurra antes de la primera escritura y esta
 * primitiva se llama desde el medio de otras.
 */
export type CascadaPreparada = {
  lineaRef: FirebaseFirestore.DocumentReference;
  casoRef: FirebaseFirestore.DocumentReference;
  caso: CasoDoc;
  casoExiste: boolean;
} | null;

export async function leerCascada(
  tx: FirebaseFirestore.Transaction,
  asientoId: string,
  asientoData: FirebaseFirestore.DocumentData | undefined,
): Promise<CascadaPreparada> {
  if (!asientoData || asientoData.reconciled !== true) return null;
  const lineaId = typeof asientoData.bankStatementLineId === "string" ? asientoData.bankStatementLineId : "";
  if (!lineaId) return null;

  const firestore = db();
  const lineaRef = firestore.collection("bankStatementLines").doc(lineaId);
  const casoRef = firestore.collection(COLECCION_CASOS).doc(idDeCaso(lineaId));
  const [lineaSnap, casoSnap] = await Promise.all([tx.get(lineaRef), tx.get(casoRef)]);
  if (!lineaSnap.exists) return null;

  const linea = comoLinea(lineaId, lineaSnap.data() as FirebaseFirestore.DocumentData);
  const caso = casoSnap.exists ? (casoSnap.data() as CasoDoc) : casoNuevo(linea, "aplicado", { matchedLedgerEntryId: asientoId });
  return { lineaRef, casoRef, caso, casoExiste: casoSnap.exists };
}

export function escribirCascada(
  tx: FirebaseFirestore.Transaction,
  preparada: CascadaPreparada,
  uid: string,
  mecanismo: Extract<Transicion["mecanismo"], "cascada_reverso" | "cascada_borrado">,
) {
  if (!preparada) return;
  tx.update(preparada.lineaRef, { reconciled: false, matchedLedgerEntryId: null });
  escribirTransicion(
    tx, preparada.casoRef, preparada.caso, "reversado", uid, mecanismo,
    mecanismo === "cascada_reverso" ? "reverso_del_asiento" : "linea_eliminada",
    null,
    { matchedLedgerEntryId: null, excepcion: null },
    preparada.casoExiste,
  );
}

/**
 * El camino del cliente: liberar la conciliación de un asiento **antes** de
 * anularlo o borrarlo desde el navegador.
 *
 * Existe porque `reverseLedgerEntry` y `deleteLedgerEntry` viven en el cliente y
 * la regla les va a impedir tocar un asiento conciliado (R8). Sin esta callable,
 * ese veto convertiría el ciclo automático de egresos en un error de permisos.
 */
export async function liberarConciliacion(
  input: { tenantId: string; ledgerEntryId: string },
  uid: string,
  role: unknown,
) {
  const tenantId = texto(input.tenantId, "el conjunto");
  const asientoId = texto(input.ledgerEntryId, "el movimiento del libro");
  await assertPuedeConciliar(role, uid, tenantId);

  const firestore = db();
  const asientoRef = firestore.collection("ledgerEntries").doc(asientoId);

  return firestore.runTransaction(async (tx) => {
    const asientoSnap = await tx.get(asientoRef);
    if (!asientoSnap.exists) return { ok: true as const, released: false };
    const asientoData = asientoSnap.data() as FirebaseFirestore.DocumentData;
    if (String(asientoData.tenantId ?? "") !== tenantId) {
      throw new HttpsError("permission-denied", "Ese movimiento es de otro conjunto.");
    }
    const preparada = await leerCascada(tx, asientoId, asientoData);
    if (!preparada) return { ok: true as const, released: false };

    tx.update(asientoRef, {
      reconciled: false,
      bankStatementLineId: null,
      reconciledAt: null,
      updatedBy: uid,
      updatedAt: FieldValue.serverTimestamp(),
    });
    escribirCascada(tx, preparada, uid, "cascada_reverso");
    return { ok: true as const, released: true };
  });
}

// ── El relleno, y §5.4 ──────────────────────────────────────────────────────

/**
 * Construye el caso que le corresponde a una línea que YA existe.
 *
 * **§5.4 — lo que ya está escrito no se reescribe, se nombra.** Una línea
 * conciliada nace `aplicado`, porque eso es lo que pasó, y si el par incumple
 * las reglas se le anotan las `incoherencias`. El criterio de no corregir el
 * dato histórico de conjuntos de ejemplo estaba escrito antes que esta ficha
 * (`roadmap-finance` §9).
 */
export function casoDeRelleno(
  linea: LineaDeBanco,
  asientos: AsientoDelLibro[],
  emparejado: AsientoDelLibro | null,
): CasoDoc {
  if (emparejado) {
    return casoNuevo(linea, "aplicado", {
      matchedLedgerEntryId: emparejado.id,
      candidateLedgerEntryIds: [emparejado.id],
      incoherencias: incoherenciasDelPar(linea, emparejado),
    });
  }
  const { status, excepcion, candidateLedgerEntryIds } = clasificar(linea, asientos);
  return casoNuevo(linea, status, { excepcion, candidateLedgerEntryIds });
}

// ── CA1 · el caso nace con la línea ─────────────────────────────────────────

/**
 * Asegura que **cada línea de una cuenta tenga su expediente**.
 *
 * **Existe porque `CA1` no se cumplía, y el hueco se descubrió con la ficha ya
 * desplegada.** Importar un extracto escribía la línea y nada más: el caso nacía
 * después, cuando una callable lo tocaba o cuando corría el relleno. No se veía
 * —la bandeja agrupa mirando líneas y asientos, no casos— pero la métrica «100%
 * de las líneas con expediente» dejaba de ser cierta en la siguiente
 * importación.
 *
 * **La escribe el servidor porque el cliente ya no puede** (R8), que es
 * exactamente la consecuencia de haberle cerrado ese camino.
 *
 * Usa `create()`, no `set()`: si el caso ya existe **no se pisa**. Un
 * `ALREADY_EXISTS` aquí es el resultado normal de reimportar, no un fallo — la
 * misma lección del id derivado de R5.
 */
export type AsegurarCasosInput = { tenantId: string; bankAccountId?: string };

export type AsegurarCasosResultado = {
  ok: true;
  /** Cuántos expedientes se crearon en esta llamada. */
  created: number;
  /** Cuántas líneas se miraron. */
  lines: number;
  /**
   * `true` si quedaron líneas sin mirar por el tope de esta llamada. **Se
   * devuelve en vez de callarlo:** un tope silencioso se lee como «cubrí todo».
   */
  truncated: boolean;
};

/** Tope por llamada. Un lote de Firestore admite 500 escrituras. */
const TOPE_POR_LLAMADA = 400;

export async function asegurarCasos(
  input: AsegurarCasosInput,
  uid: string,
  role: unknown,
): Promise<AsegurarCasosResultado> {
  const tenantId = texto(input.tenantId, "el conjunto");
  await assertPuedeConciliar(role, uid, tenantId);

  const firestore = db();
  let consulta = firestore.collection("bankStatementLines").where("tenantId", "==", tenantId);
  if (typeof input.bankAccountId === "string" && input.bankAccountId) {
    consulta = consulta.where("bankAccountId", "==", input.bankAccountId);
  }

  const [lineasSnap, asientosSnap] = await Promise.all([
    consulta.get(),
    firestore.collection("ledgerEntries").where("tenantId", "==", tenantId).get(),
  ]);

  const lineas = lineasSnap.docs.map((d) => comoLinea(d.id, d.data()));
  const datosPorLinea = new Map(lineasSnap.docs.map((d) => [d.id, d.data()]));
  const asientos = asientosSnap.docs.map((d) => comoAsiento(d.id, d.data()));
  const asientoPorId = new Map(asientos.map((a) => [a.id, a]));

  // Qué casos existen ya. Se lee una vez, no uno por línea.
  const existentes = new Set<string>();
  for (let i = 0; i < lineas.length; i += 30) {
    const trozo = lineas.slice(i, i + 30).map((l) => firestore.collection(COLECCION_CASOS).doc(idDeCaso(l.id)));
    const snaps = await firestore.getAll(...trozo);
    snaps.forEach((snap) => {
      if (snap.exists) existentes.add(snap.id);
    });
  }

  const faltan = lineas.filter((l) => !existentes.has(idDeCaso(l.id)));
  const aEscribir = faltan.slice(0, TOPE_POR_LLAMADA);

  const lote = firestore.batch();
  for (const linea of aEscribir) {
    const datos = datosPorLinea.get(linea.id);
    const emparejadoId = typeof datos?.matchedLedgerEntryId === "string" ? datos.matchedLedgerEntryId : null;
    // Solo cuenta como emparejado si el asiento EXISTE y es del mismo conjunto:
    // una línea que apunta a un asiento borrado no nace `aplicado` mintiendo.
    const emparejado = emparejadoId ? (asientoPorId.get(emparejadoId) ?? null) : null;
    const caso = casoDeRelleno(linea, asientos, emparejado && emparejado.tenantId === tenantId ? emparejado : null);
    lote.create(firestore.collection(COLECCION_CASOS).doc(idDeCaso(linea.id)), {
      ...caso,
      history: [
        {
          // No venía de ningún estado: el caso no existía.
          de: "sin_expediente",
          a: caso.status,
          cuando: Timestamp.now(),
          quien: uid,
          motivoCodigo: null,
          mecanismo: "importacion",
        },
      ],
      createdAt: FieldValue.serverTimestamp(),
      createdBy: uid,
    });
  }
  if (aEscribir.length > 0) await lote.commit();

  return {
    ok: true as const,
    created: aEscribir.length,
    lines: lineas.length,
    truncated: faltan.length > aEscribir.length,
  };
}
