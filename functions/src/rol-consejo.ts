import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";

/**
 * `PRD-V-PLAT-004` entrega 1 — la condición de consejero.
 *
 * **Qué vive aquí y qué se queda en `index.ts`.** Aquí van las reglas sobre
 * QUIEN RECIBE la marca (`RN-02`, `RN-03`, `RN-05`, `CA10`–`CA12`, `CA15`) y la
 * escritura; en la callable se quedan la autenticación y el permiso de QUIEN
 * CONCEDE, que ya tienen guardián propio. La partición no es estética: lo de
 * aquí es lo que se puede ejercitar contra el emulador, y lo que no se ejercita
 * no está probado.
 *
 * **`RN-01`, que es la decisión que ordena la ficha entera:** `tenantUsers` tiene
 * UN documento por persona y conjunto, con UN campo `role`. Escribir
 * `role: "committee"` le quitaría al consejero su condición de residente —y con
 * ella su unidad, su estado de cuenta y sus pagos, porque `canAccessPath` exige
 * `role === "resident"` para TODO `/resident`—. Un consejero es un propietario;
 * dejarlo sin su unidad es inaceptable. Por eso la marca es un ATRIBUTO.
 */

export type ResultadoDeMarca = { ok: true; cambiado: boolean };

type Membresia = {
  role?: string;
  status?: string;
  tenantId?: string;
  isCommittee?: boolean;
};

/**
 * Concede o retira la marca de consejo sobre una membresía.
 *
 * `tenantId` llega **ya validado** por el guardián del llamador: esta función no
 * decide si el actor puede operar ese conjunto, decide si ESE DESTINATARIO puede
 * recibir la marca.
 */
export async function aplicarMarcaDeConsejo(params: {
  tenantId: string;
  actorUid: string;
  targetUid: string;
  quiereLaMarca: boolean;
  porSuperadmin?: boolean;
}): Promise<ResultadoDeMarca> {
  const { tenantId, actorUid, targetUid, quiereLaMarca } = params;
  const db = getFirestore();

  // `CA10` — nadie se nombra a sí mismo. Hoy es además imposible por
  // construcción (quien concede es administrador y quien recibe tiene que ser
  // residente: dos valores del mismo campo), pero un invariante se escribe donde
  // se lee, no se deduce de otros dos.
  if (targetUid === actorUid) {
    throw new HttpsError("permission-denied", "No puedes concederte la marca de consejo a ti mismo.");
  }

  const membershipRef = db.collection("tenantUsers").doc(`${tenantId}_${targetUid}`);
  const membershipSnap = await membershipRef.get();
  // `RN-05` — la marca no sobrevive a su membresía. Si no hay membresía no hay
  // dónde ponerla: una persona del padrón SIN cuenta de acceso no tiene
  // documento aquí, y ese es el caso que trae este error.
  if (!membershipSnap.exists) {
    throw new HttpsError("not-found", "Esa persona no pertenece a este conjunto.");
  }
  const membership = (membershipSnap.data() ?? {}) as Membresia;

  // `CA11`. El id lo compone esta función con un `tenantId` ya validado, pero el
  // CAMPO se comprueba igual: es la misma guarda que hace `identidadParaFirmar`,
  // y protege del dato mal escrito, no del llamador.
  if (membership.tenantId !== tenantId) {
    throw new HttpsError("permission-denied", "Esa persona pertenece a otro conjunto.");
  }

  // `RN-02` y `RN-03` · `CA12`. Solo un residente. Un `security_guard` no puede
  // recibirla y un `tenant_admin` no la necesita: ya ve más. Es
  // `invalid-argument` y no `failed-precondition` porque no es un estado que se
  // pueda arreglar y reintentar — ese destinatario nunca puede recibirla.
  if (membership.role !== "resident") {
    throw new HttpsError("invalid-argument", "Solo un residente del conjunto puede ser consejero.");
  }

  const yaLaTiene = membership.isCommittee === true;
  // Idempotente (§5): no escribe y no falla.
  if (yaLaTiene === quiereLaMarca) {
    return { ok: true, cambiado: false };
  }

  // La membresía inactiva solo bloquea al CONCEDER. **Retirar tiene que
  // funcionar siempre**: si no, a una membresía desactivada no se le podría
  // limpiar la marca y quedaría un permiso sin dueño operable.
  if (quiereLaMarca && (membership.status ?? "active") !== "active") {
    throw new HttpsError(
      "failed-precondition",
      "Su membresía está inactiva. Actívala antes de nombrarla consejo.",
    );
  }

  const now = Timestamp.now();
  // Al retirar se BORRAN `committeeSince` y `committeeGrantedBy`: dejarlos
  // pintaría «consejo desde…» sobre alguien que ya no lo es, y si más adelante
  // se le vuelve a nombrar la fecha tiene que ser la del nombramiento nuevo. El
  // rastro histórico no se pierde — vive en la auditoría (`RN-08`), que es donde
  // debe vivir. Y `RN-06` no depende de estos campos: la firma ya puesta lleva
  // el nombre y la fecha DENTRO del informe.
  await membershipRef.set(
    quiereLaMarca
      ? { isCommittee: true, committeeSince: now, committeeGrantedBy: actorUid, updatedAt: now }
      : {
          isCommittee: false,
          committeeSince: FieldValue.delete(),
          committeeGrantedBy: FieldValue.delete(),
          updatedAt: now,
        },
    { merge: true },
  );

  return { ok: true, cambiado: true };
}
