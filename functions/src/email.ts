import { defineSecret } from "firebase-functions/params";

// Secret de Resend (se setea con: firebase functions:secrets:set RESEND_API_KEY).
export const resendApiKey = defineSecret("RESEND_API_KEY");

// Remitente verificado en Resend (dominio notificaciones.grupovivaru.com).
const FROM = "Vivaru <noreply@notificaciones.grupovivaru.com>";

export type AccountEmailVariant = "welcome" | "reset";

// Acceso a fetch global (Node 22) sin depender de los tipos del entorno.
const httpFetch = (globalThis as unknown as {
  fetch: (url: string, init: {
    method: string;
    headers: Record<string, string>;
    body: string;
  }) => Promise<{ ok: boolean; status: number; text: () => Promise<string> }>;
}).fetch;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const COPY: Record<AccountEmailVariant, {
  subject: string;
  intro: string;
  cta: string;
  footer: string;
}> = {
  welcome: {
    subject: "Define tu contraseña de acceso a Vivaru",
    intro:
      "Tu cuenta de Vivaru está lista. Define tu contraseña de acceso con el siguiente botón. Por seguridad, el enlace caduca pasado un tiempo.",
    cta: "Definir mi contraseña",
    footer: "Si no esperabas este correo, puedes ignorarlo.",
  },
  reset: {
    subject: "Restablece tu contraseña de Vivaru",
    intro:
      "Recibimos una solicitud para restablecer la contraseña de tu cuenta de Vivaru. Define una nueva contraseña con el siguiente botón. Por seguridad, el enlace caduca pasado un tiempo.",
    cta: "Restablecer mi contraseña",
    footer: "Si no solicitaste este cambio, ignora este correo: tu contraseña actual seguirá funcionando.",
  },
};

function buildHtml(fullName: string, link: string, variant: AccountEmailVariant): string {
  const copy = COPY[variant];
  const safeName = escapeHtml(fullName || "");
  const greeting = safeName ? `Hola ${safeName},` : "Hola,";
  return `<!doctype html>
<html lang="es"><body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:32px;max-width:480px;">
        <tr><td style="font-size:20px;font-weight:bold;color:#0f172a;padding-bottom:8px;">Vivaru</td></tr>
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

/**
 * Envía por Resend el correo de "define/restablece tu contraseña".
 * `variant`: "welcome" (cuenta nueva) | "reset" (restablecimiento).
 * Best-effort: no debe romper la creación del usuario si el correo falla.
 * Lanza si Resend responde error, para que el llamador lo registre.
 */
export async function sendAccountEmail(input: {
  to: string;
  fullName: string;
  link: string;
  variant: AccountEmailVariant;
}): Promise<void> {
  const apiKey = resendApiKey.value();
  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY no configurado; se omite el envío del correo de acceso.");
    return;
  }

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
      html: buildHtml(input.fullName, input.link, input.variant),
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Resend respondió ${response.status}: ${detail}`);
  }
}
