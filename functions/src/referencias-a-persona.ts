/**
 * **El inventario de lo que apunta a una persona, y el barrido que lo vigila en caliente.**
 *
 * `PRD-V-FEAT-005` R4. Fusionar exige repuntar **todo** lo que apunta al registro que
 * desaparece, y este repositorio ya tiene la factura de no hacerlo: `mergeUnits` prometía «TODAS
 * las referencias» con **una lista de nueve escrita a mano, y eran dieciocho**. Como la fusión
 * borraba la unidad, lo que no se repuntó quedó apuntando a algo que ya no existe — **son los
 * huérfanos de `tenant-santa-maria`**.
 *
 * ## Por qué esta lista no se escribió leyendo el código
 *
 * Se derivó **midiendo los datos de producción**: recorrer las 49 colecciones y preguntar qué
 * campo contiene de verdad un id de `people`. Un grep por nombre de campo habría dado otra cosa,
 * y en las dos direcciones:
 *
 * - **Habría METIDO `tickets.residentId`**, que se llama exactamente como una referencia a
 *   persona y lleva un **uid de Auth** (`use-tickets.ts` lo escribe con `input.userId`). Sus dos
 *   valores en producción son uids: cero apuntan a `people`.
 * - **Habría DEJADO FUERA `packages.deliveredToId` y `packages.receivedBy`**, que no se llaman
 *   como una referencia a persona y llevan **siete cada uno**. Un inventario a mano habría
 *   repuntado 29 referencias de 43 y dejado catorce colgando. La historia de `mergeUnits`, otra
 *   vez, con otros nombres.
 *
 * ## Y por eso la lista no es la última palabra: manda el barrido
 *
 * `buscarReferenciasAPersona` recorre el conjunto entero y devuelve **todo** lo que apunta a los
 * ids que se van a fusionar, esté o no en esta lista. Si aparece algo no registrado, la fusión
 * **aborta antes de escribir nada** (`CF3`) en vez de dejar huérfanos. La lista dice qué se sabe
 * repuntar; el barrido dice qué hay de verdad, y ante la duda gana el barrido.
 *
 * Medido en `hogaru-1` el 30 de agosto de 2026: 43 referencias vivas a 68 personas.
 */

import type { Firestore } from "firebase-admin/firestore";

export type ReferenciaAPersona = {
  coleccion: string;
  campo: string;
  /** El campo es un array de ids; se repunta con `arrayRemove`/`arrayUnion`, no con un `set`. */
  esLista?: boolean;
  /** Qué se midió el 30 de agosto de 2026, para que el día que no cuadre se note. */
  medido: number;
};

export const REFERENCIAS_A_PERSONA: ReferenciaAPersona[] = [
  { coleccion: "units", campo: "ownerIds", esLista: true, medido: 18 },
  // Cero en producción hoy, y va igual: `services.ts` la escribe con `arrayUnion(person.id)` al
  // dar de alta un residente. Las colecciones vacías son las que nadie recuerda el día que dejan
  // de estarlo — es la razón por la que `advanceApplications` está en el inventario de unidad.
  { coleccion: "units", campo: "residentIds", esLista: true, medido: 0 },
  { coleccion: "packages", campo: "residentId", medido: 11 },
  // **Los dos campos MIXTOS.** `use-packages.ts` escribe `deliveredToId = input.deliveredToId ||
  // input.userId`, así que el mismo campo lleva un id de persona cuando el guarda elige del
  // directorio y un **uid** cuando lo recoge el propio residente; `receivedBy` copia ese valor, y
  // una callable del servidor lo escribe además con `request.auth.uid`. Repuntar por IGUALDAD
  // contra el id que se fusiona es seguro precisamente por eso: los uids no coinciden con ningún
  // id de persona, así que no se tocan.
  { coleccion: "packages", campo: "deliveredToId", medido: 7 },
  { coleccion: "packages", campo: "receivedBy", medido: 7 },
];

/**
 * Campos que **parecen** una referencia a persona y no lo son. Se enumeran a propósito: sin esta
 * lista, el siguiente que lea `residentId` en `tickets` lo añadirá por el nombre, y repuntarlo
 * reescribiría el uid de quien abrió la PQRS.
 */
export const NO_SON_REFERENCIA_A_PERSONA: { coleccion: string; campo: string; porque: string }[] = [
  {
    coleccion: "tickets",
    campo: "residentId",
    porque:
      "lleva el uid de Auth de quien abrió la PQRS (`use-tickets.ts` lo escribe con `input.userId`), " +
      "no el id de su ficha del padrón. Medido: 2 valores en producción, 0 apuntan a `people`.",
  },
];

export type ReferenciaEncontrada = {
  coleccion: string;
  campo: string;
  esLista: boolean;
  docId: string;
  personaId: string;
};

const registradas = new Set(REFERENCIAS_A_PERSONA.map((r) => `${r.coleccion}.${r.campo}`));

export function estaRegistrada(coleccion: string, campo: string): boolean {
  return registradas.has(`${coleccion}.${campo}`);
}

/**
 * **Barre el conjunto entero buscando quién apunta a estas personas.** Solo lee.
 *
 * No se apoya en la lista de arriba: mira **todos** los campos de **todos** los documentos del
 * conjunto, porque el objeto de este barrido es encontrar justamente lo que la lista no sabe.
 *
 * Escala: hoy son decenas de documentos por colección. `G6` de la ficha ya declara que por encima
 * de unos miles habría que paginar esto, y es mejor decirlo aquí que descubrirlo.
 */
export async function buscarReferenciasAPersona(
  db: Firestore,
  tenantId: string,
  personaIds: readonly string[],
): Promise<ReferenciaEncontrada[]> {
  const buscadas = new Set(personaIds);
  const salida: ReferenciaEncontrada[] = [];
  const colecciones = await db.listCollections();

  for (const coleccion of colecciones) {
    // `people` se trata aparte: sus propios documentos son el objeto de la fusión.
    if (coleccion.id === "people") continue;
    const snap = await coleccion.where("tenantId", "==", tenantId).limit(5000).get();
    for (const doc of snap.docs) {
      for (const [campo, valor] of Object.entries(doc.data() ?? {})) {
        const esLista = Array.isArray(valor);
        for (const v of esLista ? (valor as unknown[]) : [valor]) {
          if (typeof v !== "string" || !buscadas.has(v)) continue;
          salida.push({ coleccion: coleccion.id, campo, esLista, docId: doc.id, personaId: v });
        }
      }
    }
  }
  return salida;
}
