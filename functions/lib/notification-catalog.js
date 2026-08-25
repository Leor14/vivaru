"use strict";
// Catálogo de notificaciones al residente: copy por default, variables
// permitidas y resolución con overrides por tenant. Compartido por los triggers
// (in-app y email). El front mantiene un espejo de este catálogo para el editor
// de copys en Perfil del edificio (las cadenas deben mantenerse en sincronía).
//
// IMPORTANTE: functions/ no puede importar de src/ (ni al revés). Por eso el
// catálogo vive duplicado: aquí (fuente de verdad para el envío) y en
// src/features/notifications/catalog.ts (para el editor).
Object.defineProperty(exports, "__esModule", { value: true });
exports.NOTIFICATION_CATALOG = void 0;
exports.allowedVariableNames = allowedVariableNames;
exports.resolveNotificationCopy = resolveNotificationCopy;
// Variables reutilizadas.
const CONJUNTO = { name: "conjunto", example: "Conjunto Las Palmas", required: false };
const UNIDAD = { name: "unidad", example: "Torre 1 - 301", required: false };
const PERIODO = { name: "período", example: "junio 2026", required: true };
const MONTO = { name: "monto", example: "$250.000", required: true };
// Las dos de CA13. **Opcionales las dos**, y su ejemplo lleva la oración
// completa a propósito: es lo que ve el administrador en el editor de copys, y
// tiene que entender que ahí entra una frase, no un número.
const CARGOS = {
    name: "cargos",
    example: "Cubrió la cuota de administración de agosto de 2026 y la multa de junio de 2026.",
    required: false,
};
const SALDO_A_FAVOR = {
    name: "saldoAFavor",
    example: "Te quedó un saldo a favor de $60.000.",
    required: false,
};
exports.NOTIFICATION_CATALOG = {
    billing_new: {
        type: "billing",
        link: "/resident/account",
        relevance: "alta",
        emailDefault: false,
        variables: [{ name: "concepto", example: "Administración", required: false }, PERIODO, MONTO, UNIDAD, CONJUNTO],
        title: "Nuevo cobro en tu cartera",
        body: "Se registró un cobro de {concepto} por {monto} ({período}).",
        emailSubject: "Nuevo cobro en tu cartera — {conjunto}",
        emailBody: "Se registró un cobro de {concepto} por {monto} para tu unidad {unidad} ({período}).",
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
    // **§9 y CA13 de `PRD-V-FLOW-002`.** El aviso decía que el recibo existe y
    // nada más. Ahora nombra los cargos cubiertos y el saldo a favor, que es la
    // llamada al administrador más barata de evitar: quien paga de más y no
    // recibe confirmación del sobrante, llama.
    //
    // **`cargos` y `saldoAFavor` llevan la ORACIÓN entera, no el dato.** Ver
    // `aviso-recibo.ts`: `interpolate` borra el token vacío pero no el conectivo
    // que lo rodea, así que un «…de {saldoAFavor}» dejaría «…de.» en la mayoría de
    // los pagos, que no dejan sobrante.
    billing_receipt: {
        type: "billing",
        link: "/resident/account",
        relevance: "baja",
        emailDefault: false,
        variables: [PERIODO, CARGOS, SALDO_A_FAVOR, CONJUNTO],
        title: "Tu recibo está disponible",
        body: "Se generó el recibo de tu pago de {período}. {cargos} {saldoAFavor}",
        emailSubject: "Tu recibo de {período} está disponible — {conjunto}",
        emailBody: "Se generó el recibo de tu pago de {período}. {cargos} {saldoAFavor} Ingresa para descargarlo.",
    },
    billing_reminder: {
        type: "billing",
        link: "/resident/account",
        relevance: "alta",
        emailDefault: false,
        variables: [CONJUNTO],
        title: "Recordatorio de pago",
        body: "Tienes un saldo pendiente en tu cartera. Ingresa para ponerte al día.",
        emailSubject: "Recordatorio de pago — {conjunto}",
        emailBody: "Tienes un saldo pendiente en tu cartera de {conjunto}. Ingresa a tu portal para ponerte al día.",
    },
    payment_adjusted: {
        type: "billing",
        link: "/resident/account",
        relevance: "alta",
        emailDefault: false,
        variables: [MONTO, CONJUNTO],
        title: "Comprobante aceptado con ajuste",
        body: "Aceptamos tu comprobante, pero ajustamos el monto registrado a {monto}.",
        emailSubject: "Tu comprobante fue aceptado con un ajuste — {conjunto}",
        emailBody: "Aceptamos tu comprobante de pago, pero el monto registrado se ajustó a {monto}. Ingresa para ver tu estado de cuenta.",
    },
    payment_rejected: {
        type: "billing",
        link: "/resident/account",
        relevance: "alta",
        emailDefault: false,
        variables: [{ name: "motivo", example: "El monto no coincide con el comprobante", required: false }, CONJUNTO],
        title: "Comprobante no aceptado",
        body: "Tu comprobante de pago no fue aceptado: {motivo}.",
        emailSubject: "Tu comprobante no fue aceptado — {conjunto}",
        emailBody: "Tu comprobante de pago no fue aceptado. Motivo: {motivo}. Ingresa para revisarlo.",
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
function allowedVariableNames(key) {
    return exports.NOTIFICATION_CATALOG[key].variables.map((v) => v.name);
}
/**
 * Reemplaza {token} por su valor. Los tokens sin valor se quitan para no filtrar
 * "{x}" al residente; se colapsan los espacios dobles resultantes (preserva saltos
 * de línea por si un cuerpo de email los usa).
 */
function interpolate(text, vars) {
    return text
        .replace(/\{([^{}]+)\}/g, (_match, name) => Object.prototype.hasOwnProperty.call(vars, name) ? vars[name] : "")
        .replace(/ {2,}/g, " ")
        .trim();
}
function pick(override, fallback) {
    const value = (override ?? "").trim();
    return value.length > 0 ? value : fallback;
}
/**
 * Resuelve el copy de una notificación: usa el override del tenant si existe y no
 * está vacío; si no, el default del catálogo. Interpola variables. No lanza (ante
 * cualquier ausencia cae al default) para nunca bloquear el envío.
 */
function resolveNotificationCopy(key, override, vars) {
    const t = exports.NOTIFICATION_CATALOG[key];
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
