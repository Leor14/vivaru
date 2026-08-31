/**
 * seed-data-co.mjs
 *
 * Datos demo para TENANT COLOMBIA — "Conjunto Residencial El Nogal" (Bogotá).
 * Solo exporta constantes. No ejecuta nada.
 * Usado por seed-tenant.mjs.
 */

export const TENANT_CO = {
  id: "tenant-nogal-bogota",
  name: "Conjunto Residencial El Nogal",
  city: "Bogotá",
  country: "CO",
  planId: "plus",
  status: "active",
  onboardingStatus: "completed",
  branding: { primaryColor: "#1A3C6E", accentColor: "#E8A020" },
};

export const USERS_CO = [
  {
    email: "admin@elnogal.co",
    password: "Demo1234*",
    displayName: "Claudia Moreno Ríos",
    role: "tenant_admin",
    tenantId: TENANT_CO.id,
  },
  {
    email: "maria.ospina@elnogal.co",
    password: "Demo1234*",
    displayName: "María Ospina Vargas",
    role: "resident",
    tenantId: TENANT_CO.id,
    unitId: "t1-301",
    unitLabel: "T1-301",
  },
  {
    email: "juan.herrera@elnogal.co",
    password: "Demo1234*",
    displayName: "Juan Herrera Salcedo",
    role: "resident",
    tenantId: TENANT_CO.id,
    unitId: "nogal-t2-204",
    unitLabel: "T2-204",
  },
  {
    email: "guardia@elnogal.co",
    password: "Demo1234*",
    displayName: "Andrés Castaño",
    role: "security_guard",
    tenantId: TENANT_CO.id,
  },
];

// **CINCO DE ESTAS UNIDADES LLEVAN PREFIJO, Y NO ES ESTÉTICA.**
//
// `units` es una colección RAÍZ: el id de documento es global, no vive dentro del
// conjunto. Esta semilla y la de Las Playas declaraban los mismos cinco ids
// —`t1-101`, `t1-102`, `t2-201`, `t2-202` y `t2-204`—, así que **no cabían las
// dos**: la que sembró última se quedó el documento con SU `tenantId` y a la otra
// le desaparecieron cinco unidades. Ganó Las Playas, y El Nogal quedó con quince
// documentos huérfanos —cargos, paquetes, reservas, pases, personas y **la
// membresía de `juan.herrera@elnogal.co`, que por eso no veía nada**—.
//
// Estaba así desde `b2ddf68` (10 de mayo de 2026) y en LOS DOS ambientes, con las
// mismas cinco: no es un accidente de una corrida, es determinista.
//
// El campo `unitId` sigue siendo el slug pelado, y ahí no hay colisión posible:
// es un campo dentro de un documento que ya está separado por `tenantId`.
// `tests/semillas-ids-de-unidad.test.ts` vigila que no vuelva a pasar.
export const UNITS_CO = [
  // Torre 1
  { id: "nogal-t1-101", unitId: "t1-101", displayName: "T1-101", tower: "Torre 1" },
  { id: "nogal-t1-102", unitId: "t1-102", displayName: "T1-102", tower: "Torre 1" },
  { id: "t1-201", unitId: "t1-201", displayName: "T1-201", tower: "Torre 1" },
  { id: "t1-202", unitId: "t1-202", displayName: "T1-202", tower: "Torre 1" },
  { id: "t1-301", unitId: "t1-301", displayName: "T1-301", tower: "Torre 1" },
  { id: "t1-302", unitId: "t1-302", displayName: "T1-302", tower: "Torre 1" },
  { id: "t1-401", unitId: "t1-401", displayName: "T1-401", tower: "Torre 1" },
  { id: "t1-402", unitId: "t1-402", displayName: "T1-402", tower: "Torre 1" },
  { id: "t1-501", unitId: "t1-501", displayName: "T1-501", tower: "Torre 1" },
  { id: "t1-502", unitId: "t1-502", displayName: "T1-502", tower: "Torre 1" },
  // Torre 2
  { id: "t2-101", unitId: "t2-101", displayName: "T2-101", tower: "Torre 2" },
  { id: "t2-102", unitId: "t2-102", displayName: "T2-102", tower: "Torre 2" },
  { id: "nogal-t2-201", unitId: "t2-201", displayName: "T2-201", tower: "Torre 2" },
  { id: "nogal-t2-202", unitId: "t2-202", displayName: "T2-202", tower: "Torre 2" },
  { id: "nogal-t2-204", unitId: "t2-204", displayName: "T2-204", tower: "Torre 2" },
  { id: "t2-301", unitId: "t2-301", displayName: "T2-301", tower: "Torre 2" },
  { id: "t2-302", unitId: "t2-302", displayName: "T2-302", tower: "Torre 2" },
  { id: "t2-401", unitId: "t2-401", displayName: "T2-401", tower: "Torre 2" },
  { id: "t2-402", unitId: "t2-402", displayName: "T2-402", tower: "Torre 2" },
  { id: "t2-501", unitId: "t2-501", displayName: "T2-501", tower: "Torre 2" },
];

export const PEOPLE_CO = [
  {
    id: "person-ospina-co",
    fullName: "María Ospina Vargas",
    email: "maria.ospina@elnogal.co",
    phone: "3012345678",
    documentNumber: "52887654",
    roleType: "owner_occupant",
    occupancyType: "owner_occupant",
    unitId: "t1-301",
    tower: "Torre 1",
  },
  {
    id: "person-herrera-co",
    fullName: "Juan Herrera Salcedo",
    email: "juan.herrera@elnogal.co",
    phone: "3109876543",
    documentNumber: "79245678",
    roleType: "tenant",
    occupancyType: "tenant",
    unitId: "nogal-t2-204",
    tower: "Torre 2",
  },
  {
    id: "person-montoya-co",
    fullName: "Juliana Montoya Pérez",
    email: "juliana.montoya@elnogal.co",
    phone: "3154321098",
    documentNumber: "43118765",
    roleType: "owner_occupant",
    occupancyType: "owner_occupant",
    unitId: "nogal-t1-101",
    tower: "Torre 1",
  },
  {
    id: "person-restrepo-co",
    fullName: "Fabio Restrepo Cruz",
    email: "fabio.restrepo@elnogal.co",
    phone: "3167654321",
    documentNumber: "70234567",
    roleType: "tenant",
    occupancyType: "tenant",
    unitId: "nogal-t1-102",
    tower: "Torre 1",
  },
  {
    id: "person-vasquez-co",
    fullName: "Catalina Vásquez Rueda",
    email: "catalina.vasquez@elnogal.co",
    phone: "3004567890",
    documentNumber: "39876543",
    roleType: "owner_occupant",
    occupancyType: "owner_occupant",
    unitId: "t2-101",
    tower: "Torre 2",
  },
  {
    id: "person-jimenez-co",
    fullName: "Andrés Jiménez Torres",
    email: "andres.jimenez@elnogal.co",
    phone: "3213456789",
    documentNumber: "80123456",
    roleType: "tenant",
    occupancyType: "tenant",
    unitId: "t2-102",
    tower: "Torre 2",
  },
  {
    id: "person-garcia-co",
    fullName: "Luisa García Mendez",
    email: "luisa.garcia@elnogal.co",
    phone: "3198765432",
    documentNumber: "41987654",
    roleType: "owner_occupant",
    occupancyType: "owner_occupant",
    unitId: "t1-201",
    tower: "Torre 1",
  },
  {
    id: "person-rojas-co",
    fullName: "Santiago Rojas Peña",
    email: "santiago.rojas@elnogal.co",
    phone: "3056789012",
    documentNumber: "91234567",
    roleType: "tenant",
    occupancyType: "tenant",
    unitId: "t2-301",
    tower: "Torre 2",
  },
];

export const AMENITIES_CO = [
  { id: "amenity-salon-co",   name: "Salón Social",       category: "social",    status: "active" },
  { id: "amenity-tenis-co",   name: "Cancha de Tenis",    category: "sports",    status: "active" },
  { id: "amenity-bbq-co",     name: "Zona BBQ",           category: "social",    status: "active" },
  { id: "amenity-gym-co",     name: "Gimnasio",           category: "wellness",  status: "active" },
  { id: "amenity-reunion-co", name: "Salón de Reuniones", category: "business",  status: "active" },
];

// Billing: unitId = slug, amount in COP
export const BILLING_CO = [
  { id: "bill-t1301-2026-03-co", unitId: "t1-301", unitLabel: "T1-301", period: "2026-03", amount: 350000, balance: 0,      status: "paid",    dueDate: "2026-03-15" },
  { id: "bill-t1301-2026-04-co", unitId: "t1-301", unitLabel: "T1-301", period: "2026-04", amount: 430000, balance: 0,      status: "paid",    dueDate: "2026-04-15" },
  { id: "bill-t1301-2026-05-co", unitId: "t1-301", unitLabel: "T1-301", period: "2026-05", amount: 350000, balance: 350000, status: "pending", dueDate: "2026-05-15" },
  { id: "bill-t2204-2026-03-co", unitId: "nogal-t2-204", unitLabel: "T2-204", period: "2026-03", amount: 430000, balance: 0,      status: "paid",    dueDate: "2026-03-15" },
  { id: "bill-t2204-2026-04-co", unitId: "nogal-t2-204", unitLabel: "T2-204", period: "2026-04", amount: 350000, balance: 350000, status: "overdue", dueDate: "2026-04-15" },
  { id: "bill-t2204-2026-05-co", unitId: "nogal-t2-204", unitLabel: "T2-204", period: "2026-05", amount: 430000, balance: 430000, status: "pending", dueDate: "2026-05-15" },
  { id: "bill-t1101-2026-05-co", unitId: "nogal-t1-101", unitLabel: "T1-101", period: "2026-05", amount: 350000, balance: 350000, status: "pending", dueDate: "2026-05-15" },
  { id: "bill-t2101-2026-05-co", unitId: "t2-101", unitLabel: "T2-101", period: "2026-05", amount: 350000, balance: 0,      status: "paid",    dueDate: "2026-05-15" },
  // Parqueadero T1-301.
  // **`concept` es una CLAVE del catálogo, no una etiqueta.** Esta línea decía `"Parqueadero"` con
  // mayúscula —el rótulo— y el catálogo la tiene como `parqueadero`: el cargo se leía como
  // «Mantenimiento y Administración» en pantalla y su asiento caía en «otros ingresos» en vez de
  // en «Parqueaderos». Sembró el mismo dato malo en los DOS ambientes.
  { id: "bill-t1301-parking-2026-05-co", unitId: "t1-301", unitLabel: "T1-301", period: "2026-05", amount: 80000, balance: 80000, status: "pending", dueDate: "2026-05-15", concept: "parqueadero" },
];

// PQRS: radicationDate calculated at seed time via offsetDays
export const PQRS_CO = [
  {
    id: "pqrs-001-co",
    unitId: "nogal-t2-204", unitLabel: "T2-204",
    category: "maintenance", type: "pqrs",
    subject: "Filtración de agua en techo de parqueadero nivel -1",
    message: "Se evidencia filtración activa de agua en la cubierta del parqueadero nivel -1, afectando vehículos estacionados. Requiere revisión urgente de impermeabilización.",
    status: "open", priority: "high",
    radicationOffsetDays: -5,
    residentName: "Juan Herrera Salcedo",
  },
  {
    id: "pqrs-002-co",
    unitId: "t1-301", unitLabel: "T1-301",
    category: "pqrs", type: "complaint",
    subject: "Ruido excesivo en horas de descanso",
    message: "Se presentan ruidos fuertes provenientes del apartamento T1-302 entre las 10:00 p.m. y 1:00 a.m. de manera frecuente, afectando el descanso de los residentes del piso.",
    status: "in_progress", priority: "medium",
    radicationOffsetDays: -8,
    residentName: "María Ospina Vargas",
  },
  {
    id: "pqrs-003-co",
    unitId: "nogal-t1-101", unitLabel: "T1-101",
    category: "pqrs", type: "petition",
    subject: "Solicitud de copia del reglamento de propiedad horizontal",
    message: "Por favor suministrar copia digital del reglamento de propiedad horizontal actualizado para revisión personal.",
    status: "resolved", priority: "low",
    radicationOffsetDays: -15,
    residentName: "Juliana Montoya Pérez",
    response: "Se adjunta el reglamento de propiedad horizontal actualizado en el módulo de documentos del portal.",
    respondedAt: -12,
  },
  {
    id: "pqrs-004-co",
    unitId: "nogal-t2-204", unitLabel: "T2-204",
    category: "billing", type: "claim",
    subject: "Cobro duplicado en estado de cuenta de febrero",
    message: "En el estado de cuenta de febrero aparece un cobro duplicado de administración por $350.000. Solicito corrección y nota crédito.",
    status: "resolved", priority: "medium",
    radicationOffsetDays: -20,
    residentName: "Juan Herrera Salcedo",
    response: "Verificado con el área de cartera. Se realizó ajuste en el estado de cuenta. Disculpas por el inconveniente.",
    respondedAt: -17,
  },
  {
    id: "pqrs-005-co",
    unitId: "t1-201", unitLabel: "T1-201",
    category: "maintenance", type: "pqrs",
    subject: "Avería en puerta de acceso peatonal",
    message: "La puerta de acceso peatonal de la Torre 1 no cierra correctamente, quedando abierta y comprometiendo la seguridad del conjunto.",
    status: "open", priority: "high",
    radicationOffsetDays: -2,
    residentName: "Luisa García Mendez",
  },
];

export const VISITORS_CO = [
  {
    id: "visit-001-co",
    unitId: "t1-301", unitLabel: "T1-301", tower: "Torre 1", unit: "301",
    visitorName: "Carlos Ospina",
    documentNumber: "1023456789",
    qrCodeValue: "QR-CO-001",
    hostResidentName: "María Ospina Vargas",
    visitorCategory: "familiar",
    status: "completed",
    offsetDays: -3,
  },
  {
    id: "visit-002-co",
    unitId: "t1-301", unitLabel: "T1-301", tower: "Torre 1", unit: "301",
    visitorName: "Domiciliario Rappi",
    documentNumber: "1098765432",
    qrCodeValue: "QR-CO-002",
    hostResidentName: "María Ospina Vargas",
    visitorCategory: "servicio",
    status: "completed",
    offsetDays: -1,
  },
  {
    id: "visit-003-co",
    unitId: "nogal-t2-204", unitLabel: "T2-204", tower: "Torre 2", unit: "204",
    visitorName: "Técnico InterNet Colombia",
    documentNumber: "900443221",
    qrCodeValue: "QR-CO-003",
    hostResidentName: "Juan Herrera Salcedo",
    visitorCategory: "servicio",
    status: "inside",
    offsetDays: 0,
  },
  {
    id: "visit-004-co",
    unitId: "nogal-t1-101", unitLabel: "T1-101", tower: "Torre 1", unit: "101",
    visitorName: "Invitado Programado",
    documentNumber: "1034567890",
    qrCodeValue: "QR-CO-004",
    hostResidentName: "Juliana Montoya Pérez",
    visitorCategory: "familiar",
    status: "scheduled",
    offsetDays: 1,
  },
];

export const PACKAGES_CO = [
  {
    id: "pkg-001-co",
    unitId: "nogal-t2-204", unitLabel: "T2-204",
    recipientName: "Juan Herrera Salcedo",
    reference: "PKG-CO-001",
    description: "Mercado Jumbo",
    status: "delivered",
    arrivedOffsetDays: -2,
    deliveredOffsetDays: -1,
    deliveredToName: "Juan Herrera Salcedo",
  },
  {
    id: "pkg-002-co",
    unitId: "t1-301", unitLabel: "T1-301",
    recipientName: "María Ospina Vargas",
    reference: "PKG-CO-002",
    description: "Pedido Amazon",
    status: "pending",
    arrivedOffsetDays: -1,
  },
  {
    id: "pkg-003-co",
    unitId: "nogal-t1-101", unitLabel: "T1-101",
    recipientName: "Juliana Montoya Pérez",
    reference: "PKG-CO-003",
    description: "Medicamentos",
    status: "pending",
    arrivedOffsetDays: 0,
  },
];

export const COMMUNICATIONS_CO = [
  {
    id: "comm-001-co",
    title: "Corte de agua programado – 15 de mayo 9:00 a.m.",
    message: "Informamos que el día 15 de mayo de 2026 se realizará mantenimiento en la red hidráulica del conjunto. El corte de agua estará programado entre las 9:00 a.m. y las 2:00 p.m. Se recomienda almacenar agua con anticipación.",
    status: "published",
    startsOffsetDays: 0,
    endsOffsetDays: 7,
    createdBy: "admin@elnogal.co",
  },
  {
    id: "comm-002-co",
    title: "Asamblea ordinaria 2026 – convocatoria oficial",
    message: "Se convoca a todos los propietarios y residentes del Conjunto Residencial El Nogal a la Asamblea Ordinaria de Copropietarios 2026. Fecha: sábado 6 de junio, 9:00 a.m. Lugar: Salón Social. Agenda disponible en el portal.",
    status: "published",
    startsOffsetDays: -3,
    endsOffsetDays: 20,
    createdBy: "admin@elnogal.co",
  },
  {
    id: "comm-003-co",
    title: "Restricción parqueadero visitantes – semana santa",
    message: "Durante la semana santa (del 12 al 20 de abril) el parqueadero de visitantes estará disponible únicamente para residentes del conjunto. Se agradece la comprensión.",
    status: "published",
    startsOffsetDays: -45,
    endsOffsetDays: -30,
    createdBy: "admin@elnogal.co",
  },
];

export const RESERVATIONS_CO = [
  {
    id: "res-001-co",
    amenityName: "Salón Social",
    unitId: "t1-301", unitLabel: "T1-301",
    reservedBy: "María Ospina Vargas",
    dateOffsetDays: 6,   // próximo sábado (aprox)
    startTime: "18:00", endTime: "23:00",
    status: "approved",
    paymentConfirmed: true,
  },
  {
    id: "res-002-co",
    amenityName: "Cancha de Tenis",
    unitId: "nogal-t2-204", unitLabel: "T2-204",
    reservedBy: "Juan Herrera Salcedo",
    dateOffsetDays: 1,
    startTime: "07:00", endTime: "09:00",
    status: "pending",
    paymentConfirmed: false,
  },
  {
    id: "res-003-co",
    amenityName: "Zona BBQ",
    unitId: "nogal-t1-102", unitLabel: "T1-102",
    reservedBy: "Fabio Restrepo Cruz",
    dateOffsetDays: -14,
    startTime: "12:00", endTime: "17:00",
    status: "cancelled",
    paymentConfirmed: false,
  },
];
