import { z } from "zod";

/**
 * Consentimiento del lead para el tratamiento de sus datos (`REVOPS-001A`).
 *
 * **Qué había antes.** El diagnóstico ya pedía una casilla expresa y la
 * validaba en cliente y en servidor — eso estaba bien y no se toca. Lo que no
 * estaba bien es dónde acababa: dentro de `meta.respuestas.q9_contacto.consent`,
 * **sin fecha y sin poder consultarse**. Para responder «¿quién autorizó y
 * cuándo?» había que abrir el JSON del diagnóstico lead por lead. Y el
 * formulario de demo no pedía nada en absoluto.
 *
 * **La fecha la pone el servidor, no el navegador.** El reloj del cliente lo
 * controla quien envía el formulario, así que no sirve como prueba de cuándo se
 * autorizó. El navegador solo aporta el hecho —marcó la casilla— y el servidor
 * pone el momento.
 *
 * **Se guarda la versión de la política**, no solo un `true`. Un consentimiento
 * sin decir a qué texto se dio no acredita gran cosa: cuando la política cambie,
 * hay que poder distinguir quién aceptó la 1.0 de quién aceptó la siguiente.
 *
 * Contexto legal del documento aceptado: la política declara cumplimiento de la
 * **Ley 1581 de 2012** de Colombia y de la **LFPDPPP** de México. La 1581 exige
 * autorización «previa, expresa e informada», que es lo que sostiene la casilla
 * marcada frente al envío implícito del formulario.
 */

/** Versión vigente de `src/content/legal/privacidad.md`. Actualizar AMBAS a la vez. */
export const POLITICA_VERSION = "1.0";

/** Ruta real donde se publica. Ojo: el documento se declara a sí mismo en
 *  `grupovivaru.com/privacidad`, pero la ruta servida es esta. */
export const POLITICA_URL = "/legal/privacidad";

/**
 * Lo que manda el cliente: solo el hecho. Rechaza `false` y rechaza la ausencia
 * — un lead sin consentimiento no se crea, aunque llamen la API a mano saltándose
 * el formulario.
 */
export const consentimientoSchema = z.boolean().refine((v) => v === true, {
  message: "Se requiere el consentimiento para el tratamiento de datos",
});

export type ConsentimientoLead = {
  granted: true;
  /** ISO. Puesta por el servidor. */
  at: string;
  policyVersion: string;
  policyUrl: string;
  method: "explicit_checkbox";
};

/** Construye el registro que se guarda junto al lead. */
export function registrarConsentimiento(ahora = new Date()): ConsentimientoLead {
  return {
    granted: true,
    at: ahora.toISOString(),
    policyVersion: POLITICA_VERSION,
    policyUrl: POLITICA_URL,
    method: "explicit_checkbox",
  };
}
