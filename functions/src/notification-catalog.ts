// Catálogo de notificaciones al residente: copy por default, variables
// permitidas y resolución con overrides por tenant. Compartido por los triggers
// (in-app y email). El front mantiene un espejo de este catálogo para el editor
// de copys en Perfil del edificio (las cadenas deben mantenerse en sincronía).
//
// IMPORTANTE: functions/ no puede importar de src/ (ni al revés). Por eso el
// catálogo vive duplicado: aquí (fuente de verdad para el envío) y en
// src/features/notifications/catalog.ts (para el editor).

export type NotificationType =
  | "package"
  | "communication"
  | "reservation"
  | "visitor"
  | "ticket"
  | "system"
  | "billing"
  | "regulation"
  | "survey";

export type NotificationKey =
  | "billing_new"
  | "billing_batch"
  | "billing_overdue"
  | "billing_receipt"
  | "ticket_answered"
  | "reservation_rejected"
  | "regulation_new"
  | "agreement_signature"
  | "agreement_info"
  | "survey_new";

export interface NotificationVariable {
  /** nombre del token sin llaves; en el texto se escribe {nombre}. */
  name: string;
  example: string;
  required: boolean;
}

export interface NotificationTemplate {
  type: NotificationType;
  link: string;
  relevance: "alta" | "media" | "baja";
  /** Email apagado por default en TODAS; el admin lo activa por tenant. */
  emailDefault: boolean;
  variables: NotificationVariable[];
  title: string;
  body: string;
  emailSubject: string;
  emailBody: string;
}

/** Override editable por tenant (mismo shape que guarda el front). */
export interface NotificationOverride {
  title?: string;
  body?: string;
  emailSubject?: string;
  emailBody?: string;
  emailEnabled?: boolean;
}

// Variables reutilizadas.
const CONJUNTO: NotificationVariable = { name: "conjunto", example: "Conjunto Las Palmas", required: false };
const UNIDAD: NotificationVariable = { name: "unidad", example: "Torre 1 - 301", required: false };
const PERIODO: NotificationVariable = { name: "período", example: "junio 2026", required: true };
const MONTO: NotificationVariable = { name: "monto", example: "$250.000", required: true };

export const NOTIFICATION_CATALOG: Record<NotificationKey, NotificationTemplate> = {
  billing_new: {
    type: "billing",
    link: "/resident/account",
    relevance: "alta",
    emailDefault: false,
    variables: [PERIODO, MONTO, UNIDAD, CONJUNTO],
    title: "Nuevo cobro en tu cartera",
    body: "Se registró un cobro de {período} por {monto}.",
    emailSubject: "Nuevo cobro en tu cartera — {conjunto}",
    emailBody: "Se registró un cobro de {período} por {monto} para tu unidad {unidad}.",
  },
  billing_batch: {
    type: "billing",
    link: "/resident/account",
    relevance: "media",
    emailDefault: false,
    variables: [PERIODO, CONJUNTO],
    title: "Tus cobros del período están listos",
    body: "La administración publicó tus cobros de {período}.",
    emailSubject: "Tus cobros de {período} están listos — {conjunto}",
    emailBody: "La administración publicó tus cobros de {período}. Ingresa para verlos.",
  },
  billing_overdue: {
    type: "billing",
    link: "/resident/account",
    relevance: "alta",
    emailDefault: false,
    variables: [UNIDAD, CONJUNTO],
    title: "Tu unidad quedó en mora",
    body: "Tienes cartera vencida. Ponte al día para evitar recargos.",
    emailSubject: "Tienes cartera en mora — {conjunto}",
    emailBody: "Tu unidad {unidad} tiene cartera vencida. Ingresa a tu portal para ponerte al día.",
  },
  billing_receipt: {
    type: "billing",
    link: "/resident/account",
    relevance: "baja",
    emailDefault: false,
    variables: [PERIODO, CONJUNTO],
    title: "Tu recibo está disponible",
    body: "Se generó el recibo de tu pago de {período}.",
    emailSubject: "Tu recibo de {período} está disponible — {conjunto}",
    emailBody: "Se generó el recibo de tu pago de {período}. Ingresa para descargarlo.",
  },
  ticket_answered: {
    type: "ticket",
    link: "/resident/pqrs",
    relevance: "alta",
    emailDefault: false,
    variables: [{ name: "asunto", example: "Fuga en el pasillo", required: false }, CONJUNTO],
    title: "Respondieron tu PQRS",
    body: "La administración respondió tu solicitud “{asunto}”.",
    emailSubject: "Respondieron tu solicitud — {conjunto}",
    emailBody: "La administración respondió tu PQRS “{asunto}”. Ingresa para ver la respuesta.",
  },
  reservation_rejected: {
    type: "reservation",
    link: "/resident/reservations",
    relevance: "media",
    emailDefault: false,
    variables: [{ name: "amenidad", example: "Salón social", required: false }, CONJUNTO],
    title: "Tu reserva no fue aprobada",
    body: "Tu reserva de {amenidad} no fue aprobada.",
    emailSubject: "Tu reserva no fue aprobada — {conjunto}",
    emailBody: "Tu reserva de {amenidad} no fue aprobada. Ingresa para más detalles.",
  },
  regulation_new: {
    type: "regulation",
    link: "/resident/regulations",
    relevance: "media",
    emailDefault: false,
    variables: [CONJUNTO],
    title: "Nuevo reglamento por firmar",
    body: "La administración publicó un reglamento actualizado. Léelo y fírmalo.",
    emailSubject: "Nuevo reglamento por firmar — {conjunto}",
    emailBody: "La administración publicó un reglamento actualizado. Ingresa para leerlo y firmarlo.",
  },
  agreement_signature: {
    type: "regulation",
    link: "/resident/agreements",
    relevance: "alta",
    emailDefault: false,
    variables: [{ name: "fecha", example: "12/06/2026", required: false }, CONJUNTO],
    title: "Acuerdo de comité por firmar",
    body: "Tienes un acuerdo de comité por firmar (sesión del {fecha}).",
    emailSubject: "Tienes un acuerdo por firmar — {conjunto}",
    emailBody: "Hay un acuerdo de la sesión del {fecha} pendiente de tu firma. Ingresa para firmarlo.",
  },
  agreement_info: {
    type: "regulation",
    link: "/resident/agreements",
    relevance: "baja",
    emailDefault: false,
    variables: [{ name: "fecha", example: "12/06/2026", required: false }, CONJUNTO],
    title: "Nuevo acuerdo de comité",
    body: "La administración publicó un acuerdo de comité (sesión del {fecha}).",
    emailSubject: "Nuevo acuerdo de comité — {conjunto}",
    emailBody: "La administración publicó un acuerdo de la sesión del {fecha}. Ingresa para leerlo.",
  },
  survey_new: {
    type: "survey",
    link: "/resident/surveys",
    relevance: "media",
    emailDefault: false,
    variables: [CONJUNTO],
    title: "Nueva encuesta disponible",
    body: "La administración publicó una encuesta. Tu opinión cuenta.",
    emailSubject: "Nueva encuesta disponible — {conjunto}",
    emailBody: "La administración publicó una encuesta. Ingresa para responderla.",
  },
};

/** Tokens permitidos (sin llaves) de una notificación. Útil para validar overrides. */
export function allowedVariableNames(key: NotificationKey): string[] {
  return NOTIFICATION_CATALOG[key].variables.map((v) => v.name);
}

/**
 * Reemplaza {token} por su valor. Los tokens sin valor se quitan para no filtrar
 * "{x}" al residente; se colapsan los espacios dobles resultantes (preserva saltos
 * de línea por si un cuerpo de email los usa).
 */
function interpolate(text: string, vars: Record<string, string>): string {
  return text
    .replace(/\{([^{}]+)\}/g, (_match, name: string) =>
      Object.prototype.hasOwnProperty.call(vars, name) ? vars[name] : "",
    )
    .replace(/ {2,}/g, " ")
    .trim();
}

function pick(override: string | undefined, fallback: string): string {
  const value = (override ?? "").trim();
  return value.length > 0 ? value : fallback;
}

export interface ResolvedNotification {
  type: NotificationType;
  link: string;
  title: string;
  body: string;
  emailEnabled: boolean;
  emailSubject: string;
  emailBody: string;
}

/**
 * Resuelve el copy de una notificación: usa el override del tenant si existe y no
 * está vacío; si no, el default del catálogo. Interpola variables. No lanza (ante
 * cualquier ausencia cae al default) para nunca bloquear el envío.
 */
export function resolveNotificationCopy(
  key: NotificationKey,
  override: NotificationOverride | undefined,
  vars: Record<string, string>,
): ResolvedNotification {
  const t = NOTIFICATION_CATALOG[key];
  return {
    type: t.type,
    link: t.link,
    title: interpolate(pick(override?.title, t.title), vars),
    body: interpolate(pick(override?.body, t.body), vars),
    emailEnabled: override?.emailEnabled ?? t.emailDefault,
    emailSubject: interpolate(pick(override?.emailSubject, t.emailSubject), vars),
    emailBody: interpolate(pick(override?.emailBody, t.emailBody), vars),
  };
}
