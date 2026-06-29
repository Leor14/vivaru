/**
 * seed-data-playas.mjs
 *
 * Datos demo para el conjunto DEMO "Conjunto Las Playas" (México, MXN).
 * Pensado para presentar una demo viva: ~3 meses + el mes actual de actividad.
 * Solo exporta constantes; no ejecuta nada. Lo consume seed-tenant.mjs (--tenant=playas).
 *
 * Diseño:
 *  - Montos en MXN.
 *  - Periodos de cartera calculados RELATIVOS a "hoy" (siempre fresco al re-sembrar).
 *  - Correos demo -> david.macar.18@hotmail.com (alias +res1/+res2/+res3/+porteria).
 *  - Estados finales sembrados en el create (evita disparar triggers de UPDATE que envían correo).
 *  - moduleVariants COMPLETAS (luce todas las funciones).
 */

const DEMO_EMAIL = "david.macar.18@hotmail.com";
const alias = (tag) => `david.macar.18+${tag}@hotmail.com`;
const CUOTA = 3000; // cuota de mantenimiento mensual (MXN)

// ── Helpers de fecha (relativos a hoy) ──────────────────────────────────────────
function ymOffset(monthsAgo) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - monthsAgo);
  return { y: d.getFullYear(), m: d.getMonth() + 1 };
}
function periodStr(monthsAgo) {
  const { y, m } = ymOffset(monthsAgo);
  return `${y}-${String(m).padStart(2, "0")}`;
}
function dueStr(monthsAgo, day) {
  const { y, m } = ymOffset(monthsAgo);
  const lastDay = new Date(y, m, 0).getDate();
  const d = day === "last" ? lastDay : Math.min(day, lastDay);
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

// ── Tenant ──────────────────────────────────────────────────────────────────────
export const TENANT_PLAYAS = {
  id: "conjunto-las-playas",
  name: "Conjunto Las Playas",
  city: "Cancún, Quintana Roo",
  country: "MX",
  planId: "plus",
  status: "active",
  onboardingStatus: "completed",
  branding: { primaryColor: "#0B3C5D", accentColor: "#1A7A45" },
};

// Variantes COMPLETAS para lucir todas las funciones.
export const MODULE_VARIANTS_PLAYAS = {
  visitors: "qr_full",
  packages: "con_evidencia",
  pqrs: "con_sla",
  communications: "canal_oficial",
  finance: "completa",
  governance: "formal",
};
export const RESIDENT_MODULES_PLAYAS = {
  reservations: true,
  services: true,
  surveys: true,
  regulations: true,
};

// ── Unidades: 2 torres × 6 = 12 ────────────────────────────────────────────────
function buildUnits() {
  const units = [];
  for (const [tower, prefix, base] of [
    ["Torre 1", "t1", 100],
    ["Torre 2", "t2", 200],
  ]) {
    for (let i = 1; i <= 6; i++) {
      const num = base + i;
      const slug = `${prefix}-${num}`;
      units.push({ id: slug, unitId: slug, displayName: `${prefix.toUpperCase()}-${num}`, tower });
    }
  }
  return units;
}
export const UNITS_PLAYAS = buildUnits();

// ── Personas (1 por unidad) ─────────────────────────────────────────────────────
const PERSON_DEFS = [
  ["t1-101", "María Fernanda Castillo", "owner_occupant", alias("res1")],
  ["t1-102", "Jorge Luis Herrera", "tenant", alias("res2")],
  ["t1-103", "Ricardo Salgado Peña", "owner_occupant", null],
  ["t1-104", "Gabriela Núñez Soto", "tenant", null],
  ["t1-105", "Andrés Villalobos Mena", "owner_occupant", null],
  ["t1-106", "Lucía Paredes Gómez", "owner_occupant", null],
  ["t2-201", "Ana Sofía Romero", "owner_occupant", alias("res3")],
  ["t2-202", "Felipe Cárdenas Ruiz", "tenant", null],
  ["t2-203", "Daniela Ortiz Lema", "owner_occupant", null],
  ["t2-204", "Hugo Martínez Bravo", "owner_occupant", null],
  ["t2-205", "Valentina Cruz Díaz", "tenant", null],
  ["t2-206", "Sebastián Aguilar Rojas", "owner_occupant", null],
];
const unitTower = Object.fromEntries(UNITS_PLAYAS.map((u) => [u.id, u.tower]));
const personName = Object.fromEntries(PERSON_DEFS.map(([slug, name]) => [slug, name]));

export const PEOPLE_PLAYAS = PERSON_DEFS.map(([slug, name, roleType], i) => ({
  id: `person-playas-${slug}`,
  fullName: name,
  email: PERSON_DEFS[i][3] ?? `${slug}@demo.grupovivaru.com`,
  phone: `998${String(1000000 + i * 13).slice(-7)}`,
  documentNumber: `LP${String(100000 + i * 7)}`,
  roleType,
  occupancyType: roleType,
  unitId: slug,
  tower: unitTower[slug],
}));

// ── Usuarios con login ──────────────────────────────────────────────────────────
export const USERS_PLAYAS = [
  { email: DEMO_EMAIL, password: "Demo1234*", displayName: "Carolina Méndez (Admin)", role: "tenant_admin", tenantId: TENANT_PLAYAS.id },
  { email: alias("porteria"), password: "Demo1234*", displayName: "Pedro Guzmán (Portería)", role: "security_guard", tenantId: TENANT_PLAYAS.id },
  { email: alias("res1"), password: "Demo1234*", displayName: "María Fernanda Castillo", role: "resident", tenantId: TENANT_PLAYAS.id, unitId: "t1-101", unitLabel: "T1-101" },
  { email: alias("res2"), password: "Demo1234*", displayName: "Jorge Luis Herrera", role: "resident", tenantId: TENANT_PLAYAS.id, unitId: "t1-102", unitLabel: "T1-102" },
  { email: alias("res3"), password: "Demo1234*", displayName: "Ana Sofía Romero", role: "resident", tenantId: TENANT_PLAYAS.id, unitId: "t2-201", unitLabel: "T2-201" },
];

// ── Amenidades ──────────────────────────────────────────────────────────────────
export const AMENITIES_PLAYAS = [
  { id: "amenity-playas-alberca", name: "Alberca", category: "wellness", status: "active" },
  { id: "amenity-playas-gym", name: "Gimnasio", category: "wellness", status: "active" },
  { id: "amenity-playas-salon", name: "Salón de Usos Múltiples", category: "business", status: "active" },
  { id: "amenity-playas-asador", name: "Área de Asadores", category: "social", status: "active" },
  { id: "amenity-playas-coworking", name: "Coworking", category: "business", status: "active" },
];

// ── Cartera: 12 unidades × 4 meses (M-3..M0), MXN, con morosos reales ───────────
const MOROSOS = new Set(["t1-103", "t2-204"]);          // deben mes anterior (vencido) + actual (pendiente)
const PENDIENTE_ACTUAL = new Set(["t1-104", "t2-205"]); // solo deben el mes actual (pendiente)

function buildBilling() {
  const out = [];
  for (const u of UNITS_PLAYAS) {
    for (const monthsAgo of [3, 2, 1, 0]) {
      const period = periodStr(monthsAgo);
      const upper = u.displayName;
      let status = "paid";
      let balance = 0;
      let dueDate = dueStr(monthsAgo, 15);

      if (monthsAgo === 1 && MOROSOS.has(u.id)) {
        status = "overdue"; balance = CUOTA;                       // mes anterior sin pagar -> vencido
      } else if (monthsAgo === 0) {
        dueDate = dueStr(0, "last");                                // mes actual vence a fin de mes
        if (MOROSOS.has(u.id) || PENDIENTE_ACTUAL.has(u.id)) {
          status = "pending"; balance = CUOTA;                      // pendiente (aún no vence)
        }
      }

      out.push({
        id: `bill-playas-${u.id}-${period}`,
        unitId: u.id, unitLabel: upper, period, amount: CUOTA, balance, status, dueDate,
        concept: "administracion", source: "import",               // source:"import" evita el correo del trigger
      });
    }
  }
  return out;
}
export const BILLING_PLAYAS = buildBilling();

// Un comprobante subido por un residente (pendiente de revisión del admin).
export const PAYMENT_RECEIPTS_PLAYAS = [
  {
    id: "receipt-playas-001",
    unitId: "t1-102", unitLabel: "T1-102",
    statementId: `bill-playas-t1-102-${periodStr(0)}`,
    uploadedByName: "Jorge Luis Herrera",
    amount: CUOTA,
    status: "pending",
    fileName: "comprobante-transferencia.jpg",
    uploadedOffsetDays: -1,
  },
];

// ── PQRS (semáforo SLA 15 días hábiles ≈ 21 días naturales) ─────────────────────
export const PQRS_PLAYAS = [
  {
    id: "pqrs-playas-001", unitId: "t1-103", unitLabel: "T1-103",
    category: "maintenance", type: "complaint",
    subject: "Fuga de agua en pasillo de Torre 1, piso 3",
    message: "Hay una fuga constante en el pasillo del piso 3 de la Torre 1. El agua se acumula y representa un riesgo de resbalón. Solicito revisión urgente.",
    status: "open", priority: "high",
    radicationOffsetDays: -28,            // SLA ya vencido -> semáforo rojo
    residentName: personName["t1-103"],
  },
  {
    id: "pqrs-playas-002", unitId: "t2-201", unitLabel: "T2-201",
    category: "pqrs", type: "petition",
    subject: "Solicitud de instalación de bicicletero en área común",
    message: "Solicito a la administración evaluar la instalación de un bicicletero techado cerca de la entrada de la Torre 2. Cada vez somos más residentes que usamos bici.",
    status: "open", priority: "medium",
    radicationOffsetDays: -19,            // por vencer pronto -> semáforo amarillo
    residentName: personName["t2-201"],
  },
  {
    id: "pqrs-playas-003", unitId: "t1-101", unitLabel: "T1-101",
    category: "pqrs", type: "complaint",
    subject: "Ruido excesivo en alberca después del horario permitido",
    message: "Durante el último fin de semana hubo reuniones en la alberca después de las 10 p.m., con música alta. Solicito reforzar la vigilancia del horario.",
    status: "in_progress", priority: "medium",
    radicationOffsetDays: -8,
    residentName: personName["t1-101"],
  },
  {
    id: "pqrs-playas-004", unitId: "t2-203", unitLabel: "T2-203",
    category: "pqrs", type: "suggestion",
    subject: "Sugerencia: separar contenedores de reciclaje",
    message: "Propongo colocar contenedores separados para reciclaje (PET, papel, vidrio) en el área de basura. Ayudaría a mejorar el manejo de residuos del conjunto.",
    status: "resolved", priority: "low",
    radicationOffsetDays: -25,
    residentName: personName["t2-203"],
    response: "Gracias por la sugerencia. Se aprobó la compra de tres contenedores separados; se instalarán este mes en el área de basura de ambas torres.",
    respondedAt: -22,
  },
  {
    id: "pqrs-playas-005", unitId: "t1-102", unitLabel: "T1-102",
    category: "billing", type: "claim",
    subject: "Pago de mantenimiento no reflejado",
    message: "Realicé el pago de mi cuota por transferencia hace dos días y aún aparece como pendiente. Adjunto el comprobante para su validación.",
    status: "in_progress", priority: "medium",
    radicationOffsetDays: -2,
    residentName: personName["t1-102"],
  },
  {
    id: "pqrs-playas-006", unitId: "t2-206", unitLabel: "T2-206",
    category: "maintenance", type: "petition",
    subject: "Lámpara fundida en estacionamiento nivel 1",
    message: "La lámpara del cajón 14 del estacionamiento nivel 1 está fundida desde hace una semana, dejando la zona muy oscura por las noches.",
    status: "resolved", priority: "low",
    radicationOffsetDays: -14,
    residentName: personName["t2-206"],
    response: "Se reemplazó la luminaria del cajón 14. La zona ya cuenta con iluminación normal. Gracias por el reporte.",
    respondedAt: -11,
  },
];

// ── Visitantes (panel de portería con actividad de hoy/esta semana) ─────────────
export const VISITORS_PLAYAS = [
  { id: "visit-playas-001", unitId: "t1-101", unitLabel: "T1-101", tower: "Torre 1", unit: "101", visitorName: "Laura Castillo", documentNumber: "CALA920311", qrCodeValue: "QR-PLAYAS-001", hostResidentName: personName["t1-101"], visitorCategory: "familiar", status: "completed", offsetDays: -3 },
  { id: "visit-playas-002", unitId: "t1-102", unitLabel: "T1-102", tower: "Torre 1", unit: "102", visitorName: "DiDi Food", documentNumber: "DIDI000010", qrCodeValue: "QR-PLAYAS-002", hostResidentName: personName["t1-102"], visitorCategory: "servicio", status: "completed", offsetDays: -1 },
  { id: "visit-playas-003", unitId: "t2-201", unitLabel: "T2-201", tower: "Torre 2", unit: "201", visitorName: "Técnico de Internet", documentNumber: "TELMEX0001", qrCodeValue: "QR-PLAYAS-003", hostResidentName: personName["t2-201"], visitorCategory: "servicio", status: "inside", offsetDays: 0 },
  { id: "visit-playas-004", unitId: "t1-105", unitLabel: "T1-105", tower: "Torre 1", unit: "105", visitorName: "Mariana Villalobos", documentNumber: "VIMA880706", qrCodeValue: "QR-PLAYAS-004", hostResidentName: personName["t1-105"], visitorCategory: "familiar", status: "inside", offsetDays: 0 },
  { id: "visit-playas-005", unitId: "t2-203", unitLabel: "T2-203", tower: "Torre 2", unit: "203", visitorName: "Visita Programada", documentNumber: "1100220033", qrCodeValue: "QR-PLAYAS-005", hostResidentName: personName["t2-203"], visitorCategory: "familiar", status: "scheduled", offsetDays: 0 },
  { id: "visit-playas-006", unitId: "t2-206", unitLabel: "T2-206", tower: "Torre 2", unit: "206", visitorName: "Mudanza – Transportes del Caribe", documentNumber: "MUDA000099", qrCodeValue: "QR-PLAYAS-006", hostResidentName: personName["t2-206"], visitorCategory: "servicio", status: "scheduled", offsetDays: 2 },
  { id: "visit-playas-007", unitId: "t1-103", unitLabel: "T1-103", tower: "Torre 1", unit: "103", visitorName: "Plomería Express", documentNumber: "PLOM000045", qrCodeValue: "QR-PLAYAS-007", hostResidentName: personName["t1-103"], visitorCategory: "servicio", status: "completed", offsetDays: -5 },
];

// ── Paquetería (pendientes de esta semana + entregados) ─────────────────────────
export const PACKAGES_PLAYAS = [
  { id: "pkg-playas-001", unitId: "t1-101", unitLabel: "T1-101", recipientName: personName["t1-101"], reference: "PKG-PLAYAS-001", description: "Paquete Amazon", status: "pending", arrivedOffsetDays: 0 },
  { id: "pkg-playas-002", unitId: "t2-201", unitLabel: "T2-201", recipientName: personName["t2-201"], reference: "PKG-PLAYAS-002", description: "Mercado Libre – sobre", status: "pending", arrivedOffsetDays: -1 },
  { id: "pkg-playas-003", unitId: "t1-104", unitLabel: "T1-104", recipientName: personName["t1-104"], reference: "PKG-PLAYAS-003", description: "Farmacia del Ahorro", status: "pending", arrivedOffsetDays: 0 },
  { id: "pkg-playas-004", unitId: "t1-102", unitLabel: "T1-102", recipientName: personName["t1-102"], reference: "PKG-PLAYAS-004", description: "Pedido Liverpool", status: "delivered", arrivedOffsetDays: -3, deliveredOffsetDays: -2, deliveredToName: personName["t1-102"] },
  { id: "pkg-playas-005", unitId: "t2-205", unitLabel: "T2-205", recipientName: personName["t2-205"], reference: "PKG-PLAYAS-005", description: "Caja Costco", status: "delivered", arrivedOffsetDays: -6, deliveredOffsetDays: -5, deliveredToName: personName["t2-205"] },
  { id: "pkg-playas-006", unitId: "t2-202", unitLabel: "T2-202", recipientName: personName["t2-202"], reference: "PKG-PLAYAS-006", description: "Documentos – DHL", status: "delivered", arrivedOffsetDays: -10, deliveredOffsetDays: -9, deliveredToName: personName["t2-202"] },
];

// ── Comunicaciones ──────────────────────────────────────────────────────────────
export const COMMUNICATIONS_PLAYAS = [
  { id: "comm-playas-001", title: "Mantenimiento de la alberca – esta semana", message: "Informamos que la alberca permanecerá cerrada el miércoles de 8:00 a.m. a 2:00 p.m. por mantenimiento y limpieza profunda. Agradecemos su comprensión.", status: "published", startsOffsetDays: -1, endsOffsetDays: 6, createdBy: DEMO_EMAIL },
  { id: "comm-playas-002", title: "Convocatoria a Asamblea Ordinaria", message: "Se convoca a todos los condóminos de Conjunto Las Playas a la Asamblea Ordinaria. Fecha: próximo sábado, 10:00 a.m. en el Salón de Usos Múltiples. Temas: presupuesto anual y fondo de reserva.", status: "published", startsOffsetDays: -4, endsOffsetDays: 20, createdBy: DEMO_EMAIL },
  { id: "comm-playas-003", title: "Recordatorio: cuota de mantenimiento", message: "Recordamos a los residentes que la cuota de mantenimiento del mes vence el último día del mes. Puedes consultar tu estado de cuenta y subir tu comprobante desde el portal del residente.", status: "published", startsOffsetDays: -10, endsOffsetDays: 5, createdBy: DEMO_EMAIL },
  { id: "comm-playas-004", title: "Nuevas reglas de uso del gimnasio", message: "A partir de este mes, el gimnasio opera de 5:00 a.m. a 11:00 p.m. Es obligatorio el uso de toalla y limpiar el equipo después de usarlo. Aforo máximo: 8 personas.", status: "published", startsOffsetDays: -25, endsOffsetDays: 35, createdBy: DEMO_EMAIL },
];

// ── Reservas (pasadas y próximas) ───────────────────────────────────────────────
export const RESERVATIONS_PLAYAS = [
  { id: "res-playas-001", amenityName: "Salón de Usos Múltiples", unitId: "t1-101", unitLabel: "T1-101", reservedBy: personName["t1-101"], dateOffsetDays: 4, startTime: "18:00", endTime: "23:00", status: "approved", paymentConfirmed: true },
  { id: "res-playas-002", amenityName: "Área de Asadores", unitId: "t2-201", unitLabel: "T2-201", reservedBy: personName["t2-201"], dateOffsetDays: 2, startTime: "13:00", endTime: "17:00", status: "pending", paymentConfirmed: false },
  { id: "res-playas-003", amenityName: "Coworking", unitId: "t1-102", unitLabel: "T1-102", reservedBy: personName["t1-102"], dateOffsetDays: -6, startTime: "09:00", endTime: "12:00", status: "approved", paymentConfirmed: true },
];

// ── Encuestas ───────────────────────────────────────────────────────────────────
export const SURVEYS_PLAYAS = [
  {
    id: "survey-playas-001",
    title: "Satisfacción con la administración (trimestre)",
    description: "Queremos conocer tu opinión sobre la gestión del conjunto durante el último trimestre.",
    status: "published",
    minResponsesForResults: 3,
    createdBy: DEMO_EMAIL,
    createdOffsetDays: -5,
    questions: [
      { id: "q1", type: "likert", text: "¿Qué tan satisfecho estás con la comunicación de la administración?", required: true },
      { id: "q2", type: "single_choice", text: "¿Cuál área común usas con más frecuencia?", options: ["Alberca", "Gimnasio", "Salón", "Asadores", "Coworking"], required: true },
      { id: "q3", type: "text", text: "¿Qué mejorarías del conjunto?", required: false },
    ],
  },
  {
    id: "survey-playas-002",
    title: "Horario de la alberca para temporada de calor",
    description: "Vota por el horario que prefieres para la alberca en los próximos meses.",
    status: "closed",
    minResponsesForResults: 3,
    responseCount: 4,
    createdBy: DEMO_EMAIL,
    createdOffsetDays: -30,
    closingOffsetDays: -3,
    questions: [
      { id: "q1", type: "single_choice", text: "¿Qué horario prefieres para la alberca?", options: ["7:00–21:00", "8:00–22:00", "6:00–20:00"], required: true },
    ],
  },
];

export const SURVEY_RESPONSES_PLAYAS = [
  { id: "sresp-playas-001", surveyId: "survey-playas-002", respondentUid: null, respondentName: "María Fernanda Castillo", unitId: "t1-101", answers: [{ questionId: "q1", value: "8:00–22:00" }], respondedOffsetDays: -20 },
  { id: "sresp-playas-002", surveyId: "survey-playas-002", respondentUid: null, respondentName: "Jorge Luis Herrera", unitId: "t1-102", answers: [{ questionId: "q1", value: "7:00–21:00" }], respondedOffsetDays: -18 },
  { id: "sresp-playas-003", surveyId: "survey-playas-002", respondentUid: null, respondentName: "Ana Sofía Romero", unitId: "t2-201", answers: [{ questionId: "q1", value: "8:00–22:00" }], respondedOffsetDays: -15 },
  { id: "sresp-playas-004", surveyId: "survey-playas-002", respondentUid: null, respondentName: "Hugo Martínez Bravo", unitId: "t2-204", answers: [{ questionId: "q1", value: "8:00–22:00" }], respondedOffsetDays: -12 },
];

// ── Acuerdos de comité ──────────────────────────────────────────────────────────
export const AGREEMENTS_PLAYAS = [
  {
    id: "agreement-playas-001",
    title: "Acta de asamblea: aprobación de presupuesto anual",
    sessionOffsetDays: -15,
    signatureMode: "obligatoria",
    signerScope: "all",
    status: "enviado",
    createdBy: DEMO_EMAIL,
    // firmas ya realizadas por algunas unidades; el resto queda pendiente
    signedUnitIds: ["t1-101", "t1-102", "t2-201", "t1-105"],
  },
  {
    id: "agreement-playas-002",
    title: "Comunicado del comité: lineamientos de mascotas",
    sessionOffsetDays: -8,
    signatureMode: "informativo",
    signerScope: "all",
    status: "enviado",
    createdBy: DEMO_EMAIL,
    signedUnitIds: [],
  },
];
