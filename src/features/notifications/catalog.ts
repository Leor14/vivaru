// Espejo (front) del catálogo de notificaciones de functions/src/notification-catalog.ts.
// Necesario porque functions/ y src/ no pueden importarse entre sí. Lo consume el
// editor de copys en Perfil del edificio. Las cadenas deben mantenerse en sincronía
// con la copia de functions (fuente de verdad para el envío).

export type NotificationKey =
  | "billing_new"
  | "billing_batch"
  | "billing_overdue"
  | "billing_receipt"
  | "billing_reminder"
  | "payment_adjusted"
  | "payment_rejected"
  | "ticket_answered"
  | "reservation_rejected"
  | "regulation_new"
  | "agreement_signature"
  | "agreement_info"
  | "survey_new";

export type NotificationRelevance = "alta" | "media" | "baja";

export interface NotificationVariable {
  name: string;
  example: string;
  required: boolean;
}

export interface NotificationTemplateDef {
  key: NotificationKey;
  /** Grupo para el editor (módulo). */
  group: string;
  /** Etiqueta legible para el editor. */
  label: string;
  relevance: NotificationRelevance;
  emailDefault: boolean;
  variables: NotificationVariable[];
  title: string;
  body: string;
  emailSubject: string;
  emailBody: string;
}

const CONJUNTO: NotificationVariable = { name: "conjunto", example: "Conjunto Las Palmas", required: false };
const UNIDAD: NotificationVariable = { name: "unidad", example: "Torre 1 - 301", required: false };
const PERIODO: NotificationVariable = { name: "período", example: "junio 2026", required: true };
const MONTO: NotificationVariable = { name: "monto", example: "$250.000", required: true };
// Las dos de CA13 (`PRD-V-FLOW-002` §9). **Opcionales las dos**, y su ejemplo
// lleva la oración completa a propósito: es lo que ve el administrador en este
// editor, y tiene que entender que ahí entra una frase, no un número.
const CARGOS: NotificationVariable = {
  name: "cargos",
  example: "Cubrió la cuota de administración de agosto de 2026 y la multa de junio de 2026.",
  required: false,
};
const SALDO_A_FAVOR: NotificationVariable = {
  name: "saldoAFavor",
  example: "Te quedó un saldo a favor de $60.000.",
  required: false,
};
const ASUNTO: NotificationVariable = { name: "asunto", example: "Fuga en el pasillo", required: false };
const AMENIDAD: NotificationVariable = { name: "amenidad", example: "Salón social", required: false };
const FECHA: NotificationVariable = { name: "fecha", example: "12/06/2026", required: false };

export const NOTIFICATION_CATALOG: NotificationTemplateDef[] = [
  {
    key: "billing_new",
    group: "Cartera",
    label: "Cobro nuevo",
    relevance: "alta",
    emailDefault: false,
    variables: [{ name: "concepto", example: "Administración", required: false }, PERIODO, MONTO, UNIDAD, CONJUNTO],
    title: "Nuevo cobro en tu cartera",
    body: "Se registró un cobro de {concepto} por {monto} ({período}).",
    emailSubject: "Nuevo cobro en tu cartera — {conjunto}",
    emailBody: "Se registró un cobro de {concepto} por {monto} para tu unidad {unidad} ({período}).",
  },
  {
    key: "billing_batch",
    group: "Cartera",
    label: "Cobros del período (lote)",
    relevance: "media",
    emailDefault: false,
    variables: [PERIODO, CONJUNTO],
    title: "Tus cobros del período están listos",
    body: "La administración publicó tus cobros de {período}.",
    emailSubject: "Tus cobros de {período} están listos — {conjunto}",
    emailBody: "La administración publicó tus cobros de {período}. Ingresa para verlos.",
  },
  {
    key: "billing_overdue",
    group: "Cartera",
    label: "Mora",
    relevance: "alta",
    emailDefault: false,
    variables: [UNIDAD, CONJUNTO],
    title: "Tu unidad quedó en mora",
    body: "Tienes cartera vencida. Ponte al día para evitar recargos.",
    emailSubject: "Tienes cartera en mora — {conjunto}",
    emailBody: "Tu unidad {unidad} tiene cartera vencida. Ingresa a tu portal para ponerte al día.",
  },
  {
    key: "billing_receipt",
    group: "Cartera",
    label: "Recibo disponible",
    relevance: "baja",
    emailDefault: false,
    variables: [PERIODO, CARGOS, SALDO_A_FAVOR, CONJUNTO],
    title: "Tu recibo está disponible",
    body: "Se generó el recibo de tu pago de {período}. {cargos} {saldoAFavor}",
    emailSubject: "Tu recibo de {período} está disponible — {conjunto}",
    emailBody: "Se generó el recibo de tu pago de {período}. {cargos} {saldoAFavor} Ingresa para descargarlo.",
  },
  {
    key: "billing_reminder",
    group: "Cartera",
    label: "Recordatorio de pago",
    relevance: "alta",
    emailDefault: false,
    variables: [CONJUNTO],
    title: "Recordatorio de pago",
    body: "Tienes un saldo pendiente en tu cartera. Ingresa para ponerte al día.",
    emailSubject: "Recordatorio de pago — {conjunto}",
    emailBody: "Tienes un saldo pendiente en tu cartera de {conjunto}. Ingresa a tu portal para ponerte al día.",
  },
  {
    key: "payment_adjusted",
    group: "Cartera",
    label: "Comprobante aceptado con ajuste",
    relevance: "alta",
    emailDefault: false,
    variables: [MONTO, CONJUNTO],
    title: "Comprobante aceptado con ajuste",
    body: "Aceptamos tu comprobante, pero ajustamos el monto registrado a {monto}.",
    emailSubject: "Tu comprobante fue aceptado con un ajuste — {conjunto}",
    emailBody: "Aceptamos tu comprobante de pago, pero el monto registrado se ajustó a {monto}. Ingresa para ver tu estado de cuenta.",
  },
  {
    key: "payment_rejected",
    group: "Cartera",
    label: "Comprobante no aceptado",
    relevance: "alta",
    emailDefault: false,
    variables: [{ name: "motivo", example: "El monto no coincide con el comprobante", required: false }, CONJUNTO],
    title: "Comprobante no aceptado",
    body: "Tu comprobante de pago no fue aceptado: {motivo}.",
    emailSubject: "Tu comprobante no fue aceptado — {conjunto}",
    emailBody: "Tu comprobante de pago no fue aceptado. Motivo: {motivo}. Ingresa para revisarlo.",
  },
  {
    key: "ticket_answered",
    group: "PQRS",
    label: "PQRS respondido",
    relevance: "alta",
    emailDefault: false,
    variables: [ASUNTO, CONJUNTO],
    title: "Respondieron tu PQRS",
    body: "La administración respondió tu solicitud “{asunto}”.",
    emailSubject: "Respondieron tu solicitud — {conjunto}",
    emailBody: "La administración respondió tu PQRS “{asunto}”. Ingresa para ver la respuesta.",
  },
  {
    key: "reservation_rejected",
    group: "Reservas",
    label: "Reserva rechazada",
    relevance: "media",
    emailDefault: false,
    variables: [AMENIDAD, CONJUNTO],
    title: "Tu reserva no fue aprobada",
    body: "Tu reserva de {amenidad} no fue aprobada.",
    emailSubject: "Tu reserva no fue aprobada — {conjunto}",
    emailBody: "Tu reserva de {amenidad} no fue aprobada. Ingresa para más detalles.",
  },
  {
    key: "regulation_new",
    group: "Reglamento",
    label: "Reglamento nuevo",
    relevance: "media",
    emailDefault: false,
    variables: [CONJUNTO],
    title: "Nuevo reglamento por firmar",
    body: "La administración publicó un reglamento actualizado. Léelo y fírmalo.",
    emailSubject: "Nuevo reglamento por firmar — {conjunto}",
    emailBody: "La administración publicó un reglamento actualizado. Ingresa para leerlo y firmarlo.",
  },
  {
    key: "agreement_signature",
    group: "Reglamento",
    label: "Acuerdo por firmar",
    relevance: "alta",
    emailDefault: false,
    variables: [FECHA, CONJUNTO],
    title: "Acuerdo de comité por firmar",
    body: "Tienes un acuerdo de comité por firmar (sesión del {fecha}).",
    emailSubject: "Tienes un acuerdo por firmar — {conjunto}",
    emailBody: "Hay un acuerdo de la sesión del {fecha} pendiente de tu firma. Ingresa para firmarlo.",
  },
  {
    key: "agreement_info",
    group: "Reglamento",
    label: "Acuerdo informativo",
    relevance: "baja",
    emailDefault: false,
    variables: [FECHA, CONJUNTO],
    title: "Nuevo acuerdo de comité",
    body: "La administración publicó un acuerdo de comité (sesión del {fecha}).",
    emailSubject: "Nuevo acuerdo de comité — {conjunto}",
    emailBody: "La administración publicó un acuerdo de la sesión del {fecha}. Ingresa para leerlo.",
  },
  {
    key: "survey_new",
    group: "Encuestas",
    label: "Encuesta nueva",
    relevance: "media",
    emailDefault: false,
    variables: [CONJUNTO],
    title: "Nueva encuesta disponible",
    body: "La administración publicó una encuesta. Tu opinión cuenta.",
    emailSubject: "Nueva encuesta disponible — {conjunto}",
    emailBody: "La administración publicó una encuesta. Ingresa para responderla.",
  },
];

// Límites de longitud (evitan romper envíos: asunto de email, display de la campana).
export const FIELD_LIMITS = { title: 80, body: 280, emailSubject: 78, emailBody: 500 } as const;

/** Extrae los tokens {x} de un texto. */
export function extractTokens(text: string): string[] {
  const out: string[] = [];
  const re = /\{([^{}]+)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) out.push(m[1]);
  return out;
}

/**
 * Valida un campo editable: longitud, sin HTML y solo variables permitidas de esa
 * notificación. Devuelve mensaje de error o null si es válido.
 */
export function validateField(def: NotificationTemplateDef, text: string, maxLen: number): string | null {
  if (text.length > maxLen) return `Máximo ${maxLen} caracteres.`;
  if (/[<>]/.test(text)) return "No uses los símbolos < o >.";
  const allowed = def.variables.map((v) => v.name);
  for (const token of extractTokens(text)) {
    if (!allowed.includes(token)) return `Variable no permitida: {${token}}.`;
  }
  return null;
}

/** Reemplaza {token} por su ejemplo, para la vista previa. */
export function interpolatePreview(def: NotificationTemplateDef, text: string): string {
  const examples: Record<string, string> = {};
  for (const v of def.variables) examples[v.name] = v.example;
  return text
    .replace(/\{([^{}]+)\}/g, (_m, name: string) =>
      Object.prototype.hasOwnProperty.call(examples, name) ? examples[name] : "",
    )
    .replace(/ {2,}/g, " ")
    .trim();
}
