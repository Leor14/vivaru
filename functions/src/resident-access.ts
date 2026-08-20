import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";

/**
 * Revocación del acceso de un residente al borrarlo.
 *
 * **El defecto que cierra.** `deletePerson` (`src/features/admin/services.ts`)
 * borraba **un solo documento**: `people/{id}`. Pero dar acceso a un residente
 * crea **cinco cosas** —cuenta de Auth, custom claim con el `tenantId`,
 * `users/{uid}`, `tenantUsers/{tenantId}_{uid}` y el `authUid` en la ficha—, y
 * las cuatro primeras sobrevivían al borrado.
 *
 * Y no es una ventana hasta que caduque el token: **las reglas conceden
 * pertenencia por la EXISTENCIA del documento de membresía** y nunca miran su
 * campo `status` (`firestore.rules`, `tenantMember()`). Mientras ese documento
 * exista, la persona borrada entra. Agravado por el diálogo de confirmación, que
 * promete «se perderá su acceso a la plataforma».
 *
 * **Por qué vive en el servidor.** Desactivar una cuenta y revocar sus tokens
 * son operaciones del Admin SDK. El cliente no puede hacerlas ni debería: si
 * pudiera, cualquiera con la consola abierta podría desactivar cuentas ajenas.
 *
 * **La decisión de David (19 ago 2026): la cuenta se BORRA, no se desactiva.**
 * Tres motivos: es lo que ya hace `deleteOperationalUser` con administradores y
 * guardas —el sistema queda coherente consigo mismo—; el diálogo ya promete que
 * no se puede deshacer; y borra de verdad el correo y el nombre, que es la misma
 * supresión que le estamos exigiendo a Albert. Si la persona vuelve al conjunto,
 * `provisionResidentTemporaryAccess` le crea la cuenta otra vez.
 *
 * **Dos casos que el patrón de `deleteOperationalUser` no cubría** y que aquí sí
 * pasan, porque un residente no es un usuario operativo:
 *
 * 1. **La misma cuenta en dos conjuntos.** Borrarla dejaría a la persona fuera
 *    del otro. Se le quita la membresía de ESTE conjunto y la cuenta solo se
 *    borra si era la última.
 * 2. **La cuenta resulta ser de un admin o un guarda.** Se rechaza y se manda a
 *    la pantalla de usuarios operativos. Borrar un residente no puede dejar al
 *    conjunto sin administrador por un descuido.
 */

const db = () => getFirestore();

const texto = (valor: unknown): string => (typeof valor === "string" ? valor.trim() : "");

/** Roles que NO se gestionan por esta vía: tienen su propia pantalla y sus propios guardrales. */
const ROLES_OPERATIVOS = new Set(["tenant_admin", "admin_tenant", "security_guard"]);

export type MembresiaDeOtroConjunto = { tenantId: string; role: string };

export type PlanDeRevocacion =
  | { accion: "sin-cuenta"; motivo: string }
  | { accion: "revocar-y-borrar"; motivo: string }
  | { accion: "revocar-y-conservar"; motivo: string; tenantIdRestante: string; rolRestante: string };

/**
 * Decide QUÉ hay que hacer, sin hacer nada. Separada a propósito: es la parte
 * que se puede probar sin emulador, y es donde están las decisiones que importan.
 */
export function planearRevocacion(input: {
  authUid: string | null;
  rolEnEsteConjunto: string | null;
  membresiasEnOtrosConjuntos: MembresiaDeOtroConjunto[];
}): PlanDeRevocacion {
  const uid = texto(input.authUid);
  if (!uid) {
    // La mayoría de residentes nunca pidieron acceso. No es un error: no hay
    // nada que revocar y el borrado de la ficha sigue su camino.
    return { accion: "sin-cuenta", motivo: "la persona no tiene cuenta de acceso" };
  }

  const rol = texto(input.rolEnEsteConjunto);
  if (rol && ROLES_OPERATIVOS.has(rol)) {
    throw new HttpsError(
      "failed-precondition",
      "Esa cuenta es de un administrador o un guarda del conjunto. Gestiónala desde Usuarios operativos, no desde Residentes.",
    );
  }

  const otras = input.membresiasEnOtrosConjuntos.filter((m) => texto(m.tenantId));
  if (otras.length > 0) {
    const restante = otras[0];
    return {
      accion: "revocar-y-conservar",
      motivo: `la cuenta sigue perteneciendo a ${otras.length} conjunto(s) más`,
      tenantIdRestante: texto(restante.tenantId),
      rolRestante: texto(restante.role) || "resident",
    };
  }

  return { accion: "revocar-y-borrar", motivo: "era su única pertenencia" };
}

export type RevocarAccesoInput = { tenantId: string; personId: string };

export type RevocarAccesoResultado = {
  revoked: boolean;
  accion: PlanDeRevocacion["accion"];
  motivo: string;
  uid: string | null;
};

/**
 * Ejecuta el plan. El orden importa y no es casual: **primero se cierra la
 * puerta, después se limpia**. Si algo falla a mitad, el peor estado posible es
 * «acceso ya revocado, fichas a medio borrar» —recuperable reintentando—, nunca
 * «ficha borrada, acceso vivo», que es justo el defecto que esto cierra.
 */
export async function revocarAccesoDeResidente(
  input: RevocarAccesoInput,
  actorUid: string,
): Promise<RevocarAccesoResultado> {
  const tenantId = texto(input.tenantId);
  const personId = texto(input.personId);
  if (!tenantId || !personId) {
    throw new HttpsError("invalid-argument", "Debes indicar el conjunto y la persona.");
  }

  const firestore = db();
  const personSnap = await firestore.collection("people").doc(personId).get();
  if (!personSnap.exists) {
    throw new HttpsError("not-found", "La persona no existe.");
  }
  const person = personSnap.data() as Record<string, unknown>;
  if (texto(person.tenantId) !== tenantId) {
    throw new HttpsError("permission-denied", "La persona no pertenece a este conjunto.");
  }

  const targetUid = texto(person.authUid);
  if (!targetUid) {
    return { revoked: false, accion: "sin-cuenta", motivo: "la persona no tiene cuenta de acceso", uid: null };
  }

  // Nadie se borra a sí mismo por esta vía: dejaría al actor sin sesión a mitad
  // de la operación y sin forma de terminarla.
  if (targetUid === actorUid) {
    throw new HttpsError("failed-precondition", "No puedes eliminar tu propia cuenta desde aquí.");
  }

  const membershipRef = firestore.collection("tenantUsers").doc(`${tenantId}_${targetUid}`);
  const membershipSnap = await membershipRef.get();
  const rolEnEsteConjunto = membershipSnap.exists
    ? texto((membershipSnap.data() as { role?: unknown }).role)
    : null;

  const todas = await firestore.collection("tenantUsers").where("uid", "==", targetUid).get();
  const membresiasEnOtrosConjuntos: MembresiaDeOtroConjunto[] = todas.docs
    .filter((d) => d.id !== membershipRef.id)
    .map((d) => {
      const data = d.data() as { tenantId?: unknown; role?: unknown };
      return { tenantId: texto(data.tenantId), role: texto(data.role) };
    })
    .filter((m) => m.tenantId && m.tenantId !== tenantId);

  const plan = planearRevocacion({ authUid: targetUid, rolEnEsteConjunto, membresiasEnOtrosConjuntos });

  const authApi = getAuth();

  // 1. La puerta, primero. Quitar la membresía es lo que de verdad cierra el
  //    acceso, porque la regla concede por existencia de ese documento.
  if (membershipSnap.exists) {
    await membershipRef.delete();
  }
  await authApi.revokeRefreshTokens(targetUid).catch(ignorarSiNoExiste);

  // 2. El claim. Si le queda otro conjunto, se le reapunta ahí; si no, se limpia
  //    —el claim `tenantId` es lo que Storage usa para conceder, así que dejarlo
  //    apuntando a un conjunto del que ya no es miembro sería el mismo defecto
  //    con otra cara.
  if (plan.accion === "revocar-y-conservar") {
    await authApi
      .setCustomUserClaims(targetUid, { role: plan.rolRestante, tenantId: plan.tenantIdRestante })
      .catch(ignorarSiNoExiste);
    return { revoked: true, accion: plan.accion, motivo: plan.motivo, uid: targetUid };
  }

  // 3. Era su única pertenencia: se va entera.
  await authApi.setCustomUserClaims(targetUid, null).catch(ignorarSiNoExiste);
  await firestore.collection("users").doc(targetUid).delete();
  await authApi.deleteUser(targetUid).catch(ignorarSiNoExiste);

  return { revoked: true, accion: plan.accion, motivo: plan.motivo, uid: targetUid };
}

/**
 * Una cuenta que ya no está en Auth no es un fallo de esta operación: es el
 * estado al que queremos llegar. Cualquier otro error sí sube.
 */
function ignorarSiNoExiste(error: unknown): void {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code)
      : "";
  if (code === "auth/user-not-found") return;
  throw error;
}
