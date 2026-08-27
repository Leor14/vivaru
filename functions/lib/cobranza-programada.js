"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pasadaDeCalendarioDeCobranza = pasadaDeCalendarioDeCobranza;
const calendario_de_cobranza_1 = require("./calendario-de-cobranza");
const feature_flags_1 = require("./feature-flags");
const tenant_status_1 = require("./tenant-status");
/**
 * Recorre los conjuntos con calendario configurado y manda lo que toque.
 *
 * `enviar` devuelve `true` si de verdad mandó algo. **Si devuelve `false` no se marca la fecha**:
 * un ciclo de vencidas sin unidades vencidas no debe consumir el turno del ciclo, o el conjunto se
 * quedaría sin su aviso el día que sí tenga morosos.
 */
async function pasadaDeCalendarioDeCobranza(db, hoy, enviar) {
    const resumen = { conjuntosMirados: 0, enviados: [], saltados: [] };
    const ajustes = await db.collection("tenantSettings").get();
    for (const doc of ajustes.docs) {
        const tenantId = doc.id;
        const cal = (doc.data().billingCalendar ?? {});
        // Sin nada configurado no se cuenta siquiera como mirado: no es una decisión, es ausencia.
        if (cal.noticeDayOfMonth == null && cal.overdueCycleDays == null)
            continue;
        resumen.conjuntosMirados += 1;
        if (!(await (0, feature_flags_1.isFeatureEnabled)("producto-calendario-de-cobranza", tenantId))) {
            resumen.saltados.push({ tenantId, motivo: "bandera apagada" });
            continue;
        }
        // R8 · el conjunto que no opera no cobra. Sin `status` se asume operable, por los datos
        // antiguos — la misma tolerancia que `assertTenantOperable`.
        const tenant = await db.collection("tenants").doc(tenantId).get();
        const status = tenant.data()?.status;
        if (typeof status === "string" && !tenant_status_1.WRITABLE_TENANT_STATUSES.includes(status)) {
            resumen.saltados.push({ tenantId, motivo: `conjunto ${status}` });
            continue;
        }
        const hoyISO = (0, calendario_de_cobranza_1.fechaUTC)(hoy);
        // **Cada envío va en su propio `try`, y no es defensa genérica.** Un conjunto cuyo envío
        // revienta —un correo mal formado, una cuota del proveedor— no puede abortar la pasada y
        // dejar sin aviso a los conjuntos que vienen detrás en el bucle. Y al fallar NO se marca la
        // fecha: el mes que viene se reintenta.
        for (const [toca, clase, campo] of [
            [(0, calendario_de_cobranza_1.tocaAvisoHoy)(cal, hoy), "aviso", "lastNoticeSentAt"],
            [(0, calendario_de_cobranza_1.tocaVencidasHoy)(cal, hoy), "vencidas", "lastOverdueSentAt"],
        ]) {
            if (!toca)
                continue;
            try {
                // **La marca se escribe DESPUÉS de que el envío diga que sí.** Al revés se pierde el aviso
                // entero si falla: quedaría marcado como enviado sin haberlo estado, y hasta el mes
                // siguiente nadie lo sabría.
                if (await enviar(tenantId, clase)) {
                    // `merge` con solo el campo que toca: si los dos avisos caen el mismo día, el segundo no
                    // puede pisar la marca del primero.
                    await doc.ref.set({ billingCalendar: { [campo]: hoyISO } }, { merge: true });
                    resumen.enviados.push({ tenantId, clase });
                }
                else {
                    // **No consume el turno.** Un ciclo sin morosos no debe gastar el ciclo, o el conjunto
                    // se queda sin aviso el día que sí los tenga.
                    resumen.saltados.push({ tenantId, motivo: clase === "aviso" ? "aviso sin destinatarios" : "sin cartera vencida" });
                }
            }
            catch (e) {
                console.error(`[cobranza-calendario][${tenantId}] falló el envío de ${clase}`, e);
                resumen.saltados.push({ tenantId, motivo: `falló el envío de ${clase}` });
            }
        }
    }
    return resumen;
}
