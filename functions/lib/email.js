"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resendApiKey = void 0;
exports.sendNotificationEmail = sendNotificationEmail;
exports.sendAccountEmail = sendAccountEmail;
const params_1 = require("firebase-functions/params");
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
async function sendNotificationEmail(input) {
    const apiKey = exports.resendApiKey.value();
    if (!apiKey) {
        console.warn("[email] RESEND_API_KEY no configurado; se omite el correo de notificación.");
        return;
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
        }),
    });
    if (!response.ok) {
        const detail = await response.text();
        throw new Error(`Resend respondió ${response.status}: ${detail}`);
    }
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
