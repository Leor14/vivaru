import type { DiagnosticAnswers } from "@/lib/marketing/diagnostic-schema";
import { getScoreCategory } from "@/lib/marketing/diagnostic-score";
import { RECOMMENDATIONS } from "@/lib/marketing/diagnostic-recommendations";

const TOOLS_LABELS: Record<string, string> = {
  excel: "Excel",
  whatsapp: "WhatsApp",
  otroSoftware: "Otro software",
  libretas: "Libretas / papel",
  nada: "Nada estructurado",
};

const TIPO_LABELS: Record<string, string> = {
  vertical: "Edificios verticales",
  horizontal: "Conjuntos de casas",
  fraccionamiento: "Fraccionamientos",
  mixto: "Mixto",
};

const PILAR_LABELS: Record<string, string> = {
  cartera: "Cartera / morosidad",
  comunicacion: "Comunicación con residentes",
  porteria: "Portería / visitantes",
  gobernanza: "Gobernanza / auditoría",
};

const TIMELINE_LABELS: Record<string, string> = {
  "30dias": "Próximos 30 días",
  trimestre: "Este trimestre",
  anio: "Este año",
  investigando: "Solo investigando",
};

const CONJUNTOS_LABELS: Record<string, string> = {
  "1": "1 conjunto",
  "2-5": "2 a 5 conjuntos",
  "6-15": "6 a 15 conjuntos",
  "16+": "16 o más conjuntos",
};

const TIER_LABELS: Record<string, string> = {
  operacion: "Operación",
  profesional: "Profesional",
  enterprise: "Enterprise",
};

export type EmailContent = { subject: string; html: string; text: string };

export function buildKamNotificationEmail(
  answers: DiagnosticAnswers,
  meta: { score: number; leadId: string },
): EmailContent {
  const { score, leadId } = meta;
  const category = getScoreCategory(score);
  const recommendation = RECOMMENDATIONS[answers.q5_pilarDolor];
  const c = answers.q9_contacto;

  const subject = `[Lead Diagnóstico] ${c.nombre} · ${c.conjunto} · Score ${score} · ${PILAR_LABELS[answers.q5_pilarDolor]}`;

  const whatsappRow = c.whatsapp
    ? `<tr><td style="color:#64748B;padding:4px 0;">WhatsApp</td><td><a href="https://wa.me/${encodeURIComponent(c.whatsapp.replace(/\D/g, ""))}" style="color:#4B5FD4;">${escapeHtml(c.whatsapp)}</a></td></tr>`
    : "";

  const html = `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F4F6FA;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0F172A;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;padding:24px;">
  <tr><td>
    <div style="background:#0B3C5D;color:#fff;padding:24px;border-radius:8px 8px 0 0;">
      <div style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;opacity:0.7;">Lead Diagnóstico</div>
      <h1 style="font-family:Georgia,serif;font-size:28px;margin:8px 0 4px;">${escapeHtml(c.nombre)}</h1>
      <div style="font-size:15px;opacity:0.85;">${escapeHtml(c.conjunto)} · ${PILAR_LABELS[answers.q5_pilarDolor]}</div>
    </div>
    <div style="background:#fff;padding:24px;border-radius:0 0 8px 8px;border:1px solid #E2E8F0;border-top:none;">

      <div style="background:#F1F5F9;padding:16px;border-radius:8px;margin-bottom:24px;">
        <div style="font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:#475569;margin-bottom:6px;">Score</div>
        <div style="font-family:Georgia,serif;font-size:42px;line-height:1;font-weight:700;color:#0B3C5D;">${score}<span style="font-size:18px;color:#64748B;">/100</span></div>
        <div style="font-size:13px;color:#475569;margin-top:4px;">${category.label}</div>
      </div>

      <h2 style="font-family:Georgia,serif;font-size:14px;text-transform:uppercase;letter-spacing:0.08em;color:#475569;margin:24px 0 8px;">Contacto</h2>
      <table cellpadding="0" cellspacing="0" style="width:100%;font-size:14px;line-height:1.5;">
        <tr><td style="color:#64748B;padding:4px 0;width:40%;">Email</td><td><a href="mailto:${escapeHtml(c.email)}" style="color:#4B5FD4;">${escapeHtml(c.email)}</a></td></tr>
        ${whatsappRow}
        <tr><td style="color:#64748B;padding:4px 0;">Conjunto principal</td><td>${escapeHtml(c.conjunto)}</td></tr>
      </table>

      <h2 style="font-family:Georgia,serif;font-size:14px;text-transform:uppercase;letter-spacing:0.08em;color:#475569;margin:24px 0 8px;">Perfil</h2>
      <table cellpadding="0" cellspacing="0" style="width:100%;font-size:14px;line-height:1.5;">
        <tr><td style="color:#64748B;padding:4px 0;width:40%;">Conjuntos administrados</td><td>${CONJUNTOS_LABELS[answers.q1_conjuntos] ?? answers.q1_conjuntos}</td></tr>
        <tr><td style="color:#64748B;padding:4px 0;">Unidades totales</td><td><strong>${answers.q2_unidades}</strong></td></tr>
        <tr><td style="color:#64748B;padding:4px 0;">Tipo de conjunto</td><td>${answers.q3_tipoConjunto.map((t) => TIPO_LABELS[t]).join(" · ")}</td></tr>
        <tr><td style="color:#64748B;padding:4px 0;">Herramientas actuales</td><td>${answers.q4_herramientas.map((t) => TOOLS_LABELS[t]).join(" · ")}</td></tr>
      </table>

      <h2 style="font-family:Georgia,serif;font-size:14px;text-transform:uppercase;letter-spacing:0.08em;color:#475569;margin:24px 0 8px;">Dolor y urgencia</h2>
      <table cellpadding="0" cellspacing="0" style="width:100%;font-size:14px;line-height:1.5;">
        <tr><td style="color:#64748B;padding:4px 0;width:40%;">Pilar prioritario</td><td><strong>${PILAR_LABELS[answers.q5_pilarDolor]}</strong></td></tr>
        <tr><td style="color:#64748B;padding:4px 0;">Morosidad típica</td><td>${answers.q6_morosidad}%</td></tr>
        <tr><td style="color:#64748B;padding:4px 0;">Horas manuales/semana</td><td>${answers.q7_horasManuales} h</td></tr>
        <tr><td style="color:#64748B;padding:4px 0;">Timeline</td><td><strong>${TIMELINE_LABELS[answers.q8_timeline]}</strong></td></tr>
      </table>

      <div style="background:#F1F5F9;padding:16px;border-radius:8px;margin-top:24px;border-left:4px solid #4B5FD4;">
        <div style="font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:#475569;margin-bottom:6px;">Recomendación automática</div>
        <div style="font-family:Georgia,serif;font-size:18px;color:#0F172A;margin-bottom:4px;">${escapeHtml(recommendation.title)}</div>
        <div style="font-size:13px;color:#475569;">Plan sugerido: <strong>${TIER_LABELS[recommendation.recommendedTier]}</strong></div>
      </div>

      <div style="margin-top:32px;padding-top:16px;border-top:1px solid #E2E8F0;font-size:12px;color:#94A3B8;">
        Lead ID: <code>${leadId}</code> · Capturado vía <code>/diagnostico</code>
        <br><br>
        Para responder al lead, simplemente <strong>responde a este correo</strong> — el Reply-To está configurado a ${escapeHtml(c.email)}.
      </div>

    </div>
  </td></tr>
</table>
</body>
</html>`;

  const text = [
    `[Lead Diagnóstico] ${c.nombre} · ${c.conjunto}`,
    ``,
    `SCORE: ${score}/100 (${category.label})`,
    `PILAR: ${PILAR_LABELS[answers.q5_pilarDolor]}`,
    `TIMELINE: ${TIMELINE_LABELS[answers.q8_timeline]}`,
    ``,
    `CONTACTO`,
    `  Email: ${c.email}`,
    c.whatsapp ? `  WhatsApp: ${c.whatsapp}` : null,
    `  Conjunto: ${c.conjunto}`,
    ``,
    `PERFIL`,
    `  Conjuntos: ${CONJUNTOS_LABELS[answers.q1_conjuntos] ?? answers.q1_conjuntos}`,
    `  Unidades: ${answers.q2_unidades}`,
    `  Tipo: ${answers.q3_tipoConjunto.map((t) => TIPO_LABELS[t]).join(", ")}`,
    `  Herramientas: ${answers.q4_herramientas.map((t) => TOOLS_LABELS[t]).join(", ")}`,
    ``,
    `DOLOR`,
    `  Morosidad: ${answers.q6_morosidad}%`,
    `  Horas manuales/semana: ${answers.q7_horasManuales}`,
    ``,
    `RECOMENDACIÓN AUTOMÁTICA`,
    `  ${recommendation.title}`,
    `  Plan sugerido: ${TIER_LABELS[recommendation.recommendedTier]}`,
    ``,
    `Lead ID: ${leadId}`,
  ]
    .filter(Boolean)
    .join("\n");

  return { subject, html, text };
}

export function buildLeadConfirmationEmail(
  answers: DiagnosticAnswers,
  meta: { score: number; leadId: string },
): EmailContent {
  const category = getScoreCategory(meta.score);
  const recommendation = RECOMMENDATIONS[answers.q5_pilarDolor];
  const c = answers.q9_contacto;

  const subject = `Tu reporte de diagnóstico operativo · Vivaru`;

  const html = `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F4F6FA;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0F172A;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;padding:24px;">
  <tr><td>
    <div style="background:#0B3C5D;color:#fff;padding:32px 24px;border-radius:8px 8px 0 0;text-align:center;">
      <h1 style="font-family:Georgia,serif;font-size:24px;margin:0 0 4px;">${escapeHtml(c.nombre)}, este es tu diagnóstico</h1>
      <div style="font-size:14px;opacity:0.8;">${escapeHtml(c.conjunto)}</div>
    </div>
    <div style="background:#fff;padding:32px 24px;border-radius:0 0 8px 8px;border:1px solid #E2E8F0;border-top:none;">

      <div style="text-align:center;margin-bottom:24px;">
        <div style="font-family:Georgia,serif;font-size:56px;line-height:1;color:#0B3C5D;font-weight:700;">${meta.score}<span style="font-size:24px;color:#64748B;font-weight:400;">/100</span></div>
        <div style="font-size:14px;color:#475569;margin-top:8px;text-transform:uppercase;letter-spacing:0.08em;">${category.label}</div>
      </div>

      <div style="background:#F1F5F9;padding:20px;border-radius:8px;border-left:4px solid #4B5FD4;margin-bottom:24px;">
        <div style="font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:#475569;margin-bottom:8px;">Pilar prioritario · ${PILAR_LABELS[answers.q5_pilarDolor]}</div>
        <h2 style="font-family:Georgia,serif;font-size:20px;margin:0 0 12px;color:#0F172A;">${escapeHtml(recommendation.title)}</h2>
        <ul style="font-size:14px;line-height:1.6;color:#475569;padding-left:20px;margin:0;">
          ${recommendation.bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join("")}
        </ul>
      </div>

      <div style="margin-bottom:24px;">
        <div style="font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:#475569;margin-bottom:8px;">Lo que esto significa</div>
        <div style="font-size:14px;line-height:1.6;color:#0F172A;">${escapeHtml(recommendation.roiHook)}</div>
      </div>

      <div style="text-align:center;margin:32px 0;">
        <a href="https://grupovivaru.com/#hero" style="display:inline-block;background:#4B5FD4;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">Agenda una demo de 20 min →</a>
      </div>

      <div style="margin-top:32px;padding-top:16px;border-top:1px solid #E2E8F0;font-size:12px;color:#94A3B8;text-align:center;">
        Si tienes preguntas, responde a este correo. Te respondemos en menos de 24 horas hábiles.
        <br><br>
        Vivaru · Una solución de Qintilab S.A.S.
      </div>

    </div>
  </td></tr>
</table>
</body>
</html>`;

  const text = [
    `${c.nombre}, este es tu diagnóstico de ${c.conjunto}`,
    ``,
    `SCORE: ${meta.score}/100 (${category.label})`,
    ``,
    `PILAR PRIORITARIO · ${PILAR_LABELS[answers.q5_pilarDolor]}`,
    recommendation.title,
    ``,
    ...recommendation.bullets.map((b) => `  • ${b}`),
    ``,
    `Lo que esto significa: ${recommendation.roiHook}`,
    ``,
    `Agenda una demo: https://grupovivaru.com/#hero`,
    ``,
    `Si tienes preguntas, responde a este correo.`,
    `Vivaru · Una solución de Qintilab S.A.S.`,
  ].join("\n");

  return { subject, html, text };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
