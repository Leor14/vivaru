import { getFirestore } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";

import { isFeatureEnabled } from "./feature-flags";

/**
 * `PRD-V-PLAT-006` · el predicado único de «esta dirección se puede tocar en este conjunto».
 *
 * **Por qué existe.** Los conjuntos que no tienen cliente detrás son el escaparate del equipo, y
 * dentro de ellos han acabado direcciones de personas que nadie sabe de quién son: `DATO-001`
 * limpió siete el 27 ago 2026 por su FORMA y dejó once que el patrón no cazaba. La limpieza
 * arregla el pasado; esto cierra la puerta.
 *
 * **Lo que este módulo NO hace, y es deliberado.** No decide qué conjunto está marcado por su
 * `status`, su `isExample` ni su `trialEndsAt`. `isExample` lo llevan los NUEVE conjuntos de
 * producción —los dos del trial incluidos, cuyo administrador es un prospecto con su correo
 * real por diseño—, así que derivar la marca de él rechazaría al primer cliente que llegue.
 * La marca es un campo explícito con dueño (`RN-1`). Cf. `la-suite-no-encadena`: un valor no
 * sirve de sustituto de un hecho.
 *
 * **El gemelo que ya existía.** `assertCanInviteRealPeople` (`trial-modules.ts`) resuelve la
 * mitad de este problema desde el trial: bloquea invitar residentes reales cuando el conjunto
 * está en `trial` o `expired`. Su criterio es el estado, no la marca, y se aplica en un solo
 * punto de los cuatro por los que sale correo a una persona. Este módulo sigue su forma
 * —`assert…(tenantId)` que lee `tenants/{id}` y lanza `failed-precondition` legible— y no la
 * reemplaza: las dos puertas conviven y protegen cosas distintas.
 */

/**
 * Dominios que no alcanzan a nadie: los de las semillas y el de las cuentas de prueba.
 *
 * **Esta es la copia canónica.** Existen otras dos, en `functions/scripts/`
 * (`informe-correos-en-conjuntos-de-ejemplo.mjs` y `sanear-correos-de-prueba.mjs`), porque los
 * scripts corren con Node suelto y no importan de `src`. `tests/catalogo-de-dominios-inertes.test.ts`
 * vigila que no diverjan: cinco copias del mismo mapa fue la trampa de `UX-004`.
 */
export const DOMINIOS_INERTES = [
  "ejemplo.vivaru.app",
  "demo.grupovivaru.com",
  "hogaru.test",
  "demo.co",
  "example.com",
] as const;

export const RUTA_CORREOS_DEL_EQUIPO = "config/correosDelEquipo";

export type CorreosDelEquipo = {
  /** Dominios enteros que controla el equipo, p. ej. `qintilab.com`. En minúsculas. */
  dominios: string[];
  /** Direcciones exactas, `+alias` incluido si lo lleva. En minúsculas. */
  direcciones: string[];
};

const EQUIPO_VACIO: CorreosDelEquipo = { dominios: [], direcciones: [] };

/** El dominio de una dirección, en minúsculas, o `null` si no es una dirección. */
export function dominioDe(email: string | null | undefined): string | null {
  if (typeof email !== "string") return null;
  const arroba = email.lastIndexOf("@");
  if (arroba <= 0 || arroba === email.length - 1) return null;
  return email.slice(arroba + 1).trim().toLowerCase();
}

/** Un dominio es inerte si está en el catálogo o es un subdominio suyo. */
export function esDominioInerte(dominio: string | null): boolean {
  if (!dominio) return false;
  return DOMINIOS_INERTES.some((d) => dominio === d || dominio.endsWith(`.${d}`));
}

/**
 * `RN-2` · la decisión pura, sin base de datos, para poder probarla y para que la puerta de
 * salida no dependa de una lectura cuando ya tiene la lista.
 *
 * **La comparación NO normaliza el `+alias`** a propósito: `david+res1@gmail.com` se admite solo
 * si está listada tal cual o si su dominio entero está en la lista del equipo. Quitar el alias
 * convertiría una dirección listada en una familia infinita de direcciones admitidas, que es
 * justo lo que la puerta viene a impedir.
 */
export function buzonAdmisible(email: string | null | undefined, equipo: CorreosDelEquipo): boolean {
  const limpio = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (!limpio) return false;

  const dominio = dominioDe(limpio);
  if (!dominio) return false;

  if (esDominioInerte(dominio)) return true;
  if (equipo.dominios.includes(dominio)) return true;
  return equipo.direcciones.includes(limpio);
}

/** Normaliza lo que haya en `config/correosDelEquipo`, que lo edita una persona a mano. */
export function normalizarCorreosDelEquipo(data: unknown): CorreosDelEquipo {
  const d = (data ?? {}) as { dominios?: unknown; direcciones?: unknown };
  const lista = (v: unknown): string[] =>
    Array.isArray(v)
      ? v.filter((x): x is string => typeof x === "string").map((x) => x.trim().toLowerCase()).filter(Boolean)
      : [];
  return { dominios: lista(d.dominios), direcciones: lista(d.direcciones) };
}

/**
 * Lee la lista del equipo. **Es global, no del conjunto**: el equipo es el mismo en los nueve.
 *
 * Si el documento no existe devuelve listas vacías, y entonces solo pasan los dominios inertes.
 * Es el borde seguro: la puerta se cierra de más, nunca de menos, y el síntoma es visible
 * (`rechazado-puerta` con motivo) en vez de silencioso.
 */
export async function leerCorreosDelEquipo(): Promise<CorreosDelEquipo> {
  try {
    const [coleccion, documento] = RUTA_CORREOS_DEL_EQUIPO.split("/");
    const snap = await getFirestore().collection(coleccion).doc(documento).get();
    if (!snap.exists) return EQUIPO_VACIO;
    return normalizarCorreosDelEquipo(snap.data());
  } catch (e) {
    console.error("[buzones] no se pudo leer la lista del equipo", e);
    return EQUIPO_VACIO;
  }
}

/**
 * `RN-1` · si el conjunto lleva la marca del superadmin.
 *
 * Un conjunto que no existe **no está marcado**: la puerta no inventa restricciones sobre lo que
 * no puede leer.
 */
export async function conjuntoSinClienteDetras(tenantId: string | null | undefined): Promise<boolean> {
  if (!tenantId) return false;
  try {
    const snap = await getFirestore().collection("tenants").doc(tenantId).get();
    if (!snap.exists) return false;
    return (snap.data() as { sinClienteDetras?: unknown } | undefined)?.sinClienteDetras === true;
  } catch (e) {
    console.error("[buzones] no se pudo leer la marca del conjunto", tenantId, e);
    return false;
  }
}

/**
 * El predicado completo: en ESTE conjunto, ¿se puede escribir o escribir A esta dirección?
 *
 * Devuelve `true` cuando el conjunto no está marcado — que es el caso de todo conjunto con
 * cliente y de los dos del trial.
 */
export async function buzonAdmisibleEnConjunto(
  tenantId: string | null | undefined,
  email: string | null | undefined,
): Promise<boolean> {
  if (!(await conjuntoSinClienteDetras(tenantId))) return true;
  return buzonAdmisible(email, await leerCorreosDelEquipo());
}

/** El motivo legible, uno solo, para que el rechazo diga lo mismo en la entrada y en la salida. */
export const MOTIVO_RECHAZO =
  "En un conjunto de demostración solo se admiten direcciones de prueba o del equipo.";

/**
 * `PRD-V-PLAT-006` · la puerta de ENTRADA del lado del servidor.
 *
 * **Existe porque una regla de Firestore no protege lo que escribe una callable.** Las callables
 * van con Admin SDK, que no evalúa `firestore.rules`, así que `firestore.rules` cubre `people` —lo
 * escribe el cliente— y esto cubre `users` y `tenantUsers`, que solo se escriben por callable. Si
 * cambias una, cambia la otra: es el mismo par que `tenantOperable` / `assertTenantOperable`, y su
 * desajuste costó `CF8`.
 *
 * **Lanza `failed-precondition`, no `permission-denied`**, y con el mismo texto que ve quien recibe
 * el rechazo en la salida: al administrador no le falta un permiso, es que la dirección no cabe en
 * un conjunto de demostración. Misma forma que `assertCanInviteRealPeople`.
 *
 * **Respeta la bandera**, así que apagada no rechaza nada — que es la conducta de hoy.
 */
export async function assertBuzonAdmisible(
  tenantId: string | null | undefined,
  email: string | null | undefined,
): Promise<void> {
  // Sin correo no hay nada que juzgar: quien exija el correo es cada callable.
  if (!email) return;
  if (!(await isFeatureEnabled("producto-puerta-de-buzones", tenantId))) return;
  if (await buzonAdmisibleEnConjunto(tenantId, email)) return;

  throw new HttpsError("failed-precondition", MOTIVO_RECHAZO);
}
