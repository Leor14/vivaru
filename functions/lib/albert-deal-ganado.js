"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.textoDelAviso = textoDelAviso;
exports.accionesPorDealGanado = accionesPorDealGanado;
exports.dependenciasDeAcciones = dependenciasDeAcciones;
const firestore_1 = require("firebase-admin/firestore");
/** Lo que se lee de un lead para escribir el aviso. Sin esto, el correo diría solo ids. */
function descripcionDelLead(lead) {
    if (!lead)
        return "";
    const partes = [lead.empresa, lead.nombre, lead.email].filter((v) => typeof v === "string" && v.trim() !== "");
    return partes.join(" · ");
}
function importe(senal) {
    return typeof senal.amount === "number" && senal.amount > 0 ? `${senal.amount}` : "sin cifra";
}
function textoDelAviso(senal, lead, etiquetaAmbiente) {
    const quien = descripcionDelLead(lead);
    const asunto = `${etiquetaAmbiente}Negocio ganado en Albert${quien ? ` — ${quien}` : ""}`;
    const cuerpo = [
        "Albert marcó un negocio como ganado.",
        quien ? `Cliente: ${quien}` : "El deal no trae un lead de Vivaru asociado.",
        `Deal: ${senal.dealId}`,
        senal.leadId ? `Lead de Vivaru: ${senal.leadId}` : null,
        `Importe: ${importe(senal)}`,
        senal.closedAt ? `Ganado el: ${senal.closedAt}` : null,
        lead ? "El lead queda marcado como convertido." : null,
        "",
        "El alta del conjunto NO se hace sola: se crea desde la consola de superadmin, con el lead delante.",
    ]
        .filter((l) => l !== null)
        .join("\n");
    return { asunto, cuerpo };
}
/**
 * Corre las acciones de un deal ganado que se ve por primera vez. Cada paso es independiente:
 * que no exista el lead no impide avisar, y que el correo falle no impide marcar.
 */
async function accionesPorDealGanado(senal, dep, etiquetaAmbiente = "") {
    const resumen = { leadEncontrado: false, leadMarcado: false, avisoEnviado: false, errores: [] };
    let lead = null;
    if (senal.leadId) {
        try {
            lead = await dep.leerLead(senal.leadId);
            resumen.leadEncontrado = lead !== null;
        }
        catch (error) {
            resumen.errores.push(`leer_lead:${mensaje(error)}`);
        }
    }
    if (lead && senal.leadId) {
        try {
            await dep.marcarConvertido(senal.leadId, senal);
            resumen.leadMarcado = true;
        }
        catch (error) {
            resumen.errores.push(`marcar_lead:${mensaje(error)}`);
        }
    }
    try {
        const { asunto, cuerpo } = textoDelAviso(senal, lead, etiquetaAmbiente);
        await dep.avisar(asunto, cuerpo);
        resumen.avisoEnviado = true;
    }
    catch (error) {
        resumen.errores.push(`avisar:${mensaje(error)}`);
    }
    return resumen;
}
function mensaje(error) {
    return (error instanceof Error ? error.message : String(error)).slice(0, 200);
}
function dependenciasDeAcciones(db, avisar) {
    return {
        async leerLead(leadId) {
            const snap = await db.collection("leads").doc(leadId).get();
            return snap.exists ? (snap.data() ?? {}) : null;
        },
        async marcarConvertido(leadId, senal) {
            await db.collection("leads").doc(leadId).set({
                status: "convertido",
                convertidoEn: firestore_1.FieldValue.serverTimestamp(),
                albertGanado: {
                    dealId: senal.dealId,
                    amount: senal.amount ?? null,
                    closedAt: senal.closedAt ?? null,
                },
                updatedAt: new Date().toISOString(),
            }, { merge: true });
        },
        avisar,
    };
}
