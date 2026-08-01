import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { Resend } from "resend";

import { diagnosticSchema } from "@/lib/marketing/diagnostic-schema";
import { persistLead } from "@/lib/marketing/leads";
import { envSubject, resolveNotifyTo } from "@/lib/marketing/notify-target";
import { calculateScore } from "@/lib/marketing/diagnostic-score";
import { RECOMMENDATIONS } from "@/lib/marketing/diagnostic-recommendations";
import {
  buildKamNotificationEmail,
  buildLeadConfirmationEmail,
} from "@/lib/marketing/emails/lead-notification";

export const runtime = "nodejs";

// In-memory rate limit: 5 requests per 10 minutes per IP.
// Resets on every cold start — acceptable for current traffic level.
type Bucket = { count: number; resetAt: number };
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT = 5;
const buckets = new Map<string, Bucket>();

function getClientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
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

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

// Supports comma-separated list: "dev@qintilab.com,comercial@qintilab.com"
// Fuera de producción se descartan los buzones comerciales (ver notify-target).
const NOTIFY_TO: string[] = resolveNotifyTo(
  process.env.LEAD_NOTIFICATION_TO,
  "comercial@qintilab.com",
);

const NOTIFY_FROM =
  process.env.LEAD_NOTIFICATION_FROM || "Vivaru <onboarding@resend.dev>";

export async function POST(request: Request) {
  const ip = getClientIp(request);
  if (rateLimited(ip)) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const parsed = diagnosticSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "validation_failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const answers = parsed.data;
  const score = calculateScore(answers);
  const pillar = answers.q5_pilarDolor;
  const recommendation = RECOMMENDATIONS[pillar];
  const leadId = randomUUID();

  // Audit log — minimal PII, useful for cold-start debugging.
  console.log("[lead/new]", {
    leadId,
    ts: new Date().toISOString(),
    ip,
    score,
    pillar,
    tier: recommendation.recommendedTier,
    timeline: answers.q8_timeline,
    units: answers.q2_unidades,
    emailDomain: answers.q9_contacto.email.split("@")[1]?.toLowerCase() ?? "",
  });

  // Persistencia del lead — best-effort. Guarda además el resultado del
  // diagnóstico (score, pilar de dolor, tier sugerido), que es contexto de
  // calificación que hoy se perdía al cerrar la pestaña.
  const contacto = answers.q9_contacto;
  await persistLead({
    leadId,
    origen: "diagnostico",
    nombre: contacto.nombre,
    email: contacto.email,
    telefono: contacto.whatsapp,
    empresa: contacto.conjunto,
    unidadesEstimadas: answers.q2_unidades,
    timeline: answers.q8_timeline,
    meta: {
      score,
      pilarDolor: pillar,
      tierSugerido: recommendation.recommendedTier,
      respuestas: answers,
    },
  });

  // Email dispatch — best-effort. Lead capture is NEVER penalised by email
  // failure: we always return ok:true with the report payload.
  if (resend) {
    const meta = { score, leadId };
    const kamEmail = buildKamNotificationEmail(answers, meta);
    const leadEmail = buildLeadConfirmationEmail(answers, meta);

    try {
      const kamResult = await resend.emails.send({
        from: NOTIFY_FROM,
        to: NOTIFY_TO,
        replyTo: answers.q9_contacto.email,
        subject: envSubject(kamEmail.subject),
        html: kamEmail.html,
        text: kamEmail.text,
        tags: [
          { name: "type", value: "lead_kam_notification" },
          { name: "pillar", value: pillar },
        ],
      });
      if (kamResult.error) {
        console.error("[lead/email-kam-failed]", { leadId, error: kamResult.error });
      } else {
        console.log("[lead/email-kam-ok]", { leadId, resendId: kamResult.data?.id });
      }
    } catch (err) {
      console.error("[lead/email-kam-threw]", { leadId, err });
    }

    try {
      const leadResult = await resend.emails.send({
        from: NOTIFY_FROM,
        to: [answers.q9_contacto.email],
        replyTo: NOTIFY_TO,
        subject: envSubject(leadEmail.subject),
        html: leadEmail.html,
        text: leadEmail.text,
        tags: [{ name: "type", value: "lead_confirmation" }],
      });
      if (leadResult.error) {
        console.error("[lead/email-lead-failed]", { leadId, error: leadResult.error });
      } else {
        console.log("[lead/email-lead-ok]", { leadId, resendId: leadResult.data?.id });
      }
    } catch (err) {
      console.error("[lead/email-lead-threw]", { leadId, err });
    }
  } else {
    console.warn(
      "[lead/no-resend]",
      "RESEND_API_KEY not configured — skipping email send",
    );
  }

  return NextResponse.json({
    ok: true,
    leadId,
    score,
    pillar,
    recommendation: {
      title: recommendation.title,
      tier: recommendation.recommendedTier,
    },
  });
}
