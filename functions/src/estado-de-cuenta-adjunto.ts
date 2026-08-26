import { type Firestore } from "firebase-admin/firestore";

/**
 * `PRD-V-FLOW-003` R9 / CF7 — de quién es el estado de cuenta que se adjunta.
 *
 * **Esto es el guardián, no una utilidad.** §12 lo llama «el peor error posible de esta PRD»:
 * mandarle a un residente el estado de cuenta de su vecino. No es un defecto, es un incidente de
 * privacidad, y no se manifiesta como un error — se manifiesta como una llamada del vecino.
 *
 * ---
 *
 * **POR QUÉ EL MOLDE DEL PRODUCTO EMPUJA JUSTO AL ERROR.** Los correos de cobranza salen por
 * `deliverResidentNotifications`, que recibe **una lista de uids** y les manda **la misma copia a
 * todos**. Es el patrón correcto para un aviso —«se generó la cuota de septiembre»— y es
 * exactamente el molde en el que un adjunto se convierte en una fuga: se resuelve una vez, fuera
 * del bucle, y sale el mismo papel para las ochenta y ocho unidades.
 *
 * **La forma de la función es la defensa.** Recibe UN uid, nunca una lista, y devuelve lo de ESE
 * residente o `null`. No existe una versión que acepte varios, y no debe existir: si algún día
 * hace falta, que sea llamándola en bucle, donde el compilador obliga a pasar cada destinatario.
 *
 * **Y la unidad NO se lee de `users`.** Ese documento no la trae —medido: `createdAt`, `email`,
 * `fullName`, `role`, `status`, `tenantId`, `uid` y nada más—. Vive en `tenantUsers`, que es
 * además contra lo que las reglas comparan. Resolverla por cualquier otra vía es la puerta por la
 * que ya entró `FIX-002`.
 */

export type DestinatarioResuelto = {
  uid: string;
  tenantId: string;
  unitId: string;
};

/**
 * La unidad de UN residente, o `null` si no se puede afirmar cuál es.
 *
 * **Devuelve `null` antes que adivinar.** Sin membresía, sin unidad asignada, o con la membresía
 * de otro conjunto, no hay respuesta correcta — y un adjunto es un documento que se entrega. La
 * ficha ya decidió lo mismo para el paz y salvo: «si la unidad no se reconoce, ya no se emite»,
 * porque antes salía vacío, daba cero y se firmaba igual.
 */
export async function unidadDelDestinatario(
  db: Firestore,
  tenantId: string,
  uid: string,
): Promise<DestinatarioResuelto | null> {
  if (!tenantId || !uid) return null;

  // El id de la membresía es `{tenantId}_{uid}` — la misma convención que exige el predicado de
  // `tenant-membership.ts`. Leer por id evita una consulta y, sobre todo, evita el modo de fallo
  // en que una consulta mal filtrada devuelve la membresía de otro conjunto.
  const snap = await db.collection("tenantUsers").doc(`${tenantId}_${uid}`).get();
  if (!snap.exists) return null;

  const d = snap.data() as { tenantId?: unknown; uid?: unknown; unitId?: unknown; status?: unknown };

  // **Las tres comprobaciones son la guarda, y ninguna es redundante.** El id ya dice el conjunto,
  // pero un documento heredado puede tener el campo discrepando del id: eso pasa el conteo laxo y
  // falla el predicado real, y está medido en este repositorio. Se comprueban los dos.
  if (d.tenantId !== tenantId) return null;
  if (d.uid !== uid) return null;
  if (d.status && d.status !== "active") return null;

  const unitId = typeof d.unitId === "string" ? d.unitId.trim() : "";
  if (!unitId) return null;

  return { uid, tenantId, unitId };
}

/**
 * Comprueba que un adjunto ya construido corresponde a su destinatario.
 *
 * **Es un cinturón sobre el tirante, y tiene motivo.** `unidadDelDestinatario` resuelve bien; lo
 * que esto ataja es el error de FONTANERÍA — resolver dentro del bucle y enviar fuera, reutilizar
 * una variable, invertir dos argumentos—. Son errores que el compilador no ve porque los dos
 * valores son `string`, y cuyo síntoma es un vecino leyendo la deuda de otro.
 *
 * Se llama **inmediatamente antes de enviar**, con lo que se va a enviar de verdad.
 */
export function adjuntoEsDelDestinatario(
  destinatario: DestinatarioResuelto,
  adjunto: { tenantId: string; unitId: string },
): boolean {
  return adjunto.tenantId === destinatario.tenantId && adjunto.unitId === destinatario.unitId;
}
