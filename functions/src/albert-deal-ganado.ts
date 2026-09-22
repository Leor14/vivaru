import { FieldValue, type Firestore } from "firebase-admin/firestore";
import type { SenalGanado } from "./albert-senal-de-vuelta";

/**
 * Qué hace Vivaru cuando Albert dice que un deal se GANÓ. Decisión de David (22 sep 2026):
 * **avisar y marcar, no actuar solo.**
 *
 * - **Marca el lead como `convertido`**, que es el estado terminal que a REVOPS le faltaba:
 *   hasta hoy ningún lead salía de `nuevo` sin que alguien lo tocara a mano.
 * - **Avisa al buzón del equipo** para que alguien siga el alta.
 * - **NO da de alta el conjunto.** Crear un ambiente con su gente y su dinero dentro es
 *   irreversible en la práctica, y dispararlo desde un cambio de etapa en un CRM es demasiado
 *   poder para un clic ajeno. El alta sigue siendo `createTenantFromLead`, con un humano delante.
 *   Automatizarla se decidirá cuando haya altas de verdad y el circuito esté rodado.
 *
 * **Todo es best-effort y NUNCA lanza.** Si el correo falla o el lead no existe, la señal ya
 * quedó registrada: perder el aviso es malo, perder la señal sería peor. Lo que sí se respeta es
 * que **estas acciones solo corren la PRIMERA vez que se ve un deal** —`registrar` devuelve
 * `true` una sola vez por `dealId`—, así que nadie recibe el mismo aviso dos veces.
 */

export type ResumenGanado = {
  leadEncontrado: boolean;
  leadMarcado: boolean;
  avisoEnviado: boolean;
  errores: string[];
};

export type AccionesDeps = {
  /** Devuelve el lead o `null`. La clave es la nuestra: `leads/{leadId}`. */
  leerLead: (leadId: string) => Promise<Record<string, unknown> | null>;
  marcarConvertido: (leadId: string, senal: SenalGanado) => Promise<void>;
  avisar: (asunto: string, cuerpo: string) => Promise<void>;
};

/** Lo que se lee de un lead para escribir el aviso. Sin esto, el correo diría solo ids. */
function descripcionDelLead(lead: Record<string, unknown> | null): string {
  if (!lead) return "";
  const partes = [lead.empresa, lead.nombre, lead.email].filter((v): v is string => typeof v === "string" && v.trim() !== "");
  return partes.join(" · ");
}

function importe(senal: SenalGanado): string {
  return typeof senal.amount === "number" && senal.amount > 0 ? `${senal.amount}` : "sin cifra";
}

export function textoDelAviso(
  senal: SenalGanado,
  lead: Record<string, unknown> | null,
  etiquetaAmbiente: string,
): { asunto: string; cuerpo: string } {
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
    .filter((l): l is string => l !== null)
    .join("\n");
  return { asunto, cuerpo };
}

/**
 * Corre las acciones de un deal ganado que se ve por primera vez. Cada paso es independiente:
 * que no exista el lead no impide avisar, y que el correo falle no impide marcar.
 */
export async function accionesPorDealGanado(senal: SenalGanado, dep: AccionesDeps, etiquetaAmbiente = ""): Promise<ResumenGanado> {
  const resumen: ResumenGanado = { leadEncontrado: false, leadMarcado: false, avisoEnviado: false, errores: [] };

  let lead: Record<string, unknown> | null = null;
  if (senal.leadId) {
    try {
      lead = await dep.leerLead(senal.leadId);
      resumen.leadEncontrado = lead !== null;
    } catch (error) {
      resumen.errores.push(`leer_lead:${mensaje(error)}`);
    }
  }

  if (lead && senal.leadId) {
    try {
      await dep.marcarConvertido(senal.leadId, senal);
      resumen.leadMarcado = true;
    } catch (error) {
      resumen.errores.push(`marcar_lead:${mensaje(error)}`);
    }
  }

  try {
    const { asunto, cuerpo } = textoDelAviso(senal, lead, etiquetaAmbiente);
    await dep.avisar(asunto, cuerpo);
    resumen.avisoEnviado = true;
  } catch (error) {
    resumen.errores.push(`avisar:${mensaje(error)}`);
  }

  return resumen;
}

function mensaje(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).slice(0, 200);
}

export function dependenciasDeAcciones(
  db: Firestore,
  avisar: (asunto: string, cuerpo: string) => Promise<void>,
): AccionesDeps {
  return {
    async leerLead(leadId) {
      const snap = await db.collection("leads").doc(leadId).get();
      return snap.exists ? ((snap.data() ?? {}) as Record<string, unknown>) : null;
    },
    async marcarConvertido(leadId, senal) {
      await db.collection("leads").doc(leadId).set(
        {
          status: "convertido",
          convertidoEn: FieldValue.serverTimestamp(),
          albertGanado: {
            dealId: senal.dealId,
            amount: senal.amount ?? null,
            closedAt: senal.closedAt ?? null,
          },
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );
    },
    avisar,
  };
}
