/**
 * **Espejo en el cliente del inventario de referencias a persona.**
 *
 * El original vive en `functions/src/referencias-a-persona.ts` y es el que manda: el servidor
 * barre con él y aborta la fusión si aparece algo que no conoce. Esta copia existe **solo para
 * la vista previa** —decirle al administrador cuántas referencias se van a mover antes de que
 * confirme (`CA4`)— y no puede importarse de allí: `src/` no importa `functions/`, porque App
 * Hosting hace `npm ci` solo en la raíz y el `next build` se rompe.
 *
 * **Las dos listas tienen que decir lo mismo, y hay un guardián que enrojece si divergen**
 * (`tests/padron-inventario-espejo.test.ts`). Es el mismo patrón que el catálogo de avisos, que
 * llevaba desde siempre diciendo «deben mantenerse en sincronía» sin que nada lo comprobara.
 *
 * Si el espejo se queda corto, **el daño es un número mal contado en la vista previa, nunca un
 * huérfano**: quien reparte es el servidor.
 */

export type ReferenciaAPersona = { coleccion: string; campo: string; esLista?: boolean };

export const REFERENCIAS_A_PERSONA: ReferenciaAPersona[] = [
  { coleccion: "units", campo: "ownerIds", esLista: true },
  { coleccion: "units", campo: "residentIds", esLista: true },
  { coleccion: "packages", campo: "residentId" },
  { coleccion: "packages", campo: "deliveredToId" },
  { coleccion: "packages", campo: "receivedBy" },
];

/** Cuántas referencias de una colección apuntan a esta persona, escalares y listas. */
export function contarReferencias(
  documentos: readonly Record<string, unknown>[],
  coleccion: string,
  personaId: string,
): number {
  const campos = REFERENCIAS_A_PERSONA.filter((r) => r.coleccion === coleccion);
  let total = 0;
  for (const doc of documentos) {
    for (const { campo, esLista } of campos) {
      const valor = doc[campo];
      if (esLista) {
        if (Array.isArray(valor) && valor.includes(personaId)) total += 1;
      } else if (valor === personaId) {
        total += 1;
      }
    }
  }
  return total;
}
