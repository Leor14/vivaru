import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";

import {
  aCentimos,
  construirEstadoFinanciero,
  sumarCuentasPorCobrar,
  sumarDeudaAProveedores,
  type AsientoDelNucleo,
  type PlanParaInformes,
} from "./nucleo-estado-financiero";

/**
 * `PRD-V-FLOW-007`, entrega 2 — el informe mensual **emitible y firmable**.
 *
 * ## Qué añade sobre la entrega 1
 *
 * La entrega 1 unificó la ARITMÉTICA: una sola implementación del estado
 * financiero, espejada byte a byte entre `src/` y `functions/`. Lo que no
 * existía todavía es el **documento**: un informe que se emite una vez, congela
 * sus cifras, lo firma quien responde por él y se conserva aunque después se
 * corrija un asiento.
 *
 * ## Por qué CALLABLE y no escritura directa (§11.1 de la ficha)
 *
 * Sin discusión posible, y por tres razones que se acumulan:
 *
 *   1. **Escribe en tres sitios** —`monthlyReports`, `documents` y Storage—, y
 *      los tres tienen que quedar coherentes o ninguno.
 *   2. **Congela cifras.** Si las mandara el cliente, el administrador emitiría
 *      el número que quisiera. El servidor las **recalcula** y las sella; de la
 *      petición solo se admite QUÉ conjunto y QUÉ período.
 *   3. **`issuedBy` / `issuedAt` sostienen un invariante** —quién firma un
 *      documento con sanción legal detrás—, y **un campo escribible desde el
 *      cliente no puede sostener un invariante**.
 *
 * La LECTURA sí va directa, protegida por reglas: son consultas de lista con
 * `tenantId` y `status`, y eso las reglas lo saben proteger entero.
 *
 * ## La cifra se calcula UNA vez, aquí
 *
 * `construirInstantanea` es **pura** —recibe documentos ya leídos y no toca
 * Firestore— y es la que usan **los dos** caminos: la corrida programada del día
 * 1 (`monthlyFinancialArchive`) y las callables. Es la misma decisión que tomó la
 * entrega 1 con el núcleo, por la misma razón mecánica: `R12` y `R16` se
 * desviaron porque **nada comparaba dos implementaciones**, y la forma de que no
 * haya nada que comparar es que no haya dos.
 *
 * `leerYConstruirInstantanea` es la envoltura que hace las lecturas. La corrida
 * programada **no la usa**: ya tiene los cargos y los asientos en la mano, y
 * pedirlos otra vez sería pagar nueve veces por mes unas lecturas que ya están
 * hechas.
 */

const db = () => getFirestore();

// ── El documento ─────────────────────────────────────────────────────────────

/**
 * Los cuatro estados de §6. **`anulado` es terminal**: de él no se sale.
 *
 * `publicado` existe ya en el tipo aunque **la entrega 2 no lo produce** — la
 * publicación es la entrega 3. Está aquí porque las guardas que sí se escriben
 * ahora (firmar, anular) tienen que decir qué hacen con él, y descubrirlo
 * después obligaría a releer las tres funciones.
 */
export type EstadoDelInforme = "borrador" | "emitido" | "publicado" | "anulado";

/** Una línea del estado financiero: la cuenta del plan, su nombre y el monto. */
export type LineaDelInforme = { code: string; label: string; amount: number };

export type UnidadConDeuda = {
  unitId: string;
  unitLabel: string;
  balance: number;
  periods: number;
};

export type DeudaAProveedor = {
  vendorId?: string;
  vendorName: string;
  amount: number;
};

/**
 * Las cifras del informe. **Esto es lo que se congela al emitir.**
 *
 * `openingBalance` es un `number` y **nunca `undefined`** —cero si no hay dato—,
 * y quien distingue es `openingBalanceSource`. La distinción es `CA4` y `RN-09`:
 * un cero registrado a propósito y la ausencia de dato se pintan distinto, y
 * guardar `undefined` obligaría a cada lector a reinventar la diferencia.
 */
export type InstantaneaDelInforme = {
  openingBalance: number;
  openingBalanceSource: "registrado" | "ausente";
  closingBalance: number;
  income: LineaDelInforme[];
  expenses: LineaDelInforme[];
  totalIncome: number;
  totalExpenses: number;
  netResult: number;
  receivables: { total: number; byUnit: UnidadConDeuda[] };
  payables: { total: number; overdue: number; byVendor: DeudaAProveedor[] };
};

export type FirmaDelInforme = {
  uid: string;
  name: string;
  role: string;
  signedAt: Timestamp;
};

// ── Las formas de entrada, laxas a propósito ────────────────────────────────
//
// Igual que en el núcleo: lo que llega es `doc.data()`, que no está tipado.
// Exigir aquí el tipo del cliente obligaría a importarlo desde `src/`, y eso no
// se puede.

export type CargoDelInforme = {
  period?: string;
  balance?: number;
  status?: string;
  unitId?: string;
  unitLabel?: string;
  paymentAmount?: number;
};

export type EgresoDelInforme = {
  amount?: number;
  status?: string;
  dueDate?: string;
  vendorId?: string;
  vendorName?: string;
};

export type SaldoDelInforme = { openingBalance?: number };

export type DatosDelInforme = {
  /** `YYYY-MM`. */
  period: string;
  /** **Todos** los cargos del conjunto, no solo los del mes: la cartera es acumulada. */
  cargos: ReadonlyArray<CargoDelInforme>;
  /** Los asientos del libro **del mes**. */
  asientos: ReadonlyArray<AsientoDelNucleo>;
  /** El recaudo del mes que sale de Cartera. */
  recaudado: number;
  /** Los documentos de `bankAccountBalances` del conjunto. */
  saldos: ReadonlyArray<SaldoDelInforme>;
  /** Los egresos del conjunto. */
  egresos: ReadonlyArray<EgresoDelInforme>;
  plan?: PlanParaInformes;
};

/**
 * Suma el saldo de apertura de las cuentas del conjunto.
 *
 * **Devuelve `undefined` cuando no hay NINGÚN documento de saldo**, no cero.
 * Sumar sobre una lista vacía da `0` y afirmaría que el conjunto abrió sin un
 * peso — que es una afirmación que nadie hizo (`CA4`). Es la misma lógica que ya
 * corre dentro de `monthlyFinancialArchive`, extraída aquí para que los dos
 * caminos no puedan discrepar.
 */
export function sumarSaldoDeApertura(
  saldos: ReadonlyArray<SaldoDelInforme>,
): number | undefined {
  let acumulado = 0;
  let alguno = false;
  for (const s of saldos) {
    const v = s.openingBalance;
    if (typeof v !== "number" || !Number.isFinite(v)) continue;
    acumulado += v;
    alguno = true;
  }
  return alguno ? acumulado : undefined;
}

/**
 * El detalle de cartera por unidad.
 *
 * **El total NO se recalcula desde aquí**: lo da `sumarCuentasPorCobrar`, del
 * núcleo, que es la misma función que alimenta la tarjeta de Cartera y el
 * resumen. Dos formas de sumar la misma deuda acaban discrepando, y entonces el
 * informe se contradice consigo mismo entre el total y el desglose.
 *
 * El desglose aplica **los mismos dos filtros** que el total —fuera `cancelled`,
 * fuera `paid`, y el saldo topado en cero por cargo— porque si no, la suma de las
 * filas no daría el total impreso al lado.
 */
export function detallarCarteraPorUnidad(
  cargos: ReadonlyArray<CargoDelInforme>,
): UnidadConDeuda[] {
  const porUnidad = new Map<string, { label: string; balance: number; periods: Set<string> }>();
  for (const c of cargos) {
    if (c.status === "cancelled" || c.status === "paid") continue;
    const saldo = c.balance ?? 0;
    if (saldo <= 0) continue;
    const id = c.unitId ?? "";
    const e = porUnidad.get(id) ?? { label: c.unitLabel ?? id, balance: 0, periods: new Set<string>() };
    e.balance += saldo;
    if (c.period) e.periods.add(c.period);
    porUnidad.set(id, e);
  }
  return Array.from(porUnidad.entries())
    .map(([unitId, e]) => ({
      unitId,
      unitLabel: e.label,
      balance: aCentimos(e.balance),
      periods: e.periods.size,
    }))
    .sort((a, b) => b.balance - a.balance);
}

/**
 * El detalle de la deuda a proveedores, y **lo vencido**.
 *
 * **La fuente son los EGRESOS, no `vendors`** — `R5` se falsificó al medir: la
 * colección tiene cero filas y ningún egreso lleva `vendorId`, pero la deuda
 * existe y está en las facturas en `registrado`. Por eso se agrupa por
 * `vendorName`, que el egreso conserva como copia congelada, y quien no lo trae
 * cae en un cajón nombrado en vez de desaparecer del desglose.
 *
 * **`overdue` se mide contra el ÚLTIMO DÍA DEL PERÍODO, no contra hoy.** Un
 * informe de marzo emitido en junio diría, con «hoy», que estaba vencido lo que
 * en marzo no lo estaba — y las cifras congeladas dejarían de describir el mes
 * que dicen describir. Un egreso **sin `dueDate` no cuenta como vencido**: no se
 * sabe cuándo vencía, y afirmarlo sería inventarlo.
 */
export function detallarDeudaAProveedores(
  egresos: ReadonlyArray<EgresoDelInforme>,
  finDelPeriodo: string,
): { overdue: number; byVendor: DeudaAProveedor[] } {
  const porProveedor = new Map<string, { vendorId?: string; amount: number }>();
  let vencido = 0;
  for (const e of egresos) {
    // El catálogo es castellano: `registrado | pagado | anulado`. Filtrar en
    // inglés no excluye nada — la lección que triplicó la cifra al medir.
    if (e.status !== "registrado") continue;
    const monto = e.amount ?? 0;
    const nombre = (e.vendorName ?? "").trim() || "Sin proveedor identificado";
    const actual = porProveedor.get(nombre) ?? { vendorId: e.vendorId, amount: 0 };
    actual.amount += monto;
    porProveedor.set(nombre, actual);
    if (e.dueDate && e.dueDate.slice(0, 10) <= finDelPeriodo) vencido += monto;
  }
  return {
    overdue: aCentimos(vencido),
    byVendor: Array.from(porProveedor.entries())
      .map(([vendorName, v]) => ({
        ...(v.vendorId ? { vendorId: v.vendorId } : {}),
        vendorName,
        amount: aCentimos(v.amount),
      }))
      .sort((a, b) => b.amount - a.amount),
  };
}

/** El último día del mes de `YYYY-MM`, como `YYYY-MM-DD`. */
export function finDelPeriodo(period: string): string {
  const [y, m] = period.split("-").map((n) => Number(n));
  // Día 0 del mes siguiente = último día de este. Vale para febrero y bisiestos
  // sin tabla de días, que es donde una tabla escrita a mano se equivoca.
  const d = new Date(Date.UTC(y, m, 0));
  return d.toISOString().slice(0, 10);
}

/**
 * Construye las cifras del informe. **Pura**: no lee Firestore ni mira el reloj.
 *
 * Que sea pura es lo que la hace comprobable con números escritos a mano, que es
 * lo que pide `CA1` —«no vale comprobar que existe un import»— y lo que permite
 * que la corrida programada y la callable **compartan la implementación en vez de
 * parecerse**.
 */
export function construirInstantanea(datos: DatosDelInforme): InstantaneaDelInforme {
  const saldoInicial = sumarSaldoDeApertura(datos.saldos);

  const estado = construirEstadoFinanciero({
    asientos: datos.asientos,
    cuota: datos.recaudado,
    openingBalance: saldoInicial,
    plan: datos.plan,
    pendingReceivables: sumarCuentasPorCobrar(datos.cargos),
    supplierDebt: sumarDeudaAProveedores(datos.egresos),
  });

  const proveedores = detallarDeudaAProveedores(datos.egresos, finDelPeriodo(datos.period));

  return {
    // Cero cuando no hay dato, y `openingBalanceSource` es quien lo dice. Ver
    // el comentario del tipo: la distinción va en un campo, no en un `undefined`.
    openingBalance: estado.openingBalance ?? 0,
    openingBalanceSource: estado.openingBalanceSource,
    // `fundBalance` ES el saldo final. El nombre distinto es la razón de que
    // buscar `closingBalance` en el repositorio diera cero (§2, hallazgo 3).
    closingBalance: estado.fundBalance,
    income: estado.incomeByCategory.map((c) => ({ code: c.category, label: c.label, amount: c.amount })),
    expenses: estado.expenseByCategory.map((c) => ({ code: c.category, label: c.label, amount: c.amount })),
    totalIncome: estado.totalIncome,
    totalExpenses: estado.totalExpenses,
    netResult: estado.netResult,
    receivables: {
      total: estado.pendingReceivables,
      byUnit: detallarCarteraPorUnidad(datos.cargos),
    },
    payables: {
      total: estado.supplierDebt,
      overdue: proveedores.overdue,
      byVendor: proveedores.byVendor,
    },
  };
}

// ── Las lecturas ─────────────────────────────────────────────────────────────

/**
 * Lee lo que el informe necesita y construye la instantánea.
 *
 * La usan las callables, que no tienen nada leído. La corrida programada **no**:
 * ya trae los cargos y los asientos, y volver a pedirlos sería pagar dos veces.
 */
export async function leerYConstruirInstantanea(
  tenantId: string,
  period: string,
  plan?: PlanParaInformes,
): Promise<InstantaneaDelInforme> {
  const firestore = db();
  const [cargosSnap, asientosSnap, saldosSnap, egresosSnap] = await Promise.all([
    firestore.collection("billingStatements").where("tenantId", "==", tenantId).get(),
    firestore.collection("ledgerEntries").where("tenantId", "==", tenantId).get(),
    firestore.collection("bankAccountBalances").where("tenantId", "==", tenantId).get(),
    firestore.collection("expenses").where("tenantId", "==", tenantId).get(),
  ]);

  const cargos = cargosSnap.docs.map((d) => d.data() as CargoDelInforme);
  // El recaudo del mes, con la MISMA fórmula que la corrida programada:
  // `paymentAmount` topado en cero. Se cuenta sobre los cargos del período.
  const delMes = cargos.filter((c) => c.period === period);
  const recaudado = delMes.reduce((a, c) => a + Math.max(c.paymentAmount ?? 0, 0), 0);

  const asientos = asientosSnap.docs
    .map((d) => d.data() as AsientoDelNucleo & { date?: string })
    .filter((e) => (e.date ?? "").slice(0, 7) === period);

  return construirInstantanea({
    period,
    cargos,
    asientos,
    recaudado,
    saldos: saldosSnap.docs.map((d) => d.data() as SaldoDelInforme),
    egresos: egresosSnap.docs.map((d) => d.data() as EgresoDelInforme),
    plan,
  });
}

// ── El identificador ─────────────────────────────────────────────────────────

/**
 * El id del informe **es determinista**: `<tenantId>_<period>`.
 *
 * No es cosmética. Un conjunto tiene **un** informe por mes, y dejar que
 * Firestore genere el id permitiría dos borradores del mismo período —dos
 * corridas, dos regeneraciones, un reintento— y entonces «el informe de marzo»
 * deja de ser una cosa. Con el id derivado, la segunda corrida **encuentra** la
 * primera en vez de duplicarla, y la guarda de estado decide qué hacer con ella.
 *
 * Es el mismo patrón de idempotencia del paz y salvo y del reparto: **el id ES
 * la clave**.
 */
export function idDelInforme(tenantId: string, period: string): string {
  return `${tenantId}_${period}`;
}

const PERIODO_VALIDO = /^\d{4}-(0[1-9]|1[0-2])$/;

export function assertPeriodoValido(period: string): void {
  if (!PERIODO_VALIDO.test(period)) {
    throw new HttpsError("invalid-argument", "El período debe tener la forma AAAA-MM.");
  }
}

// ── Guardar el borrador ──────────────────────────────────────────────────────

/**
 * Escribe (o refresca) el borrador del período.
 *
 * **Nunca toca un informe que no esté en `borrador`.** Es `RN-05` visto desde el
 * otro lado: si la corrida del día 1 pudiera reescribir un informe ya emitido,
 * las cifras congeladas no lo estarían — bastaría esperar al mes siguiente para
 * que cambiaran solas. Devuelve `false` y no escribe.
 *
 * `merge: false` a propósito: un borrador que se regenera **sustituye** sus
 * cifras. Con `merge` sobrevivirían líneas de una versión anterior que ya no
 * existen —una cuenta del plan que se quedó sin asientos—, y el informe diría
 * una deuda que nadie tiene.
 */
export async function guardarBorrador(input: {
  tenantId: string;
  period: string;
  instantanea: InstantaneaDelInforme;
  actorUid: string;
}): Promise<{ escrito: boolean; motivo?: EstadoDelInforme }> {
  const ref = db().collection("monthlyReports").doc(idDelInforme(input.tenantId, input.period));
  const snap = await ref.get();
  const previo = snap.data() as { status?: EstadoDelInforme; createdAt?: Timestamp } | undefined;
  if (previo?.status && previo.status !== "borrador") {
    return { escrito: false, motivo: previo.status };
  }

  await ref.set(
    {
      tenantId: input.tenantId,
      period: input.period,
      status: "borrador" satisfies EstadoDelInforme,
      ...input.instantanea,
      generatedBy: input.actorUid,
      generatedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      // **`createdAt` se arrastra a mano, y no sobra.** Con `merge: false` el
      // documento se sustituye entero, así que regenerar un borrador borraría
      // la fecha en que nació y el informe diría haberse creado la última vez
      // que alguien pulsó «regenerar».
      createdAt: previo?.createdAt ?? FieldValue.serverTimestamp(),
    },
    { merge: false },
  );
  return { escrito: true };
}

// ── Emitir ───────────────────────────────────────────────────────────────────

export type InformeParaEmitir = {
  instantanea: InstantaneaDelInforme;
  /** El que ya estaba, para saber si esto es un reintento. */
  yaEmitido: boolean;
};

/**
 * Comprueba que se pueda emitir y **recalcula las cifras**. No escribe nada.
 *
 * Se parte en dos —preparar aquí, sellar después— porque entre las dos cosas hay
 * que construir el PDF y archivarlo, y el archivador vive en `index.ts` con la
 * carpeta de sistema y el bucket. Sellar primero dejaría un informe `emitido`
 * **sin PDF** si el archivo fallara, que es la peor de las dos mitades: un
 * documento que la ley obliga a publicar, marcado como emitido, y sin nada que
 * enseñar.
 *
 * **Las cifras se recalculan aquí y NO se toman del borrador.** El borrador lo
 * escribió una corrida de hace días; entre medias el administrador corrigió
 * asientos —que es exactamente lo que el flujo le pide hacer— y emitir cifras
 * viejas sellaría como definitivo lo que él acaba de arreglar. Y del cliente no
 * llega ni una cifra: solo qué conjunto y qué período.
 */
export async function prepararEmision(input: {
  tenantId: string;
  period: string;
  plan?: PlanParaInformes;
}): Promise<InformeParaEmitir> {
  assertPeriodoValido(input.period);
  const ref = db().collection("monthlyReports").doc(idDelInforme(input.tenantId, input.period));
  const snap = await ref.get();
  const estado = (snap.data() as { status?: EstadoDelInforme } | undefined)?.status;

  if (estado === "anulado") {
    throw new HttpsError(
      "failed-precondition",
      "Ese informe está anulado. Un informe anulado no se reemite: se genera y se emite uno nuevo.",
    );
  }
  if (estado === "emitido" || estado === "publicado") {
    return { instantanea: snap.data() as unknown as InstantaneaDelInforme, yaEmitido: true };
  }

  // Sin borrador no se emite. El borrador no es un trámite: es la versión que
  // alguien miró antes de firmar, y emitir sin él sería firmar sin haber visto.
  if (!snap.exists) {
    throw new HttpsError(
      "failed-precondition",
      "No hay borrador de ese período. Genéralo antes de emitir.",
    );
  }

  return {
    instantanea: await leerYConstruirInstantanea(input.tenantId, input.period, input.plan),
    yaEmitido: false,
  };
}

/**
 * Sella la emisión: estado, cifras congeladas, firmante y PDF.
 *
 * **Va en transacción y vuelve a comprobar el estado dentro.** Entre `prepararEmision`
 * y esto pasan las lecturas del informe y la construcción del PDF —cientos de
 * milisegundos—, y en ese hueco cabe otra pestaña emitiendo el mismo período. Sin
 * la relectura, el segundo sobrescribiría las cifras del primero **después** de que
 * el primero ya archivó su PDF, y quedarían un documento y un informe diciendo cosas
 * distintas del mismo mes.
 */
export async function sellarEmision(input: {
  tenantId: string;
  period: string;
  instantanea: InstantaneaDelInforme;
  actorUid: string;
  documentId: string;
}): Promise<void> {
  const firestore = db();
  const ref = firestore.collection("monthlyReports").doc(idDelInforme(input.tenantId, input.period));

  await firestore.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const estado = (snap.data() as { status?: EstadoDelInforme } | undefined)?.status;
    if (estado !== "borrador") {
      throw new HttpsError(
        "failed-precondition",
        estado === "anulado"
          ? "Ese informe fue anulado mientras se emitía."
          : "Ese informe ya fue emitido.",
      );
    }
    tx.update(ref, {
      status: "emitido" satisfies EstadoDelInforme,
      ...input.instantanea,
      issuedBy: input.actorUid,
      issuedAt: FieldValue.serverTimestamp(),
      documentId: input.documentId,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
}

// ── Firmar ───────────────────────────────────────────────────────────────────

export type FirmarResultado = { ok: true; yaFirmado: boolean };

/**
 * Deja constancia de que alguien aprobó el informe.
 *
 * **`RN-12`: esto es constancia, no firma electrónica certificada.** Guarda
 * quién, con qué cargo y cuándo; no promete validez jurídica de firma, y el PDF
 * lo dice con esas palabras.
 *
 * **El nombre y el cargo los pone el SERVIDOR, leídos de la membresía.** Si
 * vinieran en la petición, cualquiera firmaría como «Presidente del consejo»
 * mandando ese texto — y el bloque de firmas de un documento con sanción legal
 * detrás dejaría de significar nada.
 *
 * **Solo se firma lo `emitido` o lo `publicado`.** Un borrador no: sus cifras
 * todavía cambian, y una firma sobre cifras que cambian no dice nada. Un anulado
 * tampoco: ya no hay nada que aprobar.
 *
 * **Idempotente por uid**: firmar dos veces no añade dos filas ni mueve la fecha
 * de la primera.
 */
export async function firmarInforme(input: {
  tenantId: string;
  reportId: string;
  actorUid: string;
  actorName: string;
  actorRole: string;
}): Promise<FirmarResultado> {
  const firestore = db();
  const ref = firestore.collection("monthlyReports").doc(input.reportId);

  return firestore.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "Ese informe no existe.");
    const informe = snap.data() as { tenantId?: string; status?: EstadoDelInforme; signatures?: FirmaDelInforme[] };

    if (informe.tenantId !== input.tenantId) {
      throw new HttpsError("permission-denied", "Ese informe no pertenece a este conjunto.");
    }
    if (informe.status !== "emitido" && informe.status !== "publicado") {
      throw new HttpsError(
        "failed-precondition",
        informe.status === "borrador"
          ? "Un borrador no se firma: sus cifras todavía pueden cambiar. Emítelo primero."
          : "Ese informe está anulado y ya no se firma.",
      );
    }

    const firmas = informe.signatures ?? [];
    if (firmas.some((f) => f.uid === input.actorUid)) {
      return { ok: true as const, yaFirmado: true };
    }

    tx.update(ref, {
      // `arrayUnion` no sirve: sus elementos llevan `signedAt`, y dos firmas de
      // la misma persona en instantes distintos serían objetos distintos, así
      // que no deduplicaría nada. La deduplicación por uid es la de arriba.
      signatures: [
        ...firmas,
        {
          uid: input.actorUid,
          name: input.actorName,
          role: input.actorRole,
          // Dentro de un array no se puede usar `serverTimestamp()` —Firestore
          // lo rechaza—, así que la marca la pone el servidor con su propio
          // reloj. Sigue sin ser falsificable desde el cliente, que es lo que
          // importa.
          signedAt: Timestamp.now(),
        },
      ],
      updatedAt: FieldValue.serverTimestamp(),
    });
    return { ok: true as const, yaFirmado: false };
  });
}

// ── Anular ───────────────────────────────────────────────────────────────────

export type AnularInformeResultado = { ok: true; yaAnulado: boolean };

/**
 * Anula un informe emitido, **con motivo obligatorio** (`RN-06`, `CA16`).
 *
 * **No se borra, se marca** (`RN-14`, y la lección de «archivar no es esconder»).
 * Un informe emitido salió del sistema: lo vio el consejo, quizá lo vio la
 * comunidad. Borrar el registro dejaría al conjunto sin forma de saber que ese
 * papel existió y fue retirado — que es justo lo que un tercero preguntaría.
 *
 * **El motivo se exige en el SERVIDOR** y no solo en el formulario: `CA16` dice
 * exactamente eso, y un formulario es una sugerencia para quien llama por HTTP.
 */
export async function anularInforme(input: {
  tenantId: string;
  reportId: string;
  reason: string;
  actorUid: string;
}): Promise<AnularInformeResultado> {
  const motivo = (input.reason ?? "").trim();
  if (!motivo) throw new HttpsError("invalid-argument", "Anular un informe exige un motivo.");

  const firestore = db();
  const ref = firestore.collection("monthlyReports").doc(input.reportId);

  return firestore.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "Ese informe no existe.");
    const informe = snap.data() as { tenantId?: string; status?: EstadoDelInforme };

    if (informe.tenantId !== input.tenantId) {
      throw new HttpsError("permission-denied", "Ese informe no pertenece a este conjunto.");
    }
    if (informe.status === "anulado") {
      return { ok: true as const, yaAnulado: true };
    }
    // Un borrador no se anula: se regenera. Anularlo dejaría un estado terminal
    // sobre algo que nunca afirmó nada, y bloquearía el período entero — la
    // corrida del mes siguiente no puede escribir sobre un `anulado`.
    if (informe.status === "borrador") {
      throw new HttpsError(
        "failed-precondition",
        "Un borrador no se anula: no ha afirmado nada todavía. Regenéralo o emítelo.",
      );
    }

    tx.update(ref, {
      status: "anulado" satisfies EstadoDelInforme,
      voidReason: motivo,
      voidedBy: input.actorUid,
      voidedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return { ok: true as const, yaAnulado: false };
  });
}

// ── Cómo se LEE el informe en el PDF ────────────────────────────────────────

/** `RN-12`. Va impreso: quien reciba el papel tiene que saber qué NO es. */
export const PIE_DEL_INFORME =
  "Las firmas de este documento son constancia de quién lo emitió y quién lo aprobó dentro de Vivaru, " +
  "con nombre, cargo y fecha selladas por el sistema. No constituyen firma electrónica certificada.";

/**
 * Las cifras de cabecera: el estado de caja anclado al banco.
 *
 * **`CA4` en una línea:** sin saldo registrado se escribe «Sin saldo bancario de
 * apertura», **no «$0»**. La diferencia entre un cero que alguien registró y la
 * ausencia de dato es lo que separa un estado de caja de un tablero de indicadores.
 */
export function filasDeCabecera(i: InstantaneaDelInforme): [string, string][] {
  return [
    [
      "Saldo inicial del banco",
      i.openingBalanceSource === "registrado" ? formatearMonto(i.openingBalance) : "Sin saldo bancario de apertura",
    ],
    ["Ingresos del mes", formatearMonto(i.totalIncome)],
    ["Egresos del mes", formatearMonto(i.totalExpenses)],
    ["Resultado neto del mes", formatearMonto(i.netResult)],
    // `RN-03` · la identidad se ENSEÑA como tal, no solo se cumple.
    //
    // **El signo va con el GUION ASCII, y no es un descuido tipográfico.** Aquí
    // había un menos de verdad (`−`, U+2212) y en el PDF salía **`ˆ`**: las
    // fuentes estándar de `pdfkit` van en **WinAnsi**, que no tiene ese carácter.
    // Lo cazó mirar el PDF; las 824 pruebas en verde no lo veían, porque ninguna
    // miraba el papel. Lo vigila `caracteresDelPdf` en el banco.
    ["Saldo final del fondo (inicial + ingresos - egresos)", formatearMonto(i.closingBalance)],
  ];
}

/**
 * Las cuatro secciones del informe.
 *
 * **Las cuatro van SIEMPRE, también en cero** (`RN-08`, `CA8`): un cero calculado
 * dice «no se debe nada» y una sección ausente dice «esto no se mide», y para un
 * consejo son dos cosas distintas. El PDF pinta «Sin movimientos en el período»
 * cuando la lista viene vacía, en vez de saltarse el bloque.
 *
 * **Los egresos salen en el orden del PLAN, no por monto** (`RN-07`): ya vienen
 * ordenados del núcleo, que compara por el código de cuenta. Reordenar aquí por
 * importe desharía justo lo que la entrega 1 construyó.
 */
export function seccionesDelInforme(i: InstantaneaDelInforme): {
  title: string;
  rows: [string, string][];
  total?: [string, string];
}[] {
  return [
    {
      title: "Ingresos por cuenta",
      rows: i.income.map((l) => [l.label, formatearMonto(l.amount)] as [string, string]),
      total: ["Total de ingresos", formatearMonto(i.totalIncome)],
    },
    {
      title: "Egresos por cuenta",
      rows: i.expenses.map((l) => [l.label, formatearMonto(l.amount)] as [string, string]),
      total: ["Total de egresos", formatearMonto(i.totalExpenses)],
    },
    {
      title: "Cuentas pendientes de cobro",
      rows: i.receivables.byUnit.map(
        (u) =>
          [
            `${u.unitLabel} · ${u.periods} ${u.periods === 1 ? "período" : "períodos"}`,
            formatearMonto(u.balance),
          ] as [string, string],
      ),
      total: ["Total por cobrar", formatearMonto(i.receivables.total)],
    },
    {
      title: "Deuda a proveedores",
      rows: i.payables.byVendor.map((v) => [v.vendorName, formatearMonto(v.amount)] as [string, string]),
      total: [
        `Total por pagar (vencido: ${formatearMonto(i.payables.overdue)})`,
        formatearMonto(i.payables.total),
      ],
    },
  ];
}


/**
 * El importe tal y como se imprime. **Vive aquí y no en `index.ts`** para que la
 * callable y cualquier comprobación usen EL MISMO, en vez de dos que acaben
 * discrepando — que es la enfermedad entera que esta ficha vino a curar.
 *
 * Es la misma forma que `formatMoney` del archivo mensual, y se queda en `es-CO`
 * a propósito: cambiar aquí el formato por país es de otra ficha, y hacerlo a
 * escondidas dentro de ésta movería cifras sin que nadie lo hubiera pedido.
 */
export function formatearMonto(value: number): string {
  return `$${Math.round(value).toLocaleString("es-CO")}`;
}
