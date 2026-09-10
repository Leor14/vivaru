import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
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
