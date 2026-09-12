import { createHash } from "node:crypto";

import { getFirestore, Timestamp } from "firebase-admin/firestore";

/**
 * `PRD-V-FIX-005` · R2 / R8 / `CF2` / `CF4` — cuántas veces se ha intentado algo, por clave.
 *
 * Lo usan las dos puertas que no pueden servir de oráculo: el alta de prueba (por correo, y por
 * IP cuando H5 diga cuál es la de verdad) y el alta de usuarios operativos en una prueba. Vive en
 * `limitesDeIntentos`, que ninguna regla abre: solo lo escribe el servidor.
 *
 * **La clave va con hash** (sha-256): contar los intentos de un correo no es motivo para guardarlo
 * en claro. `expiraEn` es para una política de TTL de Firestore sobre la colección; sin ella los
 * documentos se quedan —son diminutos—, pero la ventana se respeta igual, porque se decide
 * comparando `reiniciaEn` con la hora.
 */
export const COLECCION_DE_LIMITES = "limitesDeIntentos";

export type EstadoDeIntentos = { conteo: number; reiniciaEn: number };

/** Pura: dado lo guardado, ¿pasa este intento, y cómo queda el contador? El rechazo no suma. */
export function decidirIntento(
  actual: EstadoDeIntentos | undefined,
  max: number,
  ventanaMs: number,
  ahora: number,
): { permitido: boolean; siguiente: EstadoDeIntentos } {
  if (!actual || actual.reiniciaEn <= ahora) {
    return { permitido: true, siguiente: { conteo: 1, reiniciaEn: ahora + ventanaMs } };
  }
  if (actual.conteo >= max) return { permitido: false, siguiente: actual };
  return { permitido: true, siguiente: { conteo: actual.conteo + 1, reiniciaEn: actual.reiniciaEn } };
}

export function claveDeLimite(clave: string): string {
  return createHash("sha256").update(clave).digest("hex");
}

/** Cuenta un intento y dice si pasa. En transacción: dos intentos a la vez no se pisan. */
export async function consumirIntento(clave: string, max: number, ventanaMs: number): Promise<boolean> {
  const db = getFirestore();
  const ref = db.collection(COLECCION_DE_LIMITES).doc(claveDeLimite(clave));
  return db.runTransaction(async (tx) => {
    const datos = (await tx.get(ref)).data() as Partial<EstadoDeIntentos> | undefined;
    const actual =
      typeof datos?.conteo === "number" && typeof datos?.reiniciaEn === "number"
        ? { conteo: datos.conteo, reiniciaEn: datos.reiniciaEn }
        : undefined;
    const { permitido, siguiente } = decidirIntento(actual, max, ventanaMs, Date.now());
    if (permitido) tx.set(ref, { ...siguiente, expiraEn: Timestamp.fromMillis(siguiente.reiniciaEn) });
    return permitido;
  });
}
