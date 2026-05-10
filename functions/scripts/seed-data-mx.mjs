/**
 * seed-data-mx.mjs
 *
 * Datos demo para TENANT MÉXICO — "Privada Las Palmas" (Ciudad de México).
 * Solo exporta constantes. No ejecuta nada.
 * Usado por seed-tenant.mjs.
 */

export const TENANT_MX = {
  id: "tenant-palmas-cdmx",
  name: "Privada Las Palmas",
  city: "Ciudad de México",
  country: "MX",
  planId: "plus",
  status: "active",
  onboardingStatus: "completed",
  branding: { primaryColor: "#2D5016", accentColor: "#C8A400" },
};

export const USERS_MX = [
  {
    email: "admin@privadapalmas.mx",
    password: "Demo1234*",
    displayName: "Sofía Ramírez Herrera",
    role: "tenant_admin",
    tenantId: TENANT_MX.id,
  },
  {
    email: "roberto.luna@privadapalmas.mx",
    password: "Demo1234*",
    displayName: "Roberto Luna Mendoza",
    role: "resident",
    tenantId: TENANT_MX.id,
    unitId: "ea-302",
    unitLabel: "EA-302",
  },
  {
    email: "valeria.torres@privadapalmas.mx",
    password: "Demo1234*",
    displayName: "Valeria Torres Ríos",
    role: "resident",
    tenantId: TENANT_MX.id,
    unitId: "ea-501",
    unitLabel: "EA-501",
  },
  {
    email: "guardia@privadapalmas.mx",
    password: "Demo1234*",
    displayName: "Miguel Ángel Soto",
    role: "security_guard",
    tenantId: TENANT_MX.id,
  },
];

// Edificio A — 6 pisos × 4 deptos = 24 unidades
function buildUnits() {
  const units = [];
  for (let floor = 1; floor <= 6; floor++) {
    for (let num = 1; num <= 4; num++) {
      const slug = `ea-${floor}0${num}`;
      units.push({
        id: slug,
        unitId: slug,
        displayName: `EA-${floor}0${num}`,
        tower: "Edificio A",
      });
    }
  }
  return units;
}

export const UNITS_MX = buildUnits();

export const PEOPLE_MX = [
  {
    id: "person-luna-mx",
    fullName: "Roberto Luna Mendoza",
    email: "roberto.luna@privadapalmas.mx",
    phone: "5512345678",
    documentNumber: "LUMR810405",
    roleType: "owner_occupant",
    occupancyType: "owner_occupant",
    unitId: "ea-302",
    tower: "Edificio A",
  },
  {
    id: "person-torres-mx",
    fullName: "Valeria Torres Ríos",
    email: "valeria.torres@privadapalmas.mx",
    phone: "5598765432",
    documentNumber: "TORV920812",
    roleType: "tenant",
    occupancyType: "tenant",
    unitId: "ea-501",
    tower: "Edificio A",
  },
  {
    id: "person-garcia-mx",
    fullName: "Carmen García Vidal",
    email: "carmen.garcia@privadapalmas.mx",
    phone: "5534567890",
    documentNumber: "GAVC750120",
    roleType: "owner_occupant",
    occupancyType: "owner_occupant",
    unitId: "ea-101",
    tower: "Edificio A",
  },
  {
    id: "person-mendez-mx",
    fullName: "Jorge Méndez Castillo",
    email: "jorge.mendez@privadapalmas.mx",
    phone: "5567890123",
    documentNumber: "MECJ880630",
    roleType: "tenant",
    occupancyType: "tenant",
    unitId: "ea-201",
    tower: "Edificio A",
  },
  {
    id: "person-ramos-mx",
    fullName: "Patricia Ramos Aguilar",
    email: "patricia.ramos@privadapalmas.mx",
    phone: "5523456789",
    documentNumber: "RAAP700915",
    roleType: "owner_occupant",
    occupancyType: "owner_occupant",
    unitId: "ea-401",
    tower: "Edificio A",
  },
  {
    id: "person-flores-mx",
    fullName: "Daniel Flores Morales",
    email: "daniel.flores@privadapalmas.mx",
    phone: "5578901234",
    documentNumber: "FLMD950220",
    roleType: "tenant",
    occupancyType: "tenant",
    unitId: "ea-102",
    tower: "Edificio A",
  },
];

export const AMENITIES_MX = [
  { id: "amenity-roof-mx",    name: "Roof Garden",      category: "social",   status: "active" },
  { id: "amenity-gym-mx",     name: "Gimnasio",          category: "wellness", status: "active" },
  { id: "amenity-juegos-mx",  name: "Área de Juegos",    category: "social",   status: "active" },
  { id: "amenity-salon-mx",   name: "Salón de Usos",     category: "business", status: "active" },
  { id: "amenity-alberca-mx", name: "Alberca",           category: "wellness", status: "active" },
];

// Billing MXN: cuota mantenimiento $2,800 + fondo reserva $400 = $3,200/mes
export const BILLING_MX = [
  { id: "bill-ea302-2026-03-mx", unitId: "ea-302", unitLabel: "EA-302", period: "2026-03", amount: 3200, balance: 0,    status: "paid",    dueDate: "2026-03-15" },
  { id: "bill-ea302-2026-04-mx", unitId: "ea-302", unitLabel: "EA-302", period: "2026-04", amount: 3200, balance: 0,    status: "paid",    dueDate: "2026-04-15" },
  { id: "bill-ea302-2026-05-mx", unitId: "ea-302", unitLabel: "EA-302", period: "2026-05", amount: 3200, balance: 3200, status: "pending", dueDate: "2026-05-15" },
  { id: "bill-ea501-2026-03-mx", unitId: "ea-501", unitLabel: "EA-501", period: "2026-03", amount: 3200, balance: 0,    status: "paid",    dueDate: "2026-03-15" },
  { id: "bill-ea501-2026-04-mx", unitId: "ea-501", unitLabel: "EA-501", period: "2026-04", amount: 3200, balance: 3200, status: "overdue", dueDate: "2026-04-15" },
  { id: "bill-ea501-2026-05-mx", unitId: "ea-501", unitLabel: "EA-501", period: "2026-05", amount: 3200, balance: 3200, status: "pending", dueDate: "2026-05-15" },
  { id: "bill-ea101-2026-05-mx", unitId: "ea-101", unitLabel: "EA-101", period: "2026-05", amount: 3200, balance: 3200, status: "pending", dueDate: "2026-05-15" },
  { id: "bill-ea201-2026-05-mx", unitId: "ea-201", unitLabel: "EA-201", period: "2026-05", amount: 3200, balance: 0,    status: "paid",    dueDate: "2026-05-15" },
];

export const PQRS_MX = [
  {
    id: "pqrs-001-mx",
    unitId: "ea-302", unitLabel: "EA-302",
    category: "maintenance", type: "pqrs",
    subject: "Falla en elevador principal – queda detenido entre pisos 3 y 4",
    message: "El elevador principal del Edificio A presenta falla recurrente, quedando detenido entre los pisos 3 y 4. Esto afecta la movilidad de residentes adultos mayores y familias con carriolas. Requiere revisión urgente de la empresa mantenedora.",
    status: "open", priority: "high",
    radicationOffsetDays: -3,
    residentName: "Roberto Luna Mendoza",
  },
  {
    id: "pqrs-002-mx",
    unitId: "ea-501", unitLabel: "EA-501",
    category: "pqrs", type: "complaint",
    subject: "Ruido por obra en depto EA-405 en horario no autorizado",
    message: "El depto EA-405 está realizando obra de remodelación en horarios no autorizados (antes de las 8:00 a.m. y después de las 6:00 p.m.), incluyendo fines de semana. Solicito intervención de la administración.",
    status: "in_progress", priority: "medium",
    radicationOffsetDays: -6,
    residentName: "Valeria Torres Ríos",
  },
  {
    id: "pqrs-003-mx",
    unitId: "ea-101", unitLabel: "EA-101",
    category: "pqrs", type: "petition",
    subject: "Solicitud de acceso a grabación de cámara del estacionamiento",
    message: "Solicito acceso a la grabación de la cámara del estacionamiento del día 28 de abril entre las 14:00 y las 16:00 horas, para verificar un incidente con mi vehículo.",
    status: "resolved", priority: "low",
    radicationOffsetDays: -10,
    residentName: "Carmen García Vidal",
    response: "Se proporcionó acceso a la grabación solicitada en coordinación con el área de seguridad. El incidente quedó registrado en bitácora.",
    respondedAt: -8,
  },
  {
    id: "pqrs-004-mx",
    unitId: "ea-302", unitLabel: "EA-302",
    category: "billing", type: "claim",
    subject: "Cobro incorrecto en recibo de enero – pagué y aparece adeudo",
    message: "Realicé el pago de mi cuota de mantenimiento de enero por transferencia el día 10 de enero, pero en el sistema sigue apareciendo como adeudo. Adjunto comprobante de transferencia.",
    status: "resolved", priority: "medium",
    radicationOffsetDays: -20,
    residentName: "Roberto Luna Mendoza",
    response: "Se verificó el pago con el área de administración. El adeudo fue corregido en el sistema. Disculpas por el inconveniente generado.",
    respondedAt: -18,
  },
];

export const VISITORS_MX = [
  {
    id: "visit-001-mx",
    unitId: "ea-302", unitLabel: "EA-302", tower: "Edificio A", unit: "302",
    visitorName: "Claudia Luna",
    documentNumber: "LUMC890315",
    qrCodeValue: "QR-MX-001",
    hostResidentName: "Roberto Luna Mendoza",
    visitorCategory: "familiar",
    status: "completed",
    offsetDays: -2,
  },
  {
    id: "visit-002-mx",
    unitId: "ea-302", unitLabel: "EA-302", tower: "Edificio A", unit: "302",
    visitorName: "Uber Eats",
    documentNumber: "UEATS000001",
    qrCodeValue: "QR-MX-002",
    hostResidentName: "Roberto Luna Mendoza",
    visitorCategory: "servicio",
    status: "completed",
    offsetDays: -1,
  },
  {
    id: "visit-003-mx",
    unitId: "ea-501", unitLabel: "EA-501", tower: "Edificio A", unit: "501",
    visitorName: "Plomero – Servicio Hidráulico",
    documentNumber: "SERVHID0001",
    qrCodeValue: "QR-MX-003",
    hostResidentName: "Valeria Torres Ríos",
    visitorCategory: "servicio",
    status: "inside",
    offsetDays: 0,
  },
  {
    id: "visit-004-mx",
    unitId: "ea-101", unitLabel: "EA-101", tower: "Edificio A", unit: "101",
    visitorName: "Visita Programada",
    documentNumber: "1234567890",
    qrCodeValue: "QR-MX-004",
    hostResidentName: "Carmen García Vidal",
    visitorCategory: "familiar",
    status: "scheduled",
    offsetDays: 1,
  },
];

export const PACKAGES_MX = [
  {
    id: "pkg-001-mx",
    unitId: "ea-302", unitLabel: "EA-302",
    recipientName: "Roberto Luna Mendoza",
    reference: "PKG-MX-001",
    description: "Pedido Liverpool",
    status: "delivered",
    arrivedOffsetDays: -2,
    deliveredOffsetDays: -1,
    deliveredToName: "Roberto Luna Mendoza",
  },
  {
    id: "pkg-002-mx",
    unitId: "ea-501", unitLabel: "EA-501",
    recipientName: "Valeria Torres Ríos",
    reference: "PKG-MX-002",
    description: "Paquete Amazon",
    status: "pending",
    arrivedOffsetDays: 0,
  },
  {
    id: "pkg-003-mx",
    unitId: "ea-101", unitLabel: "EA-101",
    recipientName: "Carmen García Vidal",
    reference: "PKG-MX-003",
    description: "Farmacia San Pablo",
    status: "pending",
    arrivedOffsetDays: -1,
  },
];

export const COMMUNICATIONS_MX = [
  {
    id: "comm-001-mx",
    title: "Mantenimiento programado de elevadores – 20 de mayo",
    message: "Se informa a todos los condóminos que el día 20 de mayo de 2026 se realizará mantenimiento preventivo a los elevadores del Edificio A. El servicio estará suspendido de 9:00 a.m. a 1:00 p.m. Se pide tomar previsiones necesarias.",
    status: "published",
    startsOffsetDays: 0,
    endsOffsetDays: 12,
    createdBy: "admin@privadapalmas.mx",
  },
  {
    id: "comm-002-mx",
    title: "Asamblea de condóminos 2026 – primera convocatoria",
    message: "Se convoca a todos los condóminos de Privada Las Palmas a la Asamblea Ordinaria 2026. Fecha: sábado 13 de junio, 10:00 a.m. Lugar: Salón de Usos Múltiples. Se tomarán acuerdos sobre el fondo de reserva y mejoras a áreas comunes.",
    status: "published",
    startsOffsetDays: -2,
    endsOffsetDays: 35,
    createdBy: "admin@privadapalmas.mx",
  },
  {
    id: "comm-003-mx",
    title: "Normas uso de alberca – temporada 2026",
    message: "Con el inicio de la temporada de calor, recordamos las normas de uso de la alberca: horario 7:00 a.m. a 9:00 p.m., obligatorio regadera previa, prohibido el uso de flotadores inflables grandes. Máximo 10 personas simultáneas.",
    status: "published",
    startsOffsetDays: -5,
    endsOffsetDays: 60,
    createdBy: "admin@privadapalmas.mx",
  },
];

export const RESERVATIONS_MX = [
  {
    id: "res-001-mx",
    amenityName: "Salón de Usos",
    unitId: "ea-302", unitLabel: "EA-302",
    reservedBy: "Roberto Luna Mendoza",
    dateOffsetDays: 5,   // próximo viernes (aprox)
    startTime: "19:00", endTime: "23:00",
    status: "approved",
    paymentConfirmed: true,
  },
  {
    id: "res-002-mx",
    amenityName: "Alberca",
    unitId: "ea-501", unitLabel: "EA-501",
    reservedBy: "Valeria Torres Ríos",
    dateOffsetDays: 1,
    startTime: "10:00", endTime: "13:00",
    status: "pending",
    paymentConfirmed: false,
  },
  {
    id: "res-003-mx",
    amenityName: "Roof Garden",
    unitId: "ea-201", unitLabel: "EA-201",
    reservedBy: "Jorge Méndez Castillo",
    dateOffsetDays: -7,
    startTime: "17:00", endTime: "21:00",
    status: "cancelled",
    paymentConfirmed: false,
  },
];
