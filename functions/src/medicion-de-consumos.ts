import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { cuentaParaConcepto } from "./plan-de-cuentas";
import { HttpsError } from "firebase-functions/v2/https";

/**
 * `PRD-V-FEAT-008` entrega 1 — medición de consumos con foto del medidor.
 *
 * Sale de **§3.5 de la sesión con la administradora**, que es su cuello de
 * botella declarado y la respuesta a «¿qué le lleva más trabajo?»: recorre los
 * medidores, los fotografía y **manda las fotos por correo en un archivo
 * aparte**, porque no hay dónde ponerlas.
 *
 * ## Por qué esto es una callable y no una escritura del cliente
 *
 * La ficha decía «escritura directa» y **se corrigió antes de escribir código**.
 * Lo que la tumbó no fue `consumption` —que es lo obvio— sino **`previous`**:
 * `CA3` exige que la lectura anterior **la ponga el sistema**, y si viajara en la
 * petición el cliente podría fijar el consumo que quisiera **sin tocar el campo
 * calculado**. Los dos deciden dinero juntos, así que los escribe el mismo lado.
 *
 * ## Lo que este módulo NO hace, y es deliberado
 *
 * No cobra. La entrega 1 solo registra lecturas con su foto y calcula el
 * consumo — y eso ya resuelve el dolor, porque deja de mandar fotos por correo
 * desde el primer día. El cargo derivado es la entrega 2, y va después de que
 * las lecturas sean fiables.
 */

export type EstadoDePeriodo = "abierto" | "cerrado" | "cobrado" | "anulado";

export type Lectura = {
  tenantId: string;
  serviceId: string;
  unitId: string;
  period: string;
  previous: number;
  current: number;
  consumption: number;
  photoUrl?: string;
  status: EstadoDePeriodo;
};

/** `YYYY-MM`. Se valida aquí porque de él cuelga la búsqueda del período anterior. */
export function esPeriodoValido(period: string): boolean {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) return false;
  const anio = Number(period.slice(0, 4));
  return anio >= 2000 && anio <= 2100;
}

/** El período inmediatamente anterior. Diciembre retrocede de año. */
export function periodoAnterior(period: string): string {
  const anio = Number(period.slice(0, 4));
  const mes = Number(period.slice(5, 7));
  return mes === 1
    ? `${anio - 1}-12`
    : `${anio}-${String(mes - 1).padStart(2, "0")}`;
}

/**
 * El consumo. **`RN-03`: una lectura menor que la anterior avisa pero NO
 * bloquea** — un medidor que completa su vuelta es real, y bloquearlo dejaría al
 * administrador sin forma de registrar ese mes.
 *
 * Cuando eso pasa, el consumo del período **no se puede derivar de la
 * diferencia**: sería negativo. Se devuelve `0` y se marca `reinicio`, para que
 * quien lo mire sepa que ese mes hay que revisarlo a mano en vez de encontrarse
 * un número inventado.
 */
export function calcularConsumo(previous: number, current: number): {
  consumption: number;
  reinicio: boolean;
} {
  if (current < previous) return { consumption: 0, reinicio: true };
  return { consumption: redondear(current - previous), reinicio: false };
}

/**
 * Tres decimales. **No se usa `toFixed` sobre el float directamente**: en
 * `4.3 - 1.1` da `3.1999999999999997`, y ese número acabaría multiplicado por
 * una tarifa y convertido en dinero.
 */
export function redondear(valor: number): number {
  return Math.round(valor * 1000) / 1000;
}

/** El importe. Es lo que Habitanto —textual— «no nos calcula». */
export function importeDelConsumo(consumption: number, rate: number): number {
  return Math.round(consumption * rate);
}

/**
 * `RN-09` — **la foto es obligatoria para CERRAR el período, no para guardar la
 * lectura** (decisión de David, 9 sep 2026). Recorre los medidores caminando, a
 * veces en varios días y en sótanos sin señal: exigirla en cada tecleo le haría
 * perder el recorrido entero.
 *
 * Devuelve **las unidades que faltan, nombradas**, igual que hace el reparto por
 * coeficiente cuando falta un coeficiente. Un «no se puede cerrar» sin decir
 * cuál obliga a buscar a mano entre noventa y tres.
 */
export function unidadesSinFoto(lecturas: Array<{ unitId: string; photoUrl?: string }>): string[] {
  return lecturas.filter((l) => !l.photoUrl).map((l) => l.unitId);
}

/**
 * Registra una lectura. `previous` y `consumption` **los pone este lado**
 * (`RN-10`, `RN-02`): lo que llega de fuera es el conjunto, el servicio, la
 * unidad, el período y la lectura actual.
 */
export async function registrarLectura(params: {
  tenantId: string;
  serviceId: string;
  unitId: string;
  period: string;
  current: number;
  photoUrl?: string;
  actorUid: string;
}): Promise<{ ok: true; consumption: number; reinicio: boolean; esLineaBase: boolean }> {
  const { tenantId, serviceId, unitId, period, current, actorUid } = params;
  const db = getFirestore();

  if (!esPeriodoValido(period)) {
    throw new HttpsError("invalid-argument", "El período debe tener la forma AAAA-MM.");
  }
  if (!Number.isFinite(current) || current < 0) {
    throw new HttpsError("invalid-argument", "La lectura debe ser un número positivo.");
  }

  const servicio = await db.collection("meteredServices").doc(serviceId).get();
  if (!servicio.exists || (servicio.data() as { tenantId?: string }).tenantId !== tenantId) {
    throw new HttpsError("not-found", "Ese servicio medido no existe en este conjunto.");
  }

  // 🔴 **La unidad tiene que EXISTIR, y esto no es una validación de cortesía.**
  // `unitId` en Vivaru está partido en dos —el id del documento y un campo con
  // un slug—, y clasificarlo por su FORMA no funciona: conviven `unit-t1-101`,
  // `t1-101`, `1014` e ids sembrados que PARECEN slugs. Si aquí entrara un slug,
  // la lectura quedaría colgada de una unidad que no existe **sin dar error**, y
  // no aparecería en ninguna pantalla — que es exactamente cómo nacieron los
  // 3.580.000 de deuda que ninguna pantalla sumaba (`FIX-002`).
  //
  // Lo destapó el guardián de `clave-de-unidad`, que enrojeció al aparecer este
  // módulo. **Nada más lo comprobaba.**
  const unidad = await db.collection("units").doc(unitId).get();
  if (!unidad.exists || (unidad.data() as { tenantId?: string }).tenantId !== tenantId) {
    throw new HttpsError("not-found", "Esa unidad no existe en este conjunto.");
  }

  // `RN-05` — un período ya cobrado no se edita. El cargo ya salió: cambiar su
  // respaldo reescribiría la prueba de una deuda.
  const idLectura = `${tenantId}_${serviceId}_${unitId}_${period}`;
  const previa = await db.collection("meterReadings").doc(idLectura).get();
  if (previa.exists && (previa.data() as { status?: string }).status === "cobrado") {
    throw new HttpsError("failed-precondition", "Ese período ya se cobró: su lectura no se edita.");
  }

  // `RN-10` — la lectura anterior la busca el servidor, no llega en la petición.
  const anterior = await db
    .collection("meterReadings")
    .doc(`${tenantId}_${serviceId}_${unitId}_${periodoAnterior(period)}`)
    .get();

  // `RN-04` — sin lectura anterior, ésta es LÍNEA BASE y no genera cargo.
  // Cobrar el acumulado del medidor le cobraría a quien vive hoy el consumo de
  // quien vivió antes.
  const esLineaBase = !anterior.exists;
  const previous = esLineaBase ? current : (anterior.data() as { current: number }).current;
  const { consumption, reinicio } = calcularConsumo(previous, current);

  await db.collection("meterReadings").doc(idLectura).set(
    {
      tenantId,
      serviceId,
      unitId,
      period,
      previous,
      current,
      consumption: esLineaBase ? 0 : consumption,
      esLineaBase,
      reinicio,
      ...(params.photoUrl ? { photoUrl: params.photoUrl } : {}),
      status: "abierto",
      readAt: Timestamp.now(),
      readBy: actorUid,
      updatedAt: Timestamp.now(),
    },
    { merge: true },
  );

  return { ok: true, consumption: esLineaBase ? 0 : consumption, reinicio, esLineaBase };
}

/**
 * Cierra el período. **Aquí sí muerde la foto** (`RN-09`): si falta alguna, se
 * deniega nombrando las unidades.
 */
export async function cerrarPeriodo(params: {
  tenantId: string;
  serviceId: string;
  period: string;
  actorUid: string;
}): Promise<{ ok: true; lecturas: number }> {
  const { tenantId, serviceId, period, actorUid } = params;
  const db = getFirestore();

  const snap = await db
    .collection("meterReadings")
    .where("tenantId", "==", tenantId)
    .where("serviceId", "==", serviceId)
    .where("period", "==", period)
    .get();

  if (snap.empty) {
    throw new HttpsError("failed-precondition", "No hay ninguna lectura registrada en este período.");
  }

  const lecturas = snap.docs.map((d) => d.data() as { unitId: string; photoUrl?: string; status?: string });
  if (lecturas.some((l) => l.status === "cobrado")) {
    throw new HttpsError("failed-precondition", "Ese período ya se cobró.");
  }

  const faltan = unidadesSinFoto(lecturas);
  if (faltan.length > 0) {
    const lista = faltan.slice(0, 8).join(", ");
    const resto = faltan.length > 8 ? ` y ${faltan.length - 8} más` : "";
    throw new HttpsError(
      "failed-precondition",
      `Faltan las fotos de ${faltan.length} ${faltan.length === 1 ? "unidad" : "unidades"}: ${lista}${resto}.`,
    );
  }

  const lote = db.batch();
  for (const d of snap.docs) {
    lote.set(d.ref, { status: "cerrado", closedAt: Timestamp.now(), closedBy: actorUid }, { merge: true });
  }
  await lote.commit();

  return { ok: true, lecturas: snap.size };
}

/** Reabre un período cerrado. Un período `cobrado` no vuelve: `RN-05`. */
export async function reabrirPeriodo(params: {
  tenantId: string;
  serviceId: string;
  period: string;
}): Promise<{ ok: true; lecturas: number }> {
  const db = getFirestore();
  const snap = await db
    .collection("meterReadings")
    .where("tenantId", "==", params.tenantId)
    .where("serviceId", "==", params.serviceId)
    .where("period", "==", params.period)
    .get();

  if (snap.docs.some((d) => (d.data() as { status?: string }).status === "cobrado")) {
    throw new HttpsError("failed-precondition", "Ese período ya se cobró y no se reabre.");
  }

  const lote = db.batch();
  for (const d of snap.docs) {
    lote.set(d.ref, { status: "abierto", closedAt: FieldValue.delete(), closedBy: FieldValue.delete() }, { merge: true });
  }
  await lote.commit();
  return { ok: true, lecturas: snap.size };
}

// ── FEAT-008 entrega 2 · el cobro derivado del consumo ──────────────────────

export type LineaDeConsumo = {
  unitId: string;
  unitLabel: string;
  consumption: number;
  amount: number;
};

export type RepartoPorConsumo = {
  lines: LineaDeConsumo[];
  total: number;
  totalConsumo: number;
  /** Unidades activas SIN lectura en el período. `RN-06`: se nombran. */
  sinLectura: string[];
};

/**
 * `RN-01` — **el cobro por consumo es una TERCERA BASE DE REPARTO**, no un
 * mecanismo nuevo. `BillingCampaign` ya lleva `distributionBasis`,
 * `totalDistributed` y `distributionBasisValue` por línea desde `FLOW-001`.
 *
 * **Y hay una diferencia con el reparto por coeficiente que conviene ver, porque
 * quita trabajo:** allí se reparte un total CONOCIDO entre las unidades, así que
 * hay que cuadrar los céntimos contra ese total y existe un ajuste de redondeo.
 * Aquí el total **se DERIVA** de la suma: cada unidad paga lo suyo y el total es
 * lo que salga. **No hay nada que cuadrar, así que no hay ajuste de redondeo** —
 * y no tenerlo no es un olvido.
 *
 * `RN-04`: las lecturas de línea base **no generan cargo**, y por eso salen de
 * la lista en vez de entrar con importe cero: un cargo de cero es un cargo que
 * alguien tiene que mirar y cerrar.
 */
export function repartirPorConsumo(
  lecturas: Array<{ unitId: string; consumption: number; esLineaBase?: boolean }>,
  rate: number,
  unidadesActivas: Array<{ id: string; unitLabel: string }>,
): RepartoPorConsumo {
  const etiqueta = new Map(unidadesActivas.map((u) => [u.id, u.unitLabel]));
  const conLectura = new Set(lecturas.map((l) => l.unitId));

  const lines = lecturas
    .filter((l) => !l.esLineaBase && l.consumption > 0)
    .map((l) => ({
      unitId: l.unitId,
      unitLabel: etiqueta.get(l.unitId) ?? l.unitId,
      consumption: l.consumption,
      amount: importeDelConsumo(l.consumption, rate),
    }))
    .sort((a, b) => a.unitLabel.localeCompare(b.unitLabel, "es"));

  return {
    lines,
    total: lines.reduce((a, l) => a + l.amount, 0),
    totalConsumo: redondear(lecturas.reduce((a, l) => a + (l.esLineaBase ? 0 : l.consumption), 0)),
    // `RN-06` — las que faltan se NOMBRAN, igual que hace el reparto por
    // coeficiente cuando falta un coeficiente. Un «faltan unidades» a secas
    // obliga a buscarlas a mano entre noventa y tres.
    sinLectura: unidadesActivas
      .filter((u) => !conLectura.has(u.id))
      .map((u) => u.unitLabel)
      .sort((a, b) => a.localeCompare(b, "es")),
  };
}

/** El id de la corrida deriva del período: dos confirmaciones no crean dos. */
export function idDeCorridaDeConsumo(tenantId: string, serviceId: string, period: string): string {
  return `consumo_${`${tenantId}_${serviceId}_${period}`.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 120)}`;
}

export type GenerarCorridaDeConsumoInput = {
  tenantId: string;
  serviceId: string;
  period: string;
  dueDate?: string;
  /** `true` = solo la vista previa; no se escribe nada. */
  dryRun?: boolean;
};

export type CorridaDeConsumoResultado = RepartoPorConsumo & {
  ok: true;
  dryRun: boolean;
  campaignId?: string;
  /** `false` en un reintento: la corrida ya existía. */
  created?: boolean;
  rate: number;
  serviceName: string;
};

/**
 * Genera la corrida de cobro del período. **El permiso lo validó `index.ts`.**
 *
 * ## Por qué hay vista previa, y no es un adorno
 *
 * Esto crea cargos de dinero sobre veintitantas unidades de golpe. El reparto
 * por coeficiente ya la tiene (`dryRun`), y por lo mismo: se mira antes de
 * confirmar, y lo que se mira incluye **a quién NO se le va a cobrar**.
 *
 * ## Idempotencia
 *
 * El id de la corrida **deriva del período** (`CA15`), así que un doble clic o
 * un reintento encuentran la corrida ya creada y devuelven lo que hay en vez de
 * cobrar dos veces. Es el mismo mecanismo que `generarCorridaPorCoeficiente`,
 * con la diferencia de que allí la clave la manda el cliente y aquí **no hace
 * falta**: el período ya identifica la corrida sin ambigüedad.
 */
export async function generarCorridaDeConsumo(
  input: GenerarCorridaDeConsumoInput,
  uid: string,
): Promise<CorridaDeConsumoResultado> {
  const db = getFirestore();
  const { tenantId, serviceId, period } = input;

  if (!esPeriodoValido(period)) {
    throw new HttpsError("invalid-argument", "El período debe tener la forma AAAA-MM.");
  }

  const servicioSnap = await db.collection("meteredServices").doc(serviceId).get();
  const servicio = servicioSnap.data() as { tenantId?: string; name?: string; rate?: number } | undefined;
  if (!servicioSnap.exists || servicio?.tenantId !== tenantId) {
    throw new HttpsError("not-found", "Ese servicio medido no existe en este conjunto.");
  }
  const rate = servicio?.rate ?? 0;
  const serviceName = servicio?.name ?? "Servicio medido";
  if (!(rate > 0)) {
    throw new HttpsError("failed-precondition", "El servicio no tiene tarifa: no se puede cobrar el consumo.");
  }

  const lecturasSnap = await db
    .collection("meterReadings")
    .where("tenantId", "==", tenantId)
    .where("serviceId", "==", serviceId)
    .where("period", "==", period)
    .get();

  if (lecturasSnap.empty) {
    throw new HttpsError("failed-precondition", "No hay ninguna lectura registrada en este período.");
  }

  const lecturas = lecturasSnap.docs.map((d) => d.data() as {
    unitId: string; consumption: number; esLineaBase?: boolean; status?: string; photoUrl?: string;
  });

  // 🔴 **EL ORDEN DE LAS DOS GUARDAS DE ABAJO SE INVIRTIÓ, y no es un detalle.**
  //
  // Primero decía «ya se cobró» y después miraba si la corrida existía. Con ese
  // orden **la idempotencia no se alcanzaba nunca**: la primera corrida deja las
  // lecturas en `cobrado`, así que el segundo clic moría en la guarda anterior
  // con un error, en vez de devolver la corrida que acababa de crear.
  //
  // No cobraba dos veces —eso estaba bien—, pero un doble clic contestaba «ese
  // período ya se cobró» a quien acababa de cobrarlo, que se lee como un fallo.
  // **Es la misma lección que `assertTenantOperable`:** dentro de un guardián,
  // el orden decide qué mensaje recibe cada caso.
  //
  // Ahora la idempotencia va primero —protege el caso FRECUENTE, el doble clic—
  // y `RN-05` queda para el caso raro: lecturas cobradas cuya corrida ya no
  // existe, que es un dato inconsistente y merece error.
  const campaignIdPrevisto = idDeCorridaDeConsumo(tenantId, serviceId, period);
  const yaExiste = !input.dryRun && (await db.collection("billingCampaigns").doc(campaignIdPrevisto).get()).exists;

  // `RN-05` — un período ya cobrado no se vuelve a cobrar.
  if (!yaExiste && lecturas.some((l) => l.status === "cobrado")) {
    throw new HttpsError("failed-precondition", "Ese período ya se cobró.");
  }

  // `RN-09` — la foto es condición para cerrar, y cobrar es cerrar y algo más.
  // Cobrar sin la evidencia dejaría cargos que nadie puede defender.
  const faltanFotos = unidadesSinFoto(lecturas);
  if (faltanFotos.length > 0) {
    const lista = faltanFotos.slice(0, 8).join(", ");
    const resto = faltanFotos.length > 8 ? ` y ${faltanFotos.length - 8} más` : "";
    throw new HttpsError(
      "failed-precondition",
      `Faltan las fotos de ${faltanFotos.length} ${faltanFotos.length === 1 ? "unidad" : "unidades"}: ${lista}${resto}.`,
    );
  }

  const unidadesSnap = await db.collection("units").where("tenantId", "==", tenantId).get();
  const unidadesActivas = unidadesSnap.docs
    .filter((d) => (d.data() as { status?: string }).status === "active")
    .map((d) => ({ id: d.id, unitLabel: (d.data() as { displayName?: string }).displayName ?? d.id }));

  const reparto = repartirPorConsumo(lecturas, rate, unidadesActivas);

  if (input.dryRun) {
    return { ok: true, dryRun: true, rate, serviceName, ...reparto };
  }

  if (reparto.lines.length === 0) {
    throw new HttpsError(
      "failed-precondition",
      "Ninguna unidad tiene consumo que cobrar en este período.",
    );
  }

  const campaignId = campaignIdPrevisto;
  const campaignRef = db.collection("billingCampaigns").doc(campaignId);
  if (yaExiste) {
    // `CA15` — un reintento devuelve lo que ya hay. No cobra dos veces.
    return { ok: true, dryRun: false, campaignId, created: false, rate, serviceName, ...reparto };
  }

  const concepto = "consumo_medido";
  const accountCode = cuentaParaConcepto(concepto).code;
  const lote = db.batch();

  lote.set(campaignRef, {
    tenantId,
    concept: concepto,
    period,
    // `unitAmount` en 0 a propósito, como la corrida por coeficiente: esto NO
    // tiene importe plano. El campo se conserva por compatibilidad con la lista.
    unitAmount: 0,
    distributionBasis: "consumption",
    totalDistributed: reparto.total,
    dueDate: input.dueDate ?? null,
    unitCount: reparto.lines.length,
    source: "immediate",
    status: "vigente",
    // De la lectura al cargo, y al revés: la otra mitad de la trazabilidad.
    sourceServiceId: serviceId,
    sentAt: FieldValue.serverTimestamp(),
    createdBy: uid,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  for (const linea of reparto.lines) {
    lote.set(db.collection("billingStatements").doc(), {
      tenantId,
      unitId: linea.unitId,
      unitLabel: linea.unitLabel,
      period,
      concept: concepto,
      accountCode,
      campaignId,
      amount: linea.amount,
      paymentAmount: 0,
      balance: linea.amount,
      // **El consumo viaja CONGELADO en el cargo**, igual que el coeficiente en
      // la corrida hermana: si mañana se corrige la lectura, este cargo sigue
      // explicando por qué vale lo que vale.
      distributionBasisValue: linea.consumption,
      ...(input.dueDate ? { dueDate: input.dueDate } : {}),
      status: "pending",
      createdBy: uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  // Las lecturas pasan a `cobrado` en el MISMO lote: si el cargo existe y la
  // lectura sigue editable, alguien podría cambiar el respaldo de una deuda.
  for (const d of lecturasSnap.docs) {
    lote.set(d.ref, { status: "cobrado", billingCampaignId: campaignId, updatedAt: Timestamp.now() }, { merge: true });
  }

  await lote.commit();

  return { ok: true, dryRun: false, campaignId, created: true, rate, serviceName, ...reparto };
}
