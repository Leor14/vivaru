import { FieldValue, type DocumentReference } from "firebase-admin/firestore";
import { tokenDeIdentidad } from "./albert-senal-de-vuelta";

/**
 * El envío de leads a Albert CRM: cada lead que nace en Vivaru se empuja a `vivaruPushLead`,
 * que crea el contacto y el deal en `tenants/vivaru`. La otra mitad de `REVOPS-001C`. Estado
 * vivo: `docs/prd/albert/ESTADO-ALBERT.md`; contrato: `RESPUESTA-A-007`, parte de
 * `vivaruPushLead`.
 *
 * **Cuándo: al crearse el lead** (decisión de David, 22 sep 2026). Corre como trigger de
 * `leads/{leadId}` y no desde las rutas web por una razón que no se ve en el código: las rutas
 * corren en App Hosting con OTRA cuenta de servicio, y Albert solo autoriza la de las Cloud
 * Functions. Además así el formulario no espera a Albert.
 *
 * ## Lo que hay que saber antes de tocarlo
 *
 * - **El modo va por ambiente, y por defecto es `apagado`.** Staging solo simula (`dryRun`):
 *   Albert tiene UN ambiente y un lead de staging ensuciaría el CRM real, así que su endpoint
 *   responde 403 `dry_run_only` a la cuenta de staging sin `dryRun`. **Producción no envía**
 *   hasta que David añada `hogaru-1: "real"`. La cuenta de producción es la misma para las 90
 *   functions, así que este mapa es el único freno de nuestro lado.
 * - **Idempotente por `leadId`.** Albert deriva los ids del deal y del contacto del `leadId`, así
 *   que reenviar el mismo lead devuelve el mismo deal. Por eso no hace falta bloquear nada aquí.
 * - **El contacto va antes que el deal, y lo garantiza Albert** (una transacción en su
 *   endpoint). Esa era la promesa que le hicimos cuando no hizo `contactId` obligatorio.
 * - **Sin consentimiento no se envía.** Hoy los leads de `trial` nacen sin él
 *   (`trial-workspace.ts`), y se marcan `omitido` en vez de romper.
 * - **El resultado se escribe en el propio lead** (`albertEnvio`). En modo real también se rellena
 *   `crmRef` con `albert:deal:vivaru:<dealId>`, el formato que valida `src/lib/albert/crm-ref.ts`.
 */

export const PUSH_LEAD_URL = "https://vivarupushlead-winvdvwn6q-uc.a.run.app";

export type Modo = "apagado" | "dryRun" | "real";

/** Añadir `"hogaru-1": "real"` es decisión de David, no de una sesión. */
export const MODO_POR_AMBIENTE: Readonly<Record<string, Modo>> = {
  "vivaru-staging-02": "dryRun",
};

export function modoDelAmbiente(proyecto = process.env.GCLOUD_PROJECT ?? ""): Modo {
  return MODO_POR_AMBIENTE[proyecto] ?? "apagado";
}

export type PeticionPush = {
  contact: {
    name: string;
    email: string;
    phone?: string;
    company?: string;
    jobTitle?: string;
    consent: { policyVersion: string; acceptedAt: string };
  };
  deal: {
    externalRef: { system: "vivaru"; leadId: string };
    estimatedUnits?: number;
    country?: string;
    amount: 0;
    origin: "demo" | "diagnostico" | "trial";
  };
};

export type RespuestaPush = {
  ok: true;
  dryRun: boolean;
  created: boolean;
  dealId: string;
  contactId: string;
  contactReused?: boolean;
  duplicateOf?: string;
  crmRef?: string;
};

const ORIGENES = new Set(["demo", "diagnostico", "trial"]);
const TELEFONO = /^[+()\-\d ]{7,20}$/;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
const PAIS = /^[A-Z]{2}$/;

function texto(valor: unknown, max: number): string | undefined {
  if (typeof valor !== "string") return undefined;
  const limpio = valor.trim();
  return limpio ? limpio.slice(0, max) : undefined;
}

/** Las unidades llegan como número (diagnóstico) o como texto libre (demo, hasta 10 caracteres). */
export function unidadesEstimadas(valor: unknown): number | undefined {
  if (typeof valor === "number" && Number.isInteger(valor) && valor >= 0) return valor;
  if (typeof valor === "string" && /^\d{1,6}$/.test(valor.trim())) return Number(valor.trim());
  return undefined;
}

/**
 * Traduce un documento de `leads` al contrato de `vivaruPushLead`. Lo que el contrato exige
 * y falta hace que el lead se OMITA con un motivo; lo opcional que viene mal se deja fuera
 * sin tumbar el envío (un teléfono con letras no debe costar el lead entero).
 */
export function construirPeticion(
  leadId: string,
  lead: Record<string, unknown>,
): { ok: true; peticion: PeticionPush } | { ok: false; motivo: string } {
  const origen = lead.origen;
  if (typeof origen !== "string" || !ORIGENES.has(origen)) return { ok: false, motivo: "origen_desconocido" };

  const consent = lead.consent as { granted?: unknown; at?: unknown; policyVersion?: unknown } | undefined;
  if (!consent || consent.granted !== true || typeof consent.at !== "string" || !ISO.test(consent.at)) {
    return { ok: false, motivo: "sin_consentimiento" };
  }
  const policyVersion = texto(consent.policyVersion, 40);
  if (!policyVersion) return { ok: false, motivo: "sin_consentimiento" };

  const name = texto(lead.nombre, 120);
  if (!name || name.length < 2) return { ok: false, motivo: "nombre_invalido" };
  const email = typeof lead.email === "string" ? lead.email.trim().toLowerCase() : "";
  if (!EMAIL.test(email) || email.length > 160) return { ok: false, motivo: "email_invalido" };
  if (leadId.length > 120) return { ok: false, motivo: "leadId_largo" };

  const telefono = texto(lead.telefono, 20);
  const pais = typeof lead.pais === "string" ? lead.pais.trim().toUpperCase() : "";
  const unidades = unidadesEstimadas(lead.unidadesEstimadas);

  const peticion: PeticionPush = {
    contact: {
      name,
      email,
      ...(telefono && TELEFONO.test(telefono) ? { phone: telefono } : {}),
      ...(texto(lead.empresa, 120) ? { company: texto(lead.empresa, 120) } : {}),
      ...(texto(lead.cargo, 120) ? { jobTitle: texto(lead.cargo, 120) } : {}),
      consent: { policyVersion, acceptedAt: consent.at },
    },
    deal: {
      externalRef: { system: "vivaru", leadId },
      ...(unidades !== undefined ? { estimatedUnits: unidades } : {}),
      ...(PAIS.test(pais) ? { country: pais } : {}),
      amount: 0,
      origin: origen as PeticionPush["deal"]["origin"],
    },
  };
  return { ok: true, peticion };
}

export type Envio = (peticion: PeticionPush, dryRun: boolean) => Promise<RespuestaPush>;

export const envioReal: Envio = async (peticion, dryRun) => {
  const token = await tokenDeIdentidad(PUSH_LEAD_URL);
  const r = await fetch(`${PUSH_LEAD_URL}${dryRun ? "?dryRun=1" : ""}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(peticion),
  });
  // El cuerpo de un error trae un código y el campo que falla, sin datos personales.
  if (!r.ok) throw new Error(`push_lead_${r.status}:${(await r.text()).slice(0, 200)}`);
  return (await r.json()) as RespuestaPush;
};

export type Resultado =
  | { estado: "apagado" }
  | { estado: "omitido"; motivo: string }
  | { estado: "simulado" | "enviado"; respuesta: RespuestaPush }
  | { estado: "error"; error: string };

/**
 * Procesa un lead recién creado. Nunca lanza: el resultado se devuelve para escribirlo en el
 * lead y en el log. Un error de Albert NO se reintenta solo —un 400 se repetiría para
 * siempre—; queda en el lead y se reenvía a mano, que es seguro porque el envío es idempotente.
 */
export async function procesarLead(
  leadId: string,
  lead: Record<string, unknown>,
  modo: Modo,
  enviar: Envio,
): Promise<Resultado> {
  if (modo === "apagado") return { estado: "apagado" };
  const construida = construirPeticion(leadId, lead);
  if (!construida.ok) return { estado: "omitido", motivo: construida.motivo };
  const dryRun = modo !== "real";
  try {
    const respuesta = await enviar(construida.peticion, dryRun);
    if (respuesta?.ok !== true || typeof respuesta.dealId !== "string") {
      return { estado: "error", error: "respuesta_invalida" };
    }
    if (respuesta.dryRun !== dryRun) return { estado: "error", error: "dryRun_no_coincide" };
    return { estado: dryRun ? "simulado" : "enviado", respuesta };
  } catch (error) {
    return { estado: "error", error: error instanceof Error ? error.message.slice(0, 300) : String(error) };
  }
}

/** Lo que se guarda en el lead. En modo real, además, el `crmRef` si el lead no tenía uno. */
export function camposParaElLead(resultado: Resultado, lead: Record<string, unknown>): Record<string, unknown> {
  const base: Record<string, unknown> = { estado: resultado.estado, en: FieldValue.serverTimestamp() };
  if (resultado.estado === "omitido") base.motivo = resultado.motivo;
  if (resultado.estado === "error") base.error = resultado.error;
  if (resultado.estado === "simulado" || resultado.estado === "enviado") {
    const r = resultado.respuesta;
    Object.assign(base, {
      dryRun: r.dryRun,
      created: r.created,
      dealId: r.dealId,
      contactId: r.contactId,
      contactReused: r.contactReused ?? null,
      duplicateOf: r.duplicateOf ?? null,
    });
  }
  const campos: Record<string, unknown> = { albertEnvio: base };
  if (resultado.estado === "enviado" && !lead.crmRef) {
    campos.crmRef = `albert:deal:vivaru:${resultado.respuesta.duplicateOf ?? resultado.respuesta.dealId}`;
  }
  return campos;
}

export async function enviarLeadRecienCreado(
  ref: DocumentReference,
  lead: Record<string, unknown>,
  modo = modoDelAmbiente(),
  enviar: Envio = envioReal,
): Promise<Resultado> {
  const resultado = await procesarLead(ref.id, lead, modo, enviar);
  if (resultado.estado !== "apagado") {
    await ref.set(camposParaElLead(resultado, lead), { merge: true });
  }
  return resultado;
}
