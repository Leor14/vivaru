import { getFirestore, Timestamp, type Firestore } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";

import { resolveFeatureFlag } from "../feature-flags";
import { findOperation } from "./catalog";
import { ejecutarOperacionAutorizada } from "./ejecucion";
import { construirEntradaPqrs, ticketPerteneceAlConjunto, variantePqrsDe, type VariantePqrs } from "./pqrs-ticket";

/**
 * Modo sombra de PQRS — Fase 4 de `PRD-VAI-FEAT-002`.
 *
 * Clasifica **en silencio** cada ticket nuevo y guarda la sugerencia completa
 * junto a la decisión que acabe tomando el administrador. Nadie ve nada: ni el
 * residente, ni el administrador, ni el comité.
 *
 * ## Para qué, si no se muestra
 *
 * Las dos puertas de G7 —recall de `high` ≥95% y exactitud de `category` ≥90%—
 * se cobran «contra la decisión real del administrador», y esa referencia **hoy
 * no existe**. El gold set dice si el modelo coincide con un anotador; lo que
 * hace falta saber es si coincide con quien atiende el ticket. Las dos
 * decisiones rectoras del 15 de agosto movieron los dos criterios a esta puerta
 * justamente porque la referencia se fabrica aquí, y desde el primer ticket
 * real: sin sombra, G7 llegaría sin nada contra qué medirse.
 *
 * ## Lo que esto NO hace, y conviene que siga sin hacer
 *
 * **No escribe una sola letra en el ticket.** Ni `category`, ni `type`, ni
 * `priority`, ni `classifiedAt`. El ticket se lee y no se toca. Si algún día
 * esto escribiera en el ticket, dejaría de ser una sombra y pasaría a ser una
 * clasificación automática sin que nadie lo hubiera decidido — y toda la PRD
 * está construida sobre que el administrador decide.
 *
 * **Y por eso la sugerencia no vive dentro del ticket** (PRD §7: «objeto
 * `aiAssistance` separado del `Ticket`»). El motivo es concreto: `firestore.rules`
 * deja al RESIDENTE leer su propio ticket. Un campo ahí dentro sería visible
 * para quien lo escribió, y la sombra dejaría de serlo el día que se encienda.
 *
 * ## Gasto
 *
 * USD 0,0009 por ticket con la v2 de `pqrs-asistir`. **Es la primera vez en el
 * programa que el sistema gasta sin que nadie pulse nada**: hasta ahora toda
 * llamada salía de un administrador abriendo el drawer o de una corrida
 * lanzada a mano. Por eso hay bandera propia, apagada de nacimiento, y por eso
 * la reserva de más abajo protege contra pagar dos veces por el mismo ticket.
 */

/** Un documento por ticket, con el `ticketId` de identificador. */
export const AI_ASSISTANCE_COLLECTION = "aiAssistance";

/**
 * El `uid` con el que la sombra aparece en la cuota y en `aiUsage`.
 *
 * No es un usuario y no existe en `tenantUsers`: es la etiqueta que permite
 * separar el gasto de la sombra del de los administradores al leer la factura.
 * Los dos guiones bajos lo hacen imposible de confundir con un uid de Firebase.
 */
export const ACTOR_SOMBRA = "__sombra__";

const OPERACION = "pqrs-asistir" as const;

/**
 * En qué quedó la sombra para este ticket. **`omitida` es un resultado, no un
 * hueco**: el día que alguien cuente cuántos tickets tienen sombra, la
 * diferencia tiene que estar explicada en la propia colección y no deducirse.
 */
export type EstadoSombra = "en_curso" | "sugerida" | "omitida" | "fallo";

export type MotivoOmision = "buzon_simple" | "ticket_sin_texto";

/** Estados en los que el ticket ya se considera cerrado para medir. */
const ESTADOS_TERMINALES = new Set(["resolved", "closed"]);

export interface TicketEnSombra {
  tenantId?: unknown;
  subject?: unknown;
  message?: unknown;
  responseHistory?: unknown;
  category?: unknown;
  type?: unknown;
  priority?: unknown;
  status?: unknown;
  classifiedAt?: unknown;
  classifiedBy?: unknown;
}

/**
 * La decisión del administrador tal y como quedó escrita en el ticket.
 *
 * **`priority` ausente significa «no decidió este eje», y se guarda ausente.**
 * El 16 de agosto se corrigió que el selector arrancara en `Media` y escribiera
 * ese default como si fuera una decisión: 3 de las 7 prioridades guardadas en la
 * sesión de F3 eran eso. Convertir aquí la ausencia en un `null` volvería a
 * fabricar el mismo problema por el otro extremo — un lector futuro no sabría
 * distinguir «no decidió» de «decidió que ninguna».
 */
export interface DecisionAdministrador {
  category?: string;
  type?: string;
  priority?: string;
  classifiedAt?: string;
  classifiedBy?: string;
  status?: string;
}

function cadena(valor: unknown): string | undefined {
  return typeof valor === "string" && valor.trim() ? valor.trim() : undefined;
}

/** Función pura: lo que el administrador dejó escrito, sin inventar campos. */
export function decisionDelTicket(ticket: TicketEnSombra): DecisionAdministrador {
  const decision: DecisionAdministrador = {};
  const category = cadena(ticket.category);
  const type = cadena(ticket.type);
  const priority = cadena(ticket.priority);
  const classifiedAt = cadena(ticket.classifiedAt);
  const classifiedBy = cadena(ticket.classifiedBy);
  const status = cadena(ticket.status);

  if (category) decision.category = category;
  if (type) decision.type = type;
  if (priority) decision.priority = priority;
  if (classifiedAt) decision.classifiedAt = classifiedAt;
  if (classifiedBy) decision.classifiedBy = classifiedBy;
  if (status) decision.status = status;
  return decision;
}

export function esEstadoTerminal(status: unknown): boolean {
  return typeof status === "string" && ESTADOS_TERMINALES.has(status);
}

/**
 * Qué hacer con este ticket. **Función pura**, separada del orquestador por la
 * misma razón que `authorizeGatewayCall`: es la parte que decide si se gasta
 * dinero y en qué casos NO se gasta, y quería poder probarla entera sin
 * levantar un emulador. Un banco de pruebas que solo corre cuando alguien
 * arranca Firestore es un banco que un día no corre — en este repo eso ya pasó
 * y duró meses.
 */
export type PlanDeSombra =
  | { accion: "omitir"; motivo: MotivoOmision }
  | { accion: "clasificar"; entrada: unknown; recorte: { mensaje: boolean; historialOmitido: number } };

export function planificarSombra(ticket: TicketEnSombra, tenantId: string, variante: VariantePqrs): PlanDeSombra {
  // **En buzón simple no se corre, y no es por ahorrar.** Ahí el contrato de
  // producto obliga a `suggestedCategory` y `suggestedType` en null, y la
  // pantalla no pinta el editor de clasificación —el esquema de `aiFeedback` lo
  // tiene escrito como invariante—. Es decir: no existe la decisión del
  // administrador. Y sin decisión no hay par, que es lo único que la sombra
  // viene a fabricar.
  if (variante === "buzon_simple") return { accion: "omitir", motivo: "buzon_simple" };

  // Un ticket de otro conjunto se trata como uno sin texto: no se clasifica y
  // no se paga. Aquí el `tenantId` sale del propio documento, así que esto es
  // una red contra un documento incoherente, no contra un cliente mentiroso.
  if (!ticketPerteneceAlConjunto(ticket, tenantId)) return { accion: "omitir", motivo: "ticket_sin_texto" };

  const construida = construirEntradaPqrs(ticket, variante);
  if (!construida.ok) return { accion: "omitir", motivo: "ticket_sin_texto" };

  return { accion: "clasificar", entrada: construida.entrada, recorte: construida.recorte };
}

/**
 * ¿Este cambio del ticket toca algo que la sombra deba anotar?
 *
 * Función pura y con guardia deliberadamente estrecha: `onDocumentUpdated`
 * dispara con CUALQUIER escritura sobre el ticket —responder, cambiar estado,
 * adjuntar—, y sin este filtro la sombra reescribiría su fila en todas ellas.
 * No costaría dinero de modelo, pero sí escrituras, y sobre todo dejaría un
 * `decisionActualizadaEn` que se mueve cuando la decisión no se movió.
 */
export function hayQueRegistrarDecision(antes: TicketEnSombra, despues: TicketEnSombra): boolean {
  const ejes: Array<keyof TicketEnSombra> = ["category", "type", "priority", "classifiedAt"];
  if (ejes.some((eje) => antes[eje] !== despues[eje])) return true;
  // El cruce a terminal importa aunque la clasificación no se haya tocado: es
  // lo que congela la fila para G7.
  return !esEstadoTerminal(antes.status) && esEstadoTerminal(despues.status);
}

/**
 * Clasifica un ticket recién creado y guarda la sugerencia.
 *
 * Nunca lanza: un fallo aquí no puede afectar al ticket del residente, que ya
 * está escrito y notificado por otro trigger.
 */
export async function clasificarTicketEnSombra(
  ticketId: string,
  ticket: TicketEnSombra,
  db: Firestore = getFirestore(),
): Promise<void> {
  const tenantId = cadena(ticket.tenantId);
  // Un documento sin conjunto no se puede afirmar de nadie — mismo criterio que
  // `ticketPerteneceAlConjunto`, y aquí además no habría a quién cobrarle.
  if (!tenantId) return;

  // Las dos banderas, y solo estas dos. **No se comprueba
  // `ai-pqrs-suggestions`**, que es la bandera de la operación en el catálogo:
  // esa hace VISIBLE la sugerencia al administrador, y exigirla aquí ataría la
  // sombra a la sugerencia visible. F4 es exactamente lo contrario — sombra
  // global, visible solo en los conjuntos piloto.
  //
  // `ai-gateway` sí, porque el kill switch maestro tiene que poder apagar esto
  // como apaga todo lo demás; `resolveFeatureFlag` falla cerrado si no puede
  // leer, así que una lectura rota no gasta dinero.
  const [gateway, sombra] = await Promise.all([
    resolveFeatureFlag("ai-gateway", tenantId),
    resolveFeatureFlag("ai-pqrs-shadow", tenantId),
  ]);
  // Apagada no deja rastro a propósito: una fila «no corrí porque estaba
  // apagada» por cada ticket de cada conjunto sería ruido, y la ausencia de
  // fila ya dice lo mismo.
  if (!gateway.enabled || !sombra.enabled) return;

  const operation = findOperation(OPERACION);
  if (!operation) return;

  const ref = db.collection(AI_ASSISTANCE_COLLECTION).doc(ticketId);
  const ahora = Timestamp.now();

  // **La reserva es lo que protege el dinero.** Los triggers de Firestore son
  // «al menos una vez»: la misma creación puede entregarse dos veces aunque no
  // haya reintentos. `create` falla si el documento ya existe, así que la
  // segunda entrega se cae aquí —antes de llamar al modelo— en vez de pagar
  // dos veces por el mismo ticket.
  //
  // El precio de esto es que una función que muera a mitad deja la fila en
  // `en_curso` para siempre, y ese ticket no se reintenta. Se acepta a
  // sabiendas: pagar dos veces en silencio es peor que no clasificar uno y que
  // se vea al contar por estado. `en_curso` no es un estado normal en reposo —
  // si aparece al leer la colección, es que algo se cayó.
  try {
    await ref.create({
      ticketId,
      tenantId,
      estado: "en_curso" satisfies EstadoSombra,
      operationKey: operation.key,
      operationVersion: operation.version,
      creadoEn: ahora,
      actualizadoEn: ahora,
    });
  } catch {
    logger.info("sombra-pqrs: el ticket ya tenía fila, no se repite la llamada", { ticketId, tenantId });
    return;
  }

  const settingsSnap = await db.collection("tenantSettings").doc(tenantId).get();
  const variante: VariantePqrs = variantePqrsDe(settingsSnap.exists ? settingsSnap.data() : null);

  const plan = planificarSombra(ticket, tenantId, variante);
  if (plan.accion === "omitir") {
    // El motivo se guarda: el día que alguien cuente cuántos tickets tienen
    // sombra, la diferencia tiene que estar explicada en la colección y no
    // deducirse mirando la variante de cada conjunto.
    await ref.set(
      { estado: "omitida" satisfies EstadoSombra, motivo: plan.motivo, variante, actualizadoEn: Timestamp.now() },
      { merge: true },
    );
    return;
  }

  const outcome = await ejecutarOperacionAutorizada({
    operation,
    // Resuelto del propio documento del ticket, no de una sesión: aquí no hay
    // ninguna. El contrato de `ejecutarOperacionAutorizada` es que quien llama
    // ya se hizo responsable del conjunto, y esto es hacerse responsable.
    tenantId,
    actor: { uid: ACTOR_SOMBRA, topeDeUsuario: false },
    entradaCruda: plan.entrada,
    now: new Date(),
  });

  if (!outcome.ok) {
    await ref.set(
      {
        estado: "fallo" satisfies EstadoSombra,
        motivo: outcome.reason,
        variante,
        actualizadoEn: Timestamp.now(),
      },
      { merge: true },
    );
    logger.warn("sombra-pqrs: no se pudo clasificar", { ticketId, tenantId, reason: outcome.reason });
    return;
  }

  await ref.set(
    {
      estado: "sugerida" satisfies EstadoSombra,
      variante,
      // La salida completa, que es lo que pide la PRD §7. **Esta colección sí
      // guarda contenido del conjunto**, a diferencia de `aiUsage` y
      // `aiFeedback`, donde la regla del Paso 0 es que no haya dónde meterlo:
      // aquí el resumen y el borrador SON el dato que G7 necesita. Lo que la
      // protege es la regla de Firestore —solo la lee el superadministrador, que
      // ya puede leer el ticket— y que nadie del conjunto la ve.
      sugerencia: outcome.output,
      recorte: plan.recorte,
      // Solo el vocabulario cerrado, como en `aiUsage`. Las posiciones de las
      // frases sirven para pintarlas en pantalla, y aquí no hay pantalla.
      marcasDeRevision: [...new Set(outcome.frasesMarcadas.map((f) => f.marca))],
      // Se anota aunque el ticket todavía no tenga decisión: lo que aún no pasó
      // se distingue por `decisionActualizadaEn` ausente.
      decision: decisionDelTicket(ticket),
      actualizadoEn: Timestamp.now(),
    },
    { merge: true },
  );

  logger.info("sombra-pqrs: ticket clasificado en sombra", { ticketId, tenantId, variante });
}

/**
 * Anota la decisión del administrador junto a la sugerencia.
 *
 * **Se guarda en cada cambio y se congela al resolverse**, en vez de solo al
 * cierre como dice la letra de la PRD. Un ticket con SLA puede vivir semanas
 * abierto: esperar al cierre dejaría fuera del conjunto de evaluación todo lo
 * que se clasifica y no se cierra, que en un piloto es la mayoría. G7 mide
 * contra las congeladas; las demás dejan ver el ritmo sin esperar.
 *
 * **No comprueba la bandera de sombra, y es deliberado.** Esta fila ya se pagó
 * al crearse. Apagar la bandera tiene que dejar de gastar en tickets nuevos, no
 * tirar a la basura los pares que ya estaban a medio construir.
 */
export async function registrarDecisionEnSombra(
  ticketId: string,
  antes: TicketEnSombra,
  despues: TicketEnSombra,
  db: Firestore = getFirestore(),
): Promise<void> {
  if (!hayQueRegistrarDecision(antes, despues)) return;

  const ref = db.collection(AI_ASSISTANCE_COLLECTION).doc(ticketId);

  // En transacción porque dos escrituras seguidas sobre el ticket —clasificar y
  // resolver, que es la secuencia normal— disparan dos veces esto, y `congelada`
  // se decide leyendo lo que ya hay.
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    // Sin fila no hay nada que completar: la colección es exactamente el
    // conjunto de tickets que la sombra llegó a ver. Crear una aquí llenaría
    // `aiAssistance` de decisiones sin sugerencia, que para G7 no valen y al
    // contar mentirían sobre la cobertura.
    if (!snap.exists) return;

    const yaCongelada = snap.get("decisionCongeladaEn");
    const terminal = esEstadoTerminal(despues.status);

    tx.set(
      ref,
      {
        decision: decisionDelTicket(despues),
        decisionActualizadaEn: Timestamp.now(),
        // Se pone una sola vez: marca cuándo el ticket llegó por primera vez a
        // un estado cerrado. Si después se reabre y se reclasifica, `decision`
        // sigue actualizándose y esta fecha no se mueve.
        ...(terminal && !yaCongelada ? { decisionCongeladaEn: Timestamp.now() } : {}),
      },
      { merge: true },
    );
  });
}
