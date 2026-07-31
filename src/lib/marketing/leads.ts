import { getAdminDb } from "@/lib/firebase/admin";

/**
 * Persistencia de leads de marketing (Fase 0 del plan de self-service).
 *
 * Antes, `/api/demo` y `/api/lead` solo mandaban correo y hacían `console.log`:
 * el `leadId` era un UUID efímero y no había forma de saber cuántos leads
 * entraron ni de atribuir un trial a su origen. Ahora quedan en Firestore.
 *
 * Regla heredada de esas rutas y que se mantiene aquí: **la captura del lead
 * nunca se penaliza por un fallo de infraestructura.** Si Firestore no está
 * disponible, se registra el error y se sigue — el correo y la respuesta al
 * usuario van igual.
 */

export type LeadOrigin = "demo" | "diagnostico" | "trial";

export type LeadStatus =
  | "nuevo"
  | "contactado"
  | "calificado"
  | "convertido"
  | "perdido";

export type LeadInput = {
  leadId: string;
  origen: LeadOrigin;
  nombre: string;
  email: string;
  telefono?: string;
  empresa?: string;
  cargo?: string;
  ciudad?: string;
  pais?: string;
  /** Unidades declaradas — el mejor filtro de calificación sin fricción.
   *  `/api/demo` la manda como texto libre y el diagnóstico como número. */
  unidadesEstimadas?: string | number;
  conjuntos?: string;
  timeline?: string;
  /** Datos propios de cada origen (score del diagnóstico, respuestas, etc.). */
  meta?: Record<string, unknown>;
};

/** Quita claves vacías: Firestore rechaza `undefined` y los "" ensucian la consola. */
function clean(value: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value)) {
    if (val === undefined || val === null) continue;
    if (typeof val === "string" && val.trim() === "") continue;
    out[key] = val;
  }
  return out;
}

/**
 * Guarda el lead en `leads/{leadId}`. Devuelve `true` si se persistió.
 * Nunca lanza: los errores se registran y se devuelven como `false`.
 */
export async function persistLead(input: LeadInput): Promise<boolean> {
  const db = getAdminDb();
  if (!db) {
    console.warn("[leads/no-db]", {
      leadId: input.leadId,
      msg: "Firestore admin no disponible — lead no persistido",
    });
    return false;
  }

  try {
    const now = new Date().toISOString();
    await db
      .collection("leads")
      .doc(input.leadId)
      .set(
        clean({
          ...input,
          email: input.email.trim().toLowerCase(),
          emailDomain: input.email.split("@")[1]?.toLowerCase() ?? "",
          status: "nuevo" satisfies LeadStatus,
          appEnv: process.env.NEXT_PUBLIC_APP_ENV ?? "production",
          createdAt: now,
          updatedAt: now,
        }),
        { merge: true },
      );
    console.log("[leads/persisted]", { leadId: input.leadId, origen: input.origen });
    return true;
  } catch (error) {
    console.error("[leads/persist-failed]", { leadId: input.leadId, error });
    return false;
  }
}
