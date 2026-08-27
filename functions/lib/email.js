"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resendApiKey = void 0;
exports.idDeRespuestaResend = idDeRespuestaResend;
exports.registrarEnvio = registrarEnvio;
exports.sendNotificationEmail = sendNotificationEmail;
exports.sendAccountEmail = sendAccountEmail;
const firestore_1 = require("firebase-admin/firestore");
const params_1 = require("firebase-functions/params");
const feature_flags_1 = require("./feature-flags");
// Secret de Resend (se setea con: firebase functions:secrets:set RESEND_API_KEY).
exports.resendApiKey = (0, params_1.defineSecret)("RESEND_API_KEY");
// Remitente verificado en Resend (dominio notificaciones.grupovivaru.com).
const FROM = "Vivaru <noreply@notificaciones.grupovivaru.com>";
// Acceso a fetch global (Node 22) sin depender de los tipos del entorno.
const httpFetch = globalThis.fetch;
function escapeHtml(value) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}
const COPY = {
    welcome: {
        subject: "Define tu contraseña de acceso a Vivaru",
        intro: "Tu cuenta de Vivaru está lista. Define tu contraseña de acceso con el siguiente botón. Por seguridad, el enlace caduca pasado un tiempo.",
        cta: "Definir mi contraseña",
        footer: "Si no esperabas este correo, puedes ignorarlo.",
    },
    reset: {
        subject: "Restablece tu contraseña de Vivaru",
        intro: "Recibimos una solicitud para restablecer la contraseña de tu cuenta de Vivaru. Define una nueva contraseña con el siguiente botón. Por seguridad, el enlace caduca pasado un tiempo.",
        cta: "Restablecer mi contraseña",
        footer: "Si no solicitaste este cambio, ignora este correo: tu contraseña actual seguirá funcionando.",
    },
};
function buildHtml(fullName, link, variant) {
    const copy = COPY[variant];
    const safeName = escapeHtml(fullName || "");
    const greeting = safeName ? `Hola ${safeName},` : "Hola,";
    return `<!doctype html>
<html lang="es"><body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:32px;max-width:480px;">
        <tr><td style="padding-bottom:12px;">
          <img src="https://www.grupovivaru.com/images/vivaru.jpeg" alt="Vivaru" width="44" height="44" style="border-radius:10px;display:block;border:0;outline:none;text-decoration:none;" />
        </td></tr>
        <tr><td style="font-size:15px;line-height:1.6;padding-bottom:16px;">${greeting}</td></tr>
        <tr><td style="font-size:15px;line-height:1.6;padding-bottom:24px;">${copy.intro}</td></tr>
        <tr><td style="padding-bottom:24px;">
          <a href="${link}" style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:12px 24px;border-radius:10px;">${copy.cta}</a>
        </td></tr>
        <tr><td style="font-size:13px;line-height:1.6;color:#475569;padding-bottom:8px;">
          Si el botón no funciona, copia y pega este enlace en tu navegador:
        </td></tr>
        <tr><td style="font-size:12px;line-height:1.5;color:#475569;word-break:break-all;padding-bottom:24px;">${link}</td></tr>
        <tr><td style="font-size:12px;line-height:1.5;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:16px;">
          ${copy.footer}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}
// Base pública de la app para construir el CTA absoluto de las notificaciones.
const APP_BASE_URL = "https://www.grupovivaru.com";
function buildNotificationHtml(body, ctaUrl) {
    const safeBody = escapeHtml(body);
    return `<!doctype html>
<html lang="es"><body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:32px;max-width:480px;">
        <tr><td style="padding-bottom:12px;">
          <img src="https://www.grupovivaru.com/images/vivaru.jpeg" alt="Vivaru" width="44" height="44" style="border-radius:10px;display:block;border:0;outline:none;text-decoration:none;" />
        </td></tr>
        <tr><td style="font-size:15px;line-height:1.6;padding-bottom:24px;">${safeBody}</td></tr>
        <tr><td style="padding-bottom:24px;">
          <a href="${ctaUrl}" style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:12px 24px;border-radius:10px;">Ver en Vivaru</a>
        </td></tr>
        <tr><td style="font-size:12px;line-height:1.5;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:16px;">
          Recibes este correo porque la administración de tu conjunto activó las notificaciones por correo en Vivaru.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}
/**
 * Envía por Resend una notificación al residente (cartera, PQRS, reglamento, etc.).
 * Best-effort: el llamador captura el error para no romper la notificación in-app.
 * `link` puede ser relativo ("/resident/...") o absoluto.
 */
/**
 * El id que Resend devuelve al ACEPTAR un correo, sacado del cuerpo de su respuesta.
 *
 * **Existe porque `PRD-V-FLOW-003` cuelga de este valor y el producto no lo capturaba.** §7.1 usa
 * el id del proveedor como id del documento de `emailDeliveries`, «para que la idempotencia del
 * webhook la garantice la base»; hasta hoy `sendNotificationEmail` miraba solo `response.ok` y
 * **tiraba el cuerpo**, así que ese id no existía en ninguna parte.
 *
 * **Pura y tolerante, las dos a propósito.** Pura para poder probarla sin red ni emulador — no hay
 * en este repositorio ningún patrón para simular `fetch`, y `email.ts` captura `fetch` al cargar el
 * módulo, así que interceptarlo exigiría inventar uno—. Y tolerante porque **el correo ya salió**
 * cuando esto corre: si el cuerpo viene raro se pierde el rastro, que es malo, pero romper aquí
 * convertiría un correo entregado en un error para quien lo mandó, que es peor.
 */
function idDeRespuestaResend(cuerpo) {
    try {
        const d = JSON.parse(cuerpo);
        return typeof d.id === "string" && d.id.trim() ? d.id.trim() : null;
    }
    catch {
        return null;
    }
}
const db = () => (0, firestore_1.getFirestore)();
/**
 * Deja constancia de un correo ACEPTADO por el proveedor.
 *
 * **El id del documento es el del proveedor** (§7.1), para que la idempotencia del webhook la
 * garantice la base y no una comprobación previa: el mismo evento llegando dos veces escribe el
 * mismo documento.
 *
 * **Nunca lanza.** Cuando esto corre el correo ya salió; un fallo al registrar pierde el rastro,
 * pero propagarlo convertiría un correo entregado en un error para quien lo mandó. Misma
 * disciplina que el resto del módulo, que es «best-effort» por contrato.
 */
async function registrarEnvio(providerMessageId, ctx, input) {
    try {
        // **La bandera se comprueba EN EL SERVIDOR**, que es lo que la convierte en freno y no en
        // botón. Apagada, no se escribe una sola fila — y por tanto el webhook tampoco tendrá nada
        // que mover, que es la forma coherente de que «apagado» signifique apagado.
        if (!(await (0, feature_flags_1.isFeatureEnabled)("producto-entrega-de-correo", ctx.tenantId)))
            return;
        await db().collection("emailDeliveries").doc(providerMessageId).set({
            tenantId: ctx.tenantId,
            providerMessageId,
            recipientEmail: input.to,
            recipientUserId: ctx.recipientUserId ?? null,
            notificationKey: ctx.notificationKey,
            subject: input.subject,
            status: "enviado",
            sentAt: firestore_1.Timestamp.now(),
            updatedAt: firestore_1.Timestamp.now(),
        });
    }
    catch (e) {
        console.error("[email] no se pudo registrar el envío", providerMessageId, e);
    }
}
/**
 * Devuelve el id del proveedor cuando Resend lo da, y `null` cuando no hay con qué —sin clave
 * configurada, o respuesta sin id—. **Nunca devuelve `null` por un fallo de envío**: eso sigue
 * lanzando, como antes.
 */
async function sendNotificationEmail(input) {
    const apiKey = exports.resendApiKey.value();
    if (!apiKey) {
        console.warn("[email] RESEND_API_KEY no configurado; se omite el correo de notificación.");
        return null;
    }
    const ctaUrl = input.link.startsWith("http") ? input.link : `${APP_BASE_URL}${input.link}`;
    const response = await httpFetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            from: FROM,
            to: input.to,
            subject: input.subject,
            html: buildNotificationHtml(input.body, ctaUrl),
            // Resend recibe el contenido en base64. Va solo si viene: un `attachments: []`
            // vacío es distinto de no mandarlo y no hace falta averiguar cuánto.
            ...(input.adjunto
                ? { attachments: [{ filename: input.adjunto.nombre, content: input.adjunto.buffer.toString("base64") }] }
                : {}),
        }),
    });
    if (!response.ok) {
        const detail = await response.text();
        throw new Error(`Resend respondió ${response.status}: ${detail}`);
    }
    // Leer el cuerpo va DESPUÉS del `ok`, y su fallo no se propaga: a estas alturas Resend ya aceptó
    // el correo y el destinatario lo va a recibir.
    let providerMessageId = null;
    try {
        providerMessageId = idDeRespuestaResend(await response.text());
    }
    catch {
        providerMessageId = null;
    }
    if (providerMessageId && input.contexto) {
        await registrarEnvio(providerMessageId, input.contexto, input);
    }
    return providerMessageId;
}
/**
 * Envía por Resend el correo de "define/restablece tu contraseña".
 * `variant`: "welcome" (cuenta nueva) | "reset" (restablecimiento).
 * Best-effort: no debe romper la creación del usuario si el correo falla.
 * Lanza si Resend responde error, para que el llamador lo registre.
 */
async function sendAccountEmail(input) {
    const apiKey = exports.resendApiKey.value();
    if (!apiKey) {
        console.warn("[email] RESEND_API_KEY no configurado; se omite el envío del correo de acceso.");
        return;
    }
    // Los correos requieren URL absoluta. Los enlaces de Firebase ya vienen absolutos
    // (http…); los propios (p. ej. /activar?token=…) se prefijan con la base pública.
    const absoluteLink = input.link.startsWith("http") ? input.link : `${APP_BASE_URL}${input.link}`;
    const response = await httpFetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            from: FROM,
            to: input.to,
            subject: COPY[input.variant].subject,
            html: buildHtml(input.fullName, absoluteLink, input.variant),
        }),
    });
    if (!response.ok) {
        const detail = await response.text();
        throw new Error(`Resend respondió ${response.status}: ${detail}`);
    }
}
