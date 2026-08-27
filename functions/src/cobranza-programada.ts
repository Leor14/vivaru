import { type Firestore } from "firebase-admin/firestore";

import {
  fechaUTC,
  tocaAvisoHoy,
  tocaVencidasHoy,
  type CalendarioDeCobranza,
} from "./calendario-de-cobranza";
import { isFeatureEnabled } from "./feature-flags";
import { WRITABLE_TENANT_STATUSES } from "./tenant-status";

/**
 * `PRD-V-FLOW-003` §5.2 — la pasada diaria del calendario de cobranza.
 *
 * **La decisión de si toca es pura y vive aparte** (`calendario-de-cobranza.ts`). Esto es la
 * orquestación: a qué conjuntos les toca hoy, cuáles pueden enviar, y dejar constancia de que ya
 * se envió. El envío se **inyecta**, para que esto se pruebe entero sin mandar un solo correo.
 *
 * ---
 *
 * **TRES PUERTAS ANTES DE MANDAR NADA, y ninguna sobra.**
 *
 * **1 · La bandera**, resuelta por conjunto. Apagada, esta pasada no existe — que es exactamente
 * la conducta de hoy, porque los dos procesos programados nunca han tenido calendario.
 *
 * **2 · El estado del conjunto** (R8). Un `suspended` o `expired` **no envía nada**, y es más
 * estricto que la regla de escritura a propósito: un conjunto que no opera no debe cobrarle a
 * nadie. Se comprueba sin lanzar, porque aquí no hay un cliente al que responderle — hay un cron
 * que tiene que seguir con los demás conjuntos.
 *
 * **3 · Que toque hoy**, con memoria del último envío. Es la que evita el duplicado, y el
 * duplicado es el fallo que no ve nadie del equipo: lo ve el destinatario.
 *
 * **Y la marca se escribe DESPUÉS de enviar, no antes.** Al revés se pierde el aviso entero si el
 * envío falla: quedaría marcado como enviado sin haberlo estado, y hasta el mes siguiente nadie lo
 * sabría. Marcar después puede duplicar si el proceso muere en medio; ese riesgo es el correcto de
 * los dos, porque un aviso repetido se explica y uno que nunca salió se descubre en la cartera.
 */

export type ClaseDeAviso = "aviso" | "vencidas";

export type ResumenDePasada = {
  conjuntosMirados: number;
  enviados: { tenantId: string; clase: ClaseDeAviso }[];
  saltados: { tenantId: string; motivo: string }[];
};

/** Lo que hace falta saber de un conjunto para decidir. Se lee, no se supone. */
type EstadoDelConjunto = { status?: unknown };

/**
 * Recorre los conjuntos con calendario configurado y manda lo que toque.
 *
 * `enviar` devuelve `true` si de verdad mandó algo. **Si devuelve `false` no se marca la fecha**:
 * un ciclo de vencidas sin unidades vencidas no debe consumir el turno del ciclo, o el conjunto se
 * quedaría sin su aviso el día que sí tenga morosos.
 */
export async function pasadaDeCalendarioDeCobranza(
  db: Firestore,
  hoy: Date,
  enviar: (tenantId: string, clase: ClaseDeAviso) => Promise<boolean>,
): Promise<ResumenDePasada> {
  const resumen: ResumenDePasada = { conjuntosMirados: 0, enviados: [], saltados: [] };

  const ajustes = await db.collection("tenantSettings").get();

  for (const doc of ajustes.docs) {
    const tenantId = doc.id;
    const cal = (doc.data().billingCalendar ?? {}) as CalendarioDeCobranza;

    // Sin nada configurado no se cuenta siquiera como mirado: no es una decisión, es ausencia.
    if (cal.noticeDayOfMonth == null && cal.overdueCycleDays == null) continue;
    resumen.conjuntosMirados += 1;

    if (!(await isFeatureEnabled("producto-calendario-de-cobranza", tenantId))) {
      resumen.saltados.push({ tenantId, motivo: "bandera apagada" });
      continue;
    }

    // R8 · el conjunto que no opera no cobra. Sin `status` se asume operable, por los datos
    // antiguos — la misma tolerancia que `assertTenantOperable`.
    const tenant = await db.collection("tenants").doc(tenantId).get();
    const status = (tenant.data() as EstadoDelConjunto | undefined)?.status;
    if (typeof status === "string" && !WRITABLE_TENANT_STATUSES.includes(status)) {
      resumen.saltados.push({ tenantId, motivo: `conjunto ${status}` });
      continue;
    }

    const hoyISO = fechaUTC(hoy);

    // **Cada envío va en su propio `try`, y no es defensa genérica.** Un conjunto cuyo envío
    // revienta —un correo mal formado, una cuota del proveedor— no puede abortar la pasada y
    // dejar sin aviso a los conjuntos que vienen detrás en el bucle. Y al fallar NO se marca la
    // fecha: el mes que viene se reintenta.
    for (const [toca, clase, campo] of [
      [tocaAvisoHoy(cal, hoy), "aviso", "lastNoticeSentAt"],
      [tocaVencidasHoy(cal, hoy), "vencidas", "lastOverdueSentAt"],
    ] as [boolean, ClaseDeAviso, string][]) {
      if (!toca) continue;
      try {
        // **La marca se escribe DESPUÉS de que el envío diga que sí.** Al revés se pierde el aviso
        // entero si falla: quedaría marcado como enviado sin haberlo estado, y hasta el mes
        // siguiente nadie lo sabría.
        if (await enviar(tenantId, clase)) {
          // `merge` con solo el campo que toca: si los dos avisos caen el mismo día, el segundo no
          // puede pisar la marca del primero.
          await doc.ref.set({ billingCalendar: { [campo]: hoyISO } }, { merge: true });
          resumen.enviados.push({ tenantId, clase });
        } else {
          // **No consume el turno.** Un ciclo sin morosos no debe gastar el ciclo, o el conjunto
          // se queda sin aviso el día que sí los tenga.
          resumen.saltados.push({ tenantId, motivo: clase === "aviso" ? "aviso sin destinatarios" : "sin cartera vencida" });
        }
      } catch (e) {
        console.error(`[cobranza-calendario][${tenantId}] falló el envío de ${clase}`, e);
        resumen.saltados.push({ tenantId, motivo: `falló el envío de ${clase}` });
      }
    }
  }

  return resumen;
}
