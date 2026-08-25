import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";

import {
  repartirPorCoeficiente,
  type LineaDeReparto,
  type UnidadParaReparto,
} from "./coefficient-billing";
import { cuentaParaConcepto } from "./plan-de-cuentas";
import { terminoCoeficiente } from "./vocabulario-pais";

/**
 * `PRD-V-FLOW-001` — repartir un egreso entre las unidades, y deshacerlo.
 *
 * **Lo que este módulo NO trae, y es la mitad del trabajo: la aritmética.**
 * `repartirPorCoeficiente` (`coefficient-billing.ts`, de `PLAT-001`) ya valida
 * la base, reparte y asigna el residuo por resto mayor, y ya escribe cuatro de
 * los campos que la ficha de `FLOW-001` presenta como nuevos
 * —`distributionBasis`, `totalDistributed`, `distributionBasisValue` y
 * `roundingAdjustment`—. Reescribir eso aquí habría duplicado el riesgo del
 * dinero para no aprender nada: **lo que faltaba era el puente y el deshacer**,
 * no el cálculo.
 *
 * **R6 es la regla que sostiene el módulo entero: repartir NO toca el libro.**
 * El egreso ya tiene su asiento (`Expense.ledgerEntryId`). Lo que se crea aquí
 * son cuentas por cobrar; el ingreso aparece cuando alguien paga. Escribir un
 * asiento al repartir contaría el mismo dinero dos veces, y no por el libro
 * —que es donde se suele mirar—, sino contra cartera.
 *
 * **El reparto por área es Fase 2** (Story Map). Aquí solo coeficiente, y por
 * eso `distributionBasis` se escribe fijo: mentir en ese campo dejaría cargos
 * que no se pueden explicar.
 */

const db = () => getFirestore();

/**
 * Categorías cuyo gasto **suele estar ya cubierto por la cuota** de
 * administración. Repartirlas aparte puede cobrar dos veces (§5.2).
 *
 * **Avisa, no bloquea**, y es deliberado: hay conjuntos que cobran cuota base
 * baja y reparten lo demás. Eso lo decide su asamblea, no este producto.
 */
const CATEGORIAS_ORDINARIAS = new Set([
  "nomina",
  "servicios_publicos",
  "mantenimiento",
  "administracion",
  "vigilancia",
  // **Los dos nombres VIEJOS, y no sobran: son casi la mitad de los datos.**
  // Medido el 25 de agosto de 2026 sobre los dos proyectos: de 130 egresos,
  // **48 llevan una categoría que ya no existe en `ExpenseCategory`** —
  // `servicios` (48) y `seguridad` (24)—. Las dos son el nombre anterior de
  // `servicios_publicos` y `vigilancia`, que están arriba.
  //
  // Sin estas dos líneas el aviso se apagaba en **el 37% de los egresos
  // reales**, y precisamente en los más ordinarios que hay: el agua y la
  // vigilancia. Un aviso que no salta no se nota — no hay error, no hay rojo,
  // solo un cobro doble que nadie previno. Por eso se cubren aquí en vez de
  // esperar a una migración de datos que ni está hecha ni bloquea esto.
  "servicios",
  "seguridad",
]);

/** Estados de egreso que se pueden repartir (R1). Nunca uno `anulado`. */
const ESTADOS_REPARTIBLES = new Set(["registrado", "pagado"]);

export type RepartirEgresoInput = {
  tenantId: string;
  /** El egreso que se reparte. Debe existir y ser de este conjunto. */
  expenseId: string;
  /** Concepto del cargo generado. D1: de los siete existentes, por defecto `extraordinaria`. */
  concept?: string;
  /** A quién se le cobra. Se guarda en la corrida; no cambia el importe. */
  payerRelation?: "responsible" | "owner" | "tenant";
  /** `YYYY-MM` del cargo. */
  period: string;
  dueDate?: string;
  /** true = vista previa; no se escribe nada (CA6/CA7). */
  dryRun?: boolean;
  /**
   * R5 · un egreso puede repartirse más de una vez, pero la segunda **exige
   * decir que sí a sabiendas**. Sin esto, un reparto repetido se rechaza y se
   * devuelve `yaRepartido` con las corridas que ya existen.
   */
  confirmarRepetido?: boolean;
  /** Idempotencia: dos confirmaciones con la misma clave crean UNA corrida. */
  operationKey: string;
};

export type RepartirEgresoResultado = {
  ok: true;
  dryRun: boolean;
  campaignId?: string;
  /** `false` en un reintento idempotente: la corrida ya existía. */
  created?: boolean;
  lines: LineaDeReparto[];
  total: number;
  coefficientSum: number;
  /** §5.2 — el gasto es ordinario y puede estar ya cubierto por la cuota. */
  avisoDobleCobro: boolean;
  /** R5 — ids de las corridas anteriores de este mismo egreso. */
  yaRepartido: string[];
};

/**
 * Vista previa y reparto. La membresía y el estado del conjunto los validó
 * `index.ts`; aquí se valida el EGRESO, se reparte con la función de
 * `PLAT-001` y —solo sin `dryRun`— se escriben corrida y cargos en un batch.
 */
export async function repartirEgreso(
  input: RepartirEgresoInput,
  uid: string,
): Promise<RepartirEgresoResultado> {
  const firestore = db();

  const [tenantSnap, expenseSnap] = await Promise.all([
    firestore.collection("tenants").doc(input.tenantId).get(),
    firestore.collection("expenses").doc(input.expenseId).get(),
  ]);

  if (!tenantSnap.exists) throw new HttpsError("not-found", "El conjunto no existe.");
  if (!expenseSnap.exists) throw new HttpsError("not-found", "Ese egreso no existe.");

  const egreso = expenseSnap.data() as {
    tenantId?: string;
    amount?: number;
    status?: string;
    category?: string;
    description?: string;
    vendorName?: string;
  };

  // El egreso tiene que ser DE ESTE conjunto. Sin esta comprobación, un
  // administrador con membresía en dos conjuntos repartiría la factura de uno
  // entre las unidades del otro — y los importes cuadrarían, que es lo peor.
  if (egreso.tenantId !== input.tenantId) {
    throw new HttpsError("permission-denied", "Ese egreso no pertenece a este conjunto.");
  }

  // R1
  if (!ESTADOS_REPARTIBLES.has(egreso.status ?? "")) {
    throw new HttpsError(
      "failed-precondition",
      egreso.status === "anulado"
        ? "Un egreso anulado no se puede repartir."
        : `No se puede repartir un egreso en estado «${egreso.status ?? "desconocido"}».`,
    );
  }

  const total = typeof egreso.amount === "number" ? egreso.amount : 0;
  if (!(total > 0)) {
    throw new HttpsError("failed-precondition", "Ese egreso no tiene importe que repartir.");
  }

  // Idempotencia por clave, mismo patrón que la corrida por coeficiente: el id
  // de la corrida ES la clave normalizada, así que un reintento la encuentra.
  const campaignId = `exp_${input.operationKey.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 120)}`;
  const campaignRef = firestore.collection("billingCampaigns").doc(campaignId);

  // R5 · ¿ya se repartió? Tres matices, y los tres salieron de una prueba:
  //
  //  · Las corridas **anuladas no cuentan**: si se anuló, el egreso vuelve a
  //    figurar como no repartido (CA8) y repetirlo es lo normal.
  //  · **Esta corrida no se cuenta a sí misma.** Sin excluirla, un reintento
  //    con la MISMA clave se veía en su propio espejo y respondía «este egreso
  //    ya se repartió»: alarmaba sobre una segunda corrida que no existía.
  const previasSnap = await firestore
    .collection("billingCampaigns")
    .where("tenantId", "==", input.tenantId)
    .where("sourceExpenseId", "==", input.expenseId)
    .get();
  const yaRepartido = previasSnap.docs
    .filter((d) => d.id !== campaignId && (d.data() as { status?: string }).status !== "anulada")
    .map((d) => d.id);

  const avisoDobleCobro = CATEGORIAS_ORDINARIAS.has(egreso.category ?? "");

  const currency = ((tenantSnap.data() as { currency?: string }).currency ?? "COP").toUpperCase();
  const pais = (tenantSnap.data() as { country?: string }).country;

  const unitsSnap = await firestore
    .collection("units")
    .where("tenantId", "==", input.tenantId)
    .get();

  const unidades: UnidadParaReparto[] = unitsSnap.docs.map((d) => {
    const data = d.data() as {
      displayName?: string;
      coefficient?: number;
      status?: string;
      billingResponsiblePersonId?: string;
      ownerIds?: string[];
    };
    return {
      id: d.id,
      unitLabel: data.displayName ?? d.id,
      coefficient: data.coefficient,
      status: data.status,
      billingResponsiblePersonId: data.billingResponsiblePersonId,
      ownerIds: data.ownerIds,
    };
  });

  const reparto = repartirPorCoeficiente(total, unidades, currency, terminoCoeficiente(pais));

  if (input.dryRun) {
    return { ok: true, dryRun: true, avisoDobleCobro, yaRepartido, ...reparto };
  }

  // **La idempotencia se resuelve ANTES que la guarda de repetido, y el orden
  // es el defecto que encontró la prueba.** Al revés, un reintento de la misma
  // operación —doble clic, reintento de red— chocaba con R5 y devolvía «este
  // egreso ya se repartió» en lugar de la corrida que ya había creado. Un
  // reintento de la MISMA operación no es repetir el reparto: es el mismo.
  const existente = await campaignRef.get();
  if (existente.exists) {
    return { ok: true, dryRun: false, campaignId, created: false, avisoDobleCobro, yaRepartido, ...reparto };
  }

  // R5 · repartir OTRA vez sí exige confirmación aparte. Va DESPUÉS del
  // `dryRun` a propósito: la vista previa tiene que poder enseñar el aviso.
  if (yaRepartido.length > 0 && !input.confirmarRepetido) {
    throw new HttpsError(
      "failed-precondition",
      `Este egreso ya se repartió (${yaRepartido.length} corrida${yaRepartido.length > 1 ? "s" : ""}). Confirma que quieres repartirlo otra vez.`,
    );
  }

  const concepto = input.concept ?? "extraordinaria";
  const batch = firestore.batch();

  batch.set(campaignRef, {
    tenantId: input.tenantId,
    concept: concepto,
    period: input.period,
    // Igual que en la corrida por coeficiente: esta no tiene importe plano.
    unitAmount: 0,
    distributionBasis: "coefficient",
    totalDistributed: reparto.total,
    sourceExpenseId: input.expenseId,
    payerRelation: input.payerRelation ?? "responsible",
    dueDate: input.dueDate ?? null,
    unitCount: reparto.lines.length,
    source: "immediate",
    status: "vigente",
    sentAt: FieldValue.serverTimestamp(),
    createdBy: uid,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  for (const line of reparto.lines) {
    const stmtRef = firestore.collection("billingStatements").doc();
    batch.set(stmtRef, {
      tenantId: input.tenantId,
      unitId: line.unitId,
      unitLabel: line.unitLabel,
      period: input.period,
      concept: concepto,
      accountCode: cuentaParaConcepto(concepto).code,
      campaignId,
      // R10/CA5 · la otra mitad de la trazabilidad: del cargo a su factura.
      sourceExpenseId: input.expenseId,
      amount: line.amount,
      paymentAmount: 0,
      balance: line.amount,
      // R4/CA3/CA4 · la base viaja congelada. Si mañana cambia el coeficiente
      // de la unidad, este cargo sigue explicando por qué vale lo que vale.
      distributionBasisValue: line.coefficient,
      ...(line.roundingAdjustment > 0 ? { roundingAdjustment: line.roundingAdjustment } : {}),
      ...(input.dueDate ? { dueDate: input.dueDate } : {}),
      status: "pending",
      createdBy: uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  await batch.commit();

  return { ok: true, dryRun: false, campaignId, created: true, avisoDobleCobro, yaRepartido, ...reparto };
}

export type AnularCorridaInput = {
  tenantId: string;
  campaignId: string;
  /** R8 · obligatorio. Sin motivo no se anula. */
  reason: string;
};

export type AnularCorridaResultado = {
  ok: true;
  campaignId: string;
  /** Cargos anulados. `0` en un reintento sobre una corrida ya anulada. */
  cancelled: number;
  alreadyCancelled: boolean;
};

/**
 * Anula una corrida entera y todos sus cargos (§5.3).
 *
 * **R7 · una corrida con ALGÚN cargo con pagos aplicados no se anula en lote**,
 * y las unidades que lo impiden se nombran. Deshacer un pago es `revertirPago`,
 * que tiene su propia trazabilidad: esconder una reversión de dinero dentro de
 * una corrección de cartera es exactamente cómo se pierde el rastro.
 *
 * **Los anticipos cruzados cuentan como pago.** `advanceAppliedAmount` va
 * aparte de `paymentAmount` desde `FLOW-002` —a propósito, para no contar el
 * ingreso dos veces— así que mirar solo `paymentAmount` dejaría anular un cargo
 * que se cubrió con un anticipo, y el saldo a favor se evaporaría sin rastro.
 */
export async function anularCorrida(
  input: AnularCorridaInput,
  uid: string,
): Promise<AnularCorridaResultado> {
  const firestore = db();

  const motivo = (input.reason ?? "").trim();
  if (!motivo) throw new HttpsError("invalid-argument", "Anular exige un motivo.");

  const campaignRef = firestore.collection("billingCampaigns").doc(input.campaignId);
  const campaignSnap = await campaignRef.get();
  if (!campaignSnap.exists) throw new HttpsError("not-found", "Esa corrida no existe.");

  const corrida = campaignSnap.data() as { tenantId?: string; status?: string };
  if (corrida.tenantId !== input.tenantId) {
    throw new HttpsError("permission-denied", "Esa corrida no pertenece a este conjunto.");
  }
  if (corrida.status === "anulada") {
    return { ok: true, campaignId: input.campaignId, cancelled: 0, alreadyCancelled: true };
  }

  const cargosSnap = await firestore
    .collection("billingStatements")
    .where("tenantId", "==", input.tenantId)
    .where("campaignId", "==", input.campaignId)
    .get();

  // R7 · se miran TODOS antes de tocar ninguno, y los que bloquean se nombran.
  const conPago = cargosSnap.docs.filter((d) => {
    const c = d.data() as { paymentAmount?: number; advanceAppliedAmount?: number };
    return (c.paymentAmount ?? 0) > 0 || (c.advanceAppliedAmount ?? 0) > 0;
  });
  if (conPago.length > 0) {
    const nombres = conPago
      .slice(0, 5)
      .map((d) => (d.data() as { unitLabel?: string }).unitLabel ?? d.id)
      .join(", ");
    const extra = conPago.length > 5 ? ` y ${conPago.length - 5} más` : "";
    throw new HttpsError(
      "failed-precondition",
      `No se puede anular: estas unidades ya tienen pagos aplicados: ${nombres}${extra}. Revierte esos pagos primero.`,
    );
  }

  const ahora = FieldValue.serverTimestamp();
  let batch = firestore.batch();
  let enLote = 0;
  const commit = async () => {
    if (enLote > 0) await batch.commit();
    batch = firestore.batch();
    enLote = 0;
  };

  for (const d of cargosSnap.docs) {
    batch.update(d.ref, {
      status: "cancelled",
      // El balance en cero es lo que deja correcta toda suma de dinero aunque
      // el código que la haga no conozca el estado nuevo. `amount` NO se toca:
      // el cargo conserva lo que llegó a decir.
      balance: 0,
      cancelledAt: ahora,
      cancelledBy: uid,
      cancellationReason: motivo,
      updatedAt: ahora,
      updatedBy: uid,
    });
    if (++enLote >= 400) await commit();
  }

  batch.update(campaignRef, {
    status: "anulada",
    cancelledAt: ahora,
    cancelledBy: uid,
    cancellationReason: motivo,
    updatedAt: ahora,
  });
  enLote += 1;
  await commit();

  return {
    ok: true,
    campaignId: input.campaignId,
    cancelled: cargosSnap.size,
    alreadyCancelled: false,
  };
}
