import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { Resend } from "resend";
import { z } from "zod";

export const runtime = "nodejs";

// ── Schema ────────────────────────────────────────────────────────────────────

const demoSchema = z.object({
  nombre: z.string().min(2).max(120),
  email: z.string().email().max(200),
  telefono: z.string().max(30).default(""),
  empresa: z.string().min(2).max(200),
  cargo: z.string().max(120).default(""),
  conjuntos: z.enum(["1", "2-5", "6-15", "16+"]),
  unidades: z.string().max(10).default(""),
  timeline: z.enum(["30dias", "trimestre", "anio", "investigando"]),
});

type DemoData = z.infer<typeof demoSchema>;

// ── Rate limiting ─────────────────────────────────────────────────────────────

type Bucket = { count: number; resetAt: number };
const RATE_WINDOW_MS = 10 * 60 * 1000; // 10 min
const RATE_LIMIT = 3; // stricter than /api/lead since this is a live form
const buckets = new Map<string, Bucket>();

function getClientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const bucket = buckets.get(ip);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  bucket.count += 1;
  return bucket.count > RATE_LIMIT;
}

// ── Resend setup ──────────────────────────────────────────────────────────────

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

// Supports comma-separated list: "dev@qintilab.com,comercial@qintilab.com"
const NOTIFY_TO: string[] = (
  process.env.DEMO_NOTIFICATION_TO || "comercial@qintilab.com"
)
  .split(",")
  .map((e) => e.trim())
  .filter(Boolean);

const NOTIFY_FROM =
  process.env.LEAD_NOTIFICATION_FROM || "Vivaru <onboarding@resend.dev>";

// ── Labels ────────────────────────────────────────────────────────────────────

const CONJUNTOS_LABELS: Record<string, string> = {
  "1": "1 conjunto",
  "2-5": "2 a 5 conjuntos",
  "6-15": "6 a 15 conjuntos",
  "16+": "16 o más conjuntos",
};

const TIMELINE_LABELS: Record<string, string> = {
  "30dias": "En los próximos 30 días",
  trimestre: "Este trimestre",
  anio: "Este año",
  investigando: "Solo explorando opciones",
};

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const ip = getClientIp(request);
  if (rateLimited(ip)) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_json" },
      { status: 400 }
    );
  }

  const parsed = demoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "validation_failed",
        issues: parsed.error.flatten(),
      },
      { status: 400 }
    );
  }

  const d = parsed.data;
  const leadId = randomUUID();

  console.log("[demo/new]", {
    leadId,
    ts: new Date().toISOString(),
    ip,
    emailDomain: d.email.split("@")[1]?.toLowerCase() ?? "",
    conjuntos: d.conjuntos,
    timeline: d.timeline,
  });

  // Email dispatch — best-effort, never blocks lead capture success
  if (resend) {
    const notifEmail = buildNotificationEmail(d, leadId);
    const confirmEmail = buildConfirmationEmail(d);

    try {
      const result = await resend.emails.send({
        from: NOTIFY_FROM,
        to: NOTIFY_TO,
        replyTo: d.email,
        subject: notifEmail.subject,
        html: notifEmail.html,
        text: notifEmail.text,
        tags: [{ name: "type", value: "demo_notification" }],
      });
      if (result.error) {
        console.error("[demo/email-notif-failed]", { leadId, error: result.error });
      } else {
        console.log("[demo/email-notif-ok]", { leadId, resendId: result.data?.id });
      }
    } catch (err) {
      console.error("[demo/email-notif-threw]", { leadId, err });
    }

    try {
      const result = await resend.emails.send({
        from: NOTIFY_FROM,
        to: [d.email],
        replyTo: NOTIFY_TO,
        subject: confirmEmail.subject,
        html: confirmEmail.html,
        text: confirmEmail.text,
        tags: [{ name: "type", value: "demo_confirmation" }],
      });
      if (result.error) {
        console.error("[demo/email-confirm-failed]", { leadId, error: result.error });
      } else {
        console.log("[demo/email-confirm-ok]", { leadId, resendId: result.data?.id });
      }
    } catch (err) {
      console.error("[demo/email-confirm-threw]", { leadId, err });
    }
  } else {
    console.warn(
      "[demo/no-resend] RESEND_API_KEY not configured — skipping email send"
    );
  }

  return NextResponse.json({ ok: true, leadId });
}

// ── Email builders ────────────────────────────────────────────────────────────

type EmailContent = { subject: string; html: string; text: string };

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildNotificationEmail(d: DemoData, leadId: string): EmailContent {
  const subject = `[Demo] ${d.nombre} · ${d.empresa} · ${CONJUNTOS_LABELS[d.conjuntos]} · ${TIMELINE_LABELS[d.timeline]}`;

  const phoneRow = d.telefono
    ? `<tr><td style="color:#64748B;padding:4px 0;width:40%;">WhatsApp&nbsp;/&nbsp;Tel</td><td>${escapeHtml(d.telefono)}</td></tr>`
    : "";
  const cargoRow = d.cargo
    ? `<tr><td style="color:#64748B;padding:4px 0;">Cargo</td><td>${escapeHtml(d.cargo)}</td></tr>`
    : "";
  const unidadesRow = d.unidades
    ? `<tr><td style="color:#64748B;padding:4px 0;">Unidades&nbsp;aprox.</td><td>${escapeHtml(d.unidades)}</td></tr>`
    : "";

  const html = `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F4F6FA;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0F172A;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;padding:24px;">
  <tr><td>
    <div style="background:#0B3C5D;color:#fff;padding:24px;border-radius:8px 8px 0 0;">
      <div style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;opacity:0.7;">Solicitud de Demo · Vivaru</div>
      <h1 style="font-family:Georgia,serif;font-size:26px;margin:8px 0 4px;">${escapeHtml(d.nombre)}</h1>
      <div style="font-size:15px;opacity:0.85;">${escapeHtml(d.empresa)}</div>
    </div>
    <div style="background:#fff;padding:24px;border-radius:0 0 8px 8px;border:1px solid #E2E8F0;border-top:none;">

      <h2 style="font-family:Georgia,serif;font-size:13px;text-transform:uppercase;letter-spacing:0.08em;color:#475569;margin:0 0 8px;">Contacto</h2>
      <table cellpadding="0" cellspacing="0" style="width:100%;font-size:14px;line-height:1.6;">
        <tr><td style="color:#64748B;padding:4px 0;width:40%;">Email</td><td><a href="mailto:${escapeHtml(d.email)}" style="color:#4B5FD4;">${escapeHtml(d.email)}</a></td></tr>
        ${phoneRow}
      </table>

      <h2 style="font-family:Georgia,serif;font-size:13px;text-transform:uppercase;letter-spacing:0.08em;color:#475569;margin:20px 0 8px;">Perfil</h2>
      <table cellpadding="0" cellspacing="0" style="width:100%;font-size:14px;line-height:1.6;">
        ${cargoRow}
        <tr><td style="color:#64748B;padding:4px 0;width:40%;">Conjuntos</td><td><strong>${escapeHtml(CONJUNTOS_LABELS[d.conjuntos])}</strong></td></tr>
        ${unidadesRow}
        <tr><td style="color:#64748B;padding:4px 0;">Timeline</td><td><strong style="color:#0B3C5D;">${escapeHtml(TIMELINE_LABELS[d.timeline])}</strong></td></tr>
      </table>

      <div style="margin-top:24px;padding:12px 16px;background:#F1F5F9;border-radius:8px;font-size:12px;color:#94A3B8;">
        Lead ID: <code>${leadId}</code> · Capturado vía /demo-dialog<br>
        Para responder, simplemente <strong>responde a este correo</strong> — Reply-To: ${escapeHtml(d.email)}
      </div>
    </div>
  </td></tr>
</table>
</body>
</html>`;

  const text = [
    subject,
    "",
    `Email: ${d.email}`,
    d.telefono ? `WhatsApp/Tel: ${d.telefono}` : null,
    d.cargo ? `Cargo: ${d.cargo}` : null,
    "",
    `Conjuntos: ${CONJUNTOS_LABELS[d.conjuntos]}`,
    d.unidades ? `Unidades aprox.: ${d.unidades}` : null,
    `Timeline: ${TIMELINE_LABELS[d.timeline]}`,
    "",
    `Lead ID: ${leadId}`,
  ]
    .filter(Boolean)
    .join("\n");

  return { subject, html, text };
}

function buildConfirmationEmail(d: DemoData): EmailContent {
  const firstName = d.nombre.split(" ")[0];
  const subject = "Recibimos tu solicitud de demo · Vivaru";

  const html = `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F4F6FA;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0F172A;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;padding:24px;">
  <tr><td>
    <div style="background:#0B3C5D;color:#fff;padding:32px 24px;border-radius:8px 8px 0 0;text-align:center;">
      <h1 style="font-family:Georgia,serif;font-size:22px;margin:0 0 4px;">¡Recibimos tu solicitud, ${escapeHtml(firstName)}!</h1>
      <div style="font-size:14px;opacity:0.8;">Vivaru · Demo agendada</div>
    </div>
    <div style="background:#fff;padding:32px 24px;border-radius:0 0 8px 8px;border:1px solid #E2E8F0;border-top:none;text-align:center;">
      <div style="font-size:44px;line-height:1;margin-bottom:20px;">✅</div>
      <p style="font-size:16px;line-height:1.6;color:#0F172A;margin:0 0 12px;">
        Nuestro equipo comercial revisará tu solicitud y te contactará a la brevedad.
      </p>
      <p style="font-size:14px;color:#475569;margin:0 0 32px;">
        Normalmente respondemos en <strong>menos de 24 horas hábiles</strong>.
      </p>
      <a href="https://grupovivaru.com/mx" style="display:inline-block;background:#4B5FD4;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">
        Ver Vivaru →
      </a>
      <div style="margin-top:32px;padding-top:16px;border-top:1px solid #E2E8F0;font-size:12px;color:#94A3B8;">
        Si tienes alguna pregunta, responde a este correo.<br>
        Vivaru · Una solución de Qintilab S.A.S.
      </div>
    </div>
  </td></tr>
</table>
</body>
</html>`;

  const text = [
    `¡Recibimos tu solicitud, ${firstName}!`,
    "",
    "Nuestro equipo comercial te contactará a la brevedad (menos de 24 horas hábiles).",
    "",
    "Si tienes preguntas, responde a este correo.",
    "Vivaru · Una solución de Qintilab S.A.S.",
    "Ver Vivaru: https://grupovivaru.com/mx",
  ].join("\n");

  return { subject, html, text };
}
