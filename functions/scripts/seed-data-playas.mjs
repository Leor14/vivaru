/**
 * seed-data-playas.mjs
 *
 * Datos demo para "Conjunto Las Playas" (México, MXN) con ~3 meses + mes actual de
 * operación DENSA en todos los módulos. Solo exporta constantes; lo consume seed-tenant.mjs.
 *
 * Diseño:
 *  - Montos en MXN. Fechas RELATIVAS a hoy (siempre fresco al re-sembrar).
 *  - Correos demo -> david.macar.18@hotmail.com (alias +res1/+res2/+res3/+porteria).
 *  - Estados finales en el create (evita triggers de UPDATE que envían correo).
 *  - billing con source:"import" (no dispara correos de cobro). No se siembran paymentVouchers
 *    (su trigger envía correo por cada comprobante).
 *  - Datos generados de forma determinista (sin aleatoriedad).
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
/** YYYY-MM-DD a partir de un offset en días desde hoy. */
function dayStr(offsetDays) {
  return new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);
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
      units.push({ id: slug, unitId: slug, displayName: `${prefix.toUpperCase()}-${num}`, tower, num: String(num) });
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
const unitNum = Object.fromEntries(UNITS_PLAYAS.map((u) => [u.id, u.num]));
const personName = Object.fromEntries(PERSON_DEFS.map(([slug, name]) => [slug, name]));
const SLUGS = UNITS_PLAYAS.map((u) => u.id);
const label = (slug) => slug.toUpperCase();

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
const AMENITY_NAMES = AMENITIES_PLAYAS.map((a) => a.name);

// ════════════════════════════════════════════════════════════════════════════════
//  CARTERA / FINANZAS (3 meses + actual)
// ════════════════════════════════════════════════════════════════════════════════

const MOROSOS = new Set(["t1-103", "t2-204"]);          // deben mes anterior (vencido) + actual (pendiente)
const PENDIENTE_ACTUAL = new Set(["t1-104", "t2-205"]); // solo deben el mes actual (pendiente)

// Campañas de cobro: una por período (administración).
export const CAMPAIGNS_PLAYAS = [3, 2, 1, 0].map((monthsAgo) => ({
  id: `campaign-playas-${periodStr(monthsAgo)}`,
  concept: "administracion",
  period: periodStr(monthsAgo),
  unitAmount: CUOTA,
  dueDate: monthsAgo === 0 ? dueStr(0, "last") : dueStr(monthsAgo, 15),
  unitCount: UNITS_PLAYAS.length,
  source: "immediate",
  status: monthsAgo === 0 ? "vigente" : "cerrada",
  sentOffsetDays: -(monthsAgo * 30 + 14),
}));

function buildBilling() {
  const out = [];
  for (const u of UNITS_PLAYAS) {
    for (const monthsAgo of [3, 2, 1, 0]) {
      const period = periodStr(monthsAgo);
      let status = "paid";
      let balance = 0;
      let paymentAmount = CUOTA;
      let lastPaymentAt = dueStr(monthsAgo, 8);
      let dueDate = dueStr(monthsAgo, 15);

      if (monthsAgo === 1 && MOROSOS.has(u.id)) {
        status = "overdue"; balance = CUOTA; paymentAmount = 0; lastPaymentAt = null;
      } else if (monthsAgo === 0) {
        dueDate = dueStr(0, "last");
        if (MOROSOS.has(u.id) || PENDIENTE_ACTUAL.has(u.id)) {
          status = "pending"; balance = CUOTA; paymentAmount = 0; lastPaymentAt = null;
        }
      }

      out.push({
        id: `bill-playas-${u.id}-${period}`,
        unitId: u.id, unitLabel: u.displayName, period, amount: CUOTA, balance,
        paymentAmount, lastPaymentAt, status, dueDate,
        concept: "administracion", source: "import",
        campaignId: `campaign-playas-${period}`,
      });
    }
  }
  // Un par de extraordinarios para enriquecer la cartera.
  out.push({
    id: `bill-playas-t1-106-extra-${periodStr(1)}`, unitId: "t1-106", unitLabel: "T1-106",
    period: periodStr(1), amount: 1500, balance: 0, paymentAmount: 1500, lastPaymentAt: dueStr(1, 20),
    status: "paid", dueDate: dueStr(1, 20), concept: "extraordinaria", source: "import",
  });
  out.push({
    id: `bill-playas-t2-203-multa-${periodStr(0)}`, unitId: "t2-203", unitLabel: "T2-203",
    period: periodStr(0), amount: 500, balance: 500, paymentAmount: 0, lastPaymentAt: null,
    status: "pending", dueDate: dueStr(0, "last"), concept: "multa", source: "import",
  });
  return out;
}
export const BILLING_PLAYAS = buildBilling();

// Comprobantes subidos por residentes (varios estados).
export const PAYMENT_RECEIPTS_PLAYAS = [
  { id: "receipt-playas-001", unitId: "t1-102", unitLabel: "T1-102", statementId: `bill-playas-t1-102-${periodStr(0)}`, uploadedByName: "Jorge Luis Herrera", amount: CUOTA, status: "pending", fileName: "transferencia-junio.jpg", uploadedOffsetDays: -1 },
  { id: "receipt-playas-002", unitId: "t1-101", unitLabel: "T1-101", statementId: `bill-playas-t1-101-${periodStr(1)}`, uploadedByName: "María Fernanda Castillo", amount: CUOTA, status: "approved", fileName: "comprobante-mayo.pdf", uploadedOffsetDays: -32, reviewedOffsetDays: -31, reviewedByName: "Carolina Méndez" },
  { id: "receipt-playas-003", unitId: "t2-201", unitLabel: "T2-201", statementId: `bill-playas-t2-201-${periodStr(1)}`, uploadedByName: "Ana Sofía Romero", amount: CUOTA, status: "approved", fileName: "spei-mayo.pdf", uploadedOffsetDays: -33, reviewedOffsetDays: -32, reviewedByName: "Carolina Méndez" },
  { id: "receipt-playas-004", unitId: "t2-205", unitLabel: "T2-205", statementId: `bill-playas-t2-205-${periodStr(0)}`, uploadedByName: "Valentina Cruz Díaz", amount: CUOTA, status: "rejected", fileName: "captura-pantalla.jpg", uploadedOffsetDays: -3, reviewedOffsetDays: -2, reviewedByName: "Carolina Méndez", rejectedReason: "El comprobante no muestra el monto ni la fecha de la transferencia." },
  { id: "receipt-playas-005", unitId: "t1-105", unitLabel: "T1-105", statementId: `bill-playas-t1-105-${periodStr(2)}`, uploadedByName: "Andrés Villalobos Mena", amount: CUOTA, status: "approved", fileName: "deposito-abril.pdf", uploadedOffsetDays: -62, reviewedOffsetDays: -61, reviewedByName: "Carolina Méndez" },
];

// Cuenta bancaria del conjunto.
export const BANK_ACCOUNTS_PLAYAS = [
  { id: "bank-playas-001", label: "Cuenta operativa", bankName: "BBVA México", accountNumber: "****4821", accountType: "corriente", currency: "MXN", openingBalance: 85000, active: true },
];

// Egresos (gastos del conjunto) en 3 meses.
export const EXPENSES_PLAYAS = [
  { id: "exp-playas-001", category: "servicios_publicos", description: "CFE — energía áreas comunes (abr)", vendorName: "CFE", amount: 9800, issueOffsetDays: -70, dueOffsetDays: -55, paidOffsetDays: -58, status: "pagado", paymentMethod: "transferencia" },
  { id: "exp-playas-002", category: "servicios_publicos", description: "Agua potable (abr)", vendorName: "Aguakan", amount: 6400, issueOffsetDays: -68, dueOffsetDays: -53, paidOffsetDays: -54, status: "pagado", paymentMethod: "transferencia" },
  { id: "exp-playas-003", category: "nomina", description: "Nómina personal de portería (abr)", vendorName: "Servicios de Seguridad del Caribe", amount: 28000, issueOffsetDays: -65, dueOffsetDays: -60, paidOffsetDays: -60, status: "pagado", paymentMethod: "transferencia" },
  { id: "exp-playas-004", category: "mantenimiento", description: "Mantenimiento de alberca (abr)", vendorName: "AquaClean", amount: 4200, issueOffsetDays: -64, dueOffsetDays: -50, paidOffsetDays: -52, status: "pagado", paymentMethod: "efectivo" },
  { id: "exp-playas-005", category: "servicios_publicos", description: "CFE — energía áreas comunes (may)", vendorName: "CFE", amount: 10200, issueOffsetDays: -40, dueOffsetDays: -25, paidOffsetDays: -27, status: "pagado", paymentMethod: "transferencia" },
  { id: "exp-playas-006", category: "nomina", description: "Nómina personal de portería (may)", vendorName: "Servicios de Seguridad del Caribe", amount: 28000, issueOffsetDays: -35, dueOffsetDays: -30, paidOffsetDays: -30, status: "pagado", paymentMethod: "transferencia" },
  { id: "exp-playas-007", category: "mantenimiento", description: "Poda de jardines y áreas verdes (may)", vendorName: "Jardinería Tulum", amount: 5600, issueOffsetDays: -34, dueOffsetDays: -20, paidOffsetDays: -22, status: "pagado", paymentMethod: "transferencia" },
  { id: "exp-playas-008", category: "proveedores", description: "Insumos de limpieza (may)", vendorName: "Distribuidora Maya", amount: 3100, issueOffsetDays: -33, dueOffsetDays: -18, paidOffsetDays: -19, status: "pagado", paymentMethod: "efectivo" },
  { id: "exp-playas-009", category: "seguros", description: "Póliza de seguro del inmueble (trimestral)", vendorName: "GNP Seguros", amount: 14500, issueOffsetDays: -30, dueOffsetDays: -15, paidOffsetDays: -16, status: "pagado", paymentMethod: "transferencia" },
  { id: "exp-playas-010", category: "servicios_publicos", description: "CFE — energía áreas comunes (jun)", vendorName: "CFE", amount: 9950, issueOffsetDays: -10, dueOffsetDays: 5, status: "registrado", paymentMethod: "transferencia" },
  { id: "exp-playas-011", category: "nomina", description: "Nómina personal de portería (jun)", vendorName: "Servicios de Seguridad del Caribe", amount: 28000, issueOffsetDays: -6, dueOffsetDays: 0, paidOffsetDays: 0, status: "pagado", paymentMethod: "transferencia" },
  { id: "exp-playas-012", category: "mantenimiento", description: "Reparación de bomba hidroneumática", vendorName: "HidroServicios MX", amount: 7800, issueOffsetDays: -5, dueOffsetDays: 10, status: "registrado", paymentMethod: "transferencia" },
  { id: "exp-playas-013", category: "administracion", description: "Honorarios administración (jun)", vendorName: "Administradora Vivaru", amount: 12000, issueOffsetDays: -4, dueOffsetDays: 6, status: "registrado", paymentMethod: "transferencia" },
  { id: "exp-playas-014", category: "proveedores", description: "Recarga de extintores (anual)", vendorName: "Protección Total", amount: 3400, issueOffsetDays: -2, dueOffsetDays: 13, status: "registrado", paymentMethod: "transferencia" },
];

// Libro y fondos (ledgerEntries): ingresos por cuotas pagadas + egresos pagados.
function buildLedger() {
  const out = [];
  // Ingresos: una entrada por cada statement pagado.
  for (const b of BILLING_PLAYAS) {
    if (b.status === "paid") {
      out.push({
        id: `ledger-in-${b.id}`,
        type: "ingreso",
        date: b.lastPaymentAt ?? dueStr(0, 8),
        amount: b.amount,
        concept: `Pago ${b.concept} ${b.period} — ${b.unitLabel}`,
        category: b.concept === "administracion" ? "alicuota" : "extraordinaria",
        bankAccountId: "bank-playas-001",
        sourceType: "billingStatement",
        sourceId: b.id,
      });
    }
  }
  // Egresos: una entrada por cada gasto pagado.
  for (const e of EXPENSES_PLAYAS) {
    if (e.status === "pagado") {
      out.push({
        id: `ledger-out-${e.id}`,
        type: "egreso",
        date: dayStr(e.paidOffsetDays ?? e.issueOffsetDays),
        amount: e.amount,
        concept: e.description,
        category: e.category,
        bankAccountId: "bank-playas-001",
        sourceType: "expense",
        sourceId: e.id,
      });
    }
  }
  return out;
}
export const LEDGER_PLAYAS = buildLedger();

// Conciliación: líneas de extracto bancario (algunas conciliadas, otras pendientes).
function buildBankLines() {
  const out = [];
  let n = 1;
  // Conciliar algunos ingresos y egresos contra el ledger.
  for (const l of LEDGER_PLAYAS.slice(0, 20)) {
    const signed = l.type === "ingreso" ? l.amount : -l.amount;
    out.push({
      id: `bankline-playas-${String(n).padStart(3, "0")}`,
      bankAccountId: "bank-playas-001",
      date: l.date,
      description: l.type === "ingreso" ? `SPEI recibido — ${l.concept}`.slice(0, 80) : `Cargo — ${l.concept}`.slice(0, 80),
      amount: signed,
      reconciled: n % 3 !== 0,            // ~2/3 conciliadas, 1/3 pendientes
      matchedLedgerEntryId: n % 3 !== 0 ? l.id : null,
    });
    n++;
  }
  // Un par de líneas sin match (para que la conciliación tenga pendientes).
  out.push({ id: `bankline-playas-${String(n++).padStart(3, "0")}`, bankAccountId: "bank-playas-001", date: dayStr(-3), description: "Comisión bancaria mensual", amount: -180, reconciled: false, matchedLedgerEntryId: null });
  out.push({ id: `bankline-playas-${String(n++).padStart(3, "0")}`, bankAccountId: "bank-playas-001", date: dayStr(-2), description: "Depósito en efectivo (sin identificar)", amount: 3000, reconciled: false, matchedLedgerEntryId: null });
  return out;
}
export const BANK_LINES_PLAYAS = buildBankLines();

// ════════════════════════════════════════════════════════════════════════════════
//  OPERACIÓN (3 meses)
// ════════════════════════════════════════════════════════════════════════════════

// ── Visitantes (~45) ────────────────────────────────────────────────────────────
const VISITOR_NAMES = [
  "Laura Castillo", "DiDi Food", "Técnico de Internet", "Mariana Villalobos", "Uber Eats",
  "Carlos Mendoza", "Plomería Express", "Rappi", "Sofía Lema", "Limpieza a Domicilio",
  "Familia Romero", "Mensajería FedEx", "Diego Bravo", "Electricista 24h", "Amazon Flex",
  "Patricia Díaz", "Servicio de Gas", "Visitas Sánchez", "Cerrajería del Caribe", "Estilista a domicilio",
];
const VISITOR_CATS = ["familiar", "servicio", "familiar", "servicio", "servicio"];
function buildVisitors() {
  const out = [];
  let n = 1;
  // 40 visitas pasadas completadas, repartidas -90..-3.
  for (let i = 0; i < 40; i++) {
    const u = UNITS_PLAYAS[i % 12];
    const offset = -90 + Math.floor((i * 87) / 39); // -90..-3
    out.push({
      id: `visit-playas-${String(n).padStart(3, "0")}`,
      unitId: u.id, unitLabel: u.displayName, tower: u.tower, unit: unitNum[u.id],
      visitorName: VISITOR_NAMES[i % VISITOR_NAMES.length],
      documentNumber: `DOC${String(100000 + i * 17)}`,
      qrCodeValue: `QR-PLY-${n}`,
      hostResidentName: personName[u.id],
      visitorCategory: VISITOR_CATS[i % VISITOR_CATS.length],
      status: "completed",
      offsetDays: offset,
    });
    n++;
  }
  // Actividad de hoy/esta semana: dentro y programadas.
  const today = [
    ["t2-201", "Técnico de Internet", "servicio", "inside", 0],
    ["t1-105", "Mariana Villalobos", "familiar", "inside", 0],
    ["t2-203", "Visita Programada", "familiar", "scheduled", 0],
    ["t1-101", "Familia Castillo", "familiar", "scheduled", 1],
    ["t2-206", "Mudanza – Transportes del Caribe", "servicio", "scheduled", 2],
  ];
  for (const [slug, name, cat, status, off] of today) {
    out.push({
      id: `visit-playas-${String(n).padStart(3, "0")}`,
      unitId: slug, unitLabel: label(slug), tower: unitTower[slug], unit: unitNum[slug],
      visitorName: name, documentNumber: `DOC${String(200000 + n)}`, qrCodeValue: `QR-PLY-${n}`,
      hostResidentName: personName[slug], visitorCategory: cat, status, offsetDays: off,
    });
    n++;
  }
  return out;
}
export const VISITORS_PLAYAS = buildVisitors();

// ── Paquetería (~28) ────────────────────────────────────────────────────────────
const PKG_DESCS = [
  "Paquete Amazon", "Mercado Libre — sobre", "Farmacia del Ahorro", "Pedido Liverpool",
  "Caja Costco", "Documentos — DHL", "Shein", "Sears", "Office Depot", "Coppel",
];
function buildPackages() {
  const out = [];
  let n = 1;
  // 22 entregados pasados (-85..-5).
  for (let i = 0; i < 22; i++) {
    const u = UNITS_PLAYAS[i % 12];
    const arrived = -85 + Math.floor((i * 80) / 21); // -85..-5
    out.push({
      id: `pkg-playas-${String(n).padStart(3, "0")}`,
      unitId: u.id, unitLabel: u.displayName, recipientName: personName[u.id],
      reference: `PKG-PLY-${n}`, description: PKG_DESCS[i % PKG_DESCS.length],
      status: "delivered", arrivedOffsetDays: arrived, deliveredOffsetDays: arrived + 1,
      deliveredToName: personName[u.id],
    });
    n++;
  }
  // 6 pendientes (hoy / esta semana).
  const pend = ["t1-101", "t2-201", "t1-104", "t2-202", "t1-106", "t2-205"];
  pend.forEach((slug, i) => {
    out.push({
      id: `pkg-playas-${String(n).padStart(3, "0")}`,
      unitId: slug, unitLabel: label(slug), recipientName: personName[slug],
      reference: `PKG-PLY-${n}`, description: PKG_DESCS[(i + 3) % PKG_DESCS.length],
      status: "pending", arrivedOffsetDays: -1 * (i % 3),
    });
    n++;
  });
  return out;
}
export const PACKAGES_PLAYAS = buildPackages();

// ── Reservas (~16) ──────────────────────────────────────────────────────────────
function buildReservations() {
  const out = [];
  let n = 1;
  const statusesPast = ["approved", "approved", "cancelled", "approved"];
  // 12 pasadas.
  for (let i = 0; i < 12; i++) {
    const u = UNITS_PLAYAS[i % 12];
    out.push({
      id: `res-playas-${String(n).padStart(3, "0")}`,
      amenityName: AMENITY_NAMES[i % AMENITY_NAMES.length],
      unitId: u.id, unitLabel: u.displayName, reservedBy: personName[u.id],
      dateOffsetDays: -80 + Math.floor((i * 75) / 11), // -80..-5
      startTime: "16:00", endTime: "20:00",
      status: statusesPast[i % statusesPast.length],
      paymentConfirmed: statusesPast[i % statusesPast.length] === "approved",
    });
    n++;
  }
  // 4 próximas.
  const upcoming = [
    ["t1-101", "Salón de Usos Múltiples", 4, "approved", true, "18:00", "23:00"],
    ["t2-201", "Área de Asadores", 2, "pending", false, "13:00", "17:00"],
    ["t1-102", "Alberca", 6, "approved", true, "10:00", "13:00"],
    ["t2-203", "Coworking", 1, "pending", false, "09:00", "12:00"],
  ];
  for (const [slug, amenity, off, status, pay, st, et] of upcoming) {
    out.push({
      id: `res-playas-${String(n).padStart(3, "0")}`,
      amenityName: amenity, unitId: slug, unitLabel: label(slug), reservedBy: personName[slug],
      dateOffsetDays: off, startTime: st, endTime: et, status, paymentConfirmed: pay,
    });
    n++;
  }
  return out;
}
export const RESERVATIONS_PLAYAS = buildReservations();

// ── Comunicaciones (~12) ────────────────────────────────────────────────────────
export const COMMUNICATIONS_PLAYAS = [
  { id: "comm-playas-001", title: "Mantenimiento de la alberca — esta semana", message: "La alberca permanecerá cerrada el miércoles de 8:00 a.m. a 2:00 p.m. por mantenimiento y limpieza profunda.", status: "published", startsOffsetDays: -1, endsOffsetDays: 6, createdBy: DEMO_EMAIL },
  { id: "comm-playas-002", title: "Convocatoria a Asamblea Ordinaria", message: "Se convoca a todos los condóminos a la Asamblea Ordinaria. Fecha: próximo sábado, 10:00 a.m. en el Salón de Usos Múltiples. Temas: presupuesto anual y fondo de reserva.", status: "published", startsOffsetDays: -4, endsOffsetDays: 20, createdBy: DEMO_EMAIL },
  { id: "comm-playas-003", title: "Recordatorio: cuota de mantenimiento", message: "La cuota del mes vence el último día. Consulta tu estado de cuenta y sube tu comprobante desde el portal del residente.", status: "published", startsOffsetDays: -10, endsOffsetDays: 5, createdBy: DEMO_EMAIL },
  { id: "comm-playas-004", title: "Nuevas reglas de uso del gimnasio", message: "El gimnasio opera de 5:00 a.m. a 11:00 p.m. Obligatorio el uso de toalla y limpiar el equipo. Aforo máximo: 8 personas.", status: "published", startsOffsetDays: -22, endsOffsetDays: 35, createdBy: DEMO_EMAIL },
  { id: "comm-playas-005", title: "Fumigación de áreas comunes", message: "El próximo lunes se realizará fumigación en pasillos, sótano y áreas verdes de 7:00 a 10:00 a.m. Mantén ventanas cerradas.", status: "published", startsOffsetDays: -28, endsOffsetDays: -20, createdBy: DEMO_EMAIL },
  { id: "comm-playas-006", title: "Resultados de la encuesta de horario de alberca", message: "Gracias por participar. El horario ganador fue 8:00–22:00, que entra en vigor este mes. Revisa el reglamento actualizado.", status: "published", startsOffsetDays: -33, endsOffsetDays: -10, createdBy: DEMO_EMAIL },
  { id: "comm-playas-007", title: "Mantenimiento de elevadores Torre 2", message: "El jueves habrá mantenimiento preventivo del elevador de la Torre 2 de 9:00 a.m. a 1:00 p.m. Usa las escaleras durante ese lapso.", status: "published", startsOffsetDays: -41, endsOffsetDays: -33, createdBy: DEMO_EMAIL },
  { id: "comm-playas-008", title: "Campaña de reciclaje", message: "Iniciamos la separación de residuos. Encontrarás contenedores para PET, papel y vidrio en el área de basura de ambas torres.", status: "published", startsOffsetDays: -48, endsOffsetDays: 30, createdBy: DEMO_EMAIL },
  { id: "comm-playas-009", title: "Corte programado de agua", message: "Por trabajos de la red municipal, habrá corte de agua el sábado de 6:00 a.m. a 12:00 p.m. Te recomendamos almacenar agua.", status: "published", startsOffsetDays: -55, endsOffsetDays: -48, createdBy: DEMO_EMAIL },
  { id: "comm-playas-010", title: "Aviso de seguridad — visitantes", message: "Recuerda registrar a tus visitantes desde el portal. La portería solo permite el acceso a visitas autorizadas con código QR.", status: "published", startsOffsetDays: -62, endsOffsetDays: 60, createdBy: DEMO_EMAIL },
  { id: "comm-playas-011", title: "Actualización del directorio de residentes", message: "Estamos actualizando los datos de contacto. Verifica tu información en tu perfil y repórtanos cualquier cambio.", status: "published", startsOffsetDays: -75, endsOffsetDays: -60, createdBy: DEMO_EMAIL },
  { id: "comm-playas-012", title: "Bienvenida a la plataforma Vivaru", message: "¡Hola, comunidad! Ya puedes consultar tu estado de cuenta, autorizar visitas, reservar amenidades y enviar tus PQRS desde la app.", status: "published", startsOffsetDays: -88, endsOffsetDays: -70, createdBy: DEMO_EMAIL },
];

// ── PQRS (~14) ──────────────────────────────────────────────────────────────────
export const PQRS_PLAYAS = [
  { id: "pqrs-playas-001", unitId: "t1-103", unitLabel: "T1-103", category: "maintenance", type: "complaint", subject: "Fuga de agua en pasillo de Torre 1, piso 3", message: "Hay una fuga constante en el pasillo del piso 3 de la Torre 1. El agua se acumula y es un riesgo de resbalón. Solicito revisión urgente.", status: "open", priority: "high", radicationOffsetDays: -28, residentName: personName["t1-103"] },
  { id: "pqrs-playas-002", unitId: "t2-201", unitLabel: "T2-201", category: "pqrs", type: "petition", subject: "Instalación de bicicletero en área común", message: "Solicito evaluar la instalación de un bicicletero techado cerca de la entrada de la Torre 2.", status: "open", priority: "medium", radicationOffsetDays: -19, residentName: personName["t2-201"] },
  { id: "pqrs-playas-003", unitId: "t1-101", unitLabel: "T1-101", category: "pqrs", type: "complaint", subject: "Ruido excesivo en alberca tras horario permitido", message: "El fin de semana hubo reuniones en la alberca después de las 10 p.m. con música alta. Solicito reforzar la vigilancia.", status: "in_progress", priority: "medium", radicationOffsetDays: -8, residentName: personName["t1-101"] },
  { id: "pqrs-playas-004", unitId: "t2-203", unitLabel: "T2-203", category: "pqrs", type: "suggestion", subject: "Separar contenedores de reciclaje", message: "Propongo colocar contenedores separados para PET, papel y vidrio en el área de basura.", status: "resolved", priority: "low", radicationOffsetDays: -25, residentName: personName["t2-203"], response: "Gracias por la sugerencia. Se aprobaron tres contenedores separados; ya se instalaron en ambas torres.", respondedAt: -22 },
  { id: "pqrs-playas-005", unitId: "t1-102", unitLabel: "T1-102", category: "billing", type: "claim", subject: "Pago de mantenimiento no reflejado", message: "Pagué mi cuota por transferencia hace dos días y aún aparece pendiente. Adjunto el comprobante.", status: "in_progress", priority: "medium", radicationOffsetDays: -2, residentName: personName["t1-102"] },
  { id: "pqrs-playas-006", unitId: "t2-206", unitLabel: "T2-206", category: "maintenance", type: "petition", subject: "Lámpara fundida en estacionamiento nivel 1", message: "La lámpara del cajón 14 está fundida desde hace una semana; la zona queda muy oscura de noche.", status: "resolved", priority: "low", radicationOffsetDays: -14, residentName: personName["t2-206"], response: "Se reemplazó la luminaria del cajón 14. La zona ya cuenta con iluminación normal.", respondedAt: -11 },
  { id: "pqrs-playas-007", unitId: "t1-104", unitLabel: "T1-104", category: "maintenance", type: "complaint", subject: "Elevador Torre 1 se detiene entre pisos", message: "El elevador de la Torre 1 se detuvo dos veces esta semana entre pisos. Da inseguridad usarlo.", status: "resolved", priority: "high", radicationOffsetDays: -40, residentName: personName["t1-104"], response: "El proveedor realizó ajuste de sensores y prueba de carga. El elevador opera con normalidad.", respondedAt: -36 },
  { id: "pqrs-playas-008", unitId: "t2-202", unitLabel: "T2-202", category: "pqrs", type: "complaint", subject: "Mascotas sin correa en áreas comunes", message: "Algunos residentes pasean a sus mascotas sin correa en los jardines. Solicito recordar el reglamento.", status: "resolved", priority: "medium", radicationOffsetDays: -52, residentName: personName["t2-202"], response: "Se publicó un comunicado recordando el uso obligatorio de correa. Gracias por el reporte.", respondedAt: -49 },
  { id: "pqrs-playas-009", unitId: "t1-106", unitLabel: "T1-106", category: "billing", type: "petition", subject: "Solicitud de estado de cuenta del trimestre", message: "Quisiera recibir mi estado de cuenta detallado del último trimestre para mis registros.", status: "resolved", priority: "low", radicationOffsetDays: -30, residentName: personName["t1-106"], response: "Te enviamos el estado de cuenta del trimestre a tu correo y lo puedes ver en tu portal.", respondedAt: -28 },
  { id: "pqrs-playas-010", unitId: "t2-205", unitLabel: "T2-205", category: "maintenance", type: "claim", subject: "Filtración de agua de lluvia en bodega", message: "Tras las lluvias, mi bodega del sótano presenta filtración. Algunas cajas se mojaron.", status: "in_progress", priority: "high", radicationOffsetDays: -6, residentName: personName["t2-205"] },
  { id: "pqrs-playas-011", unitId: "t1-105", unitLabel: "T1-105", category: "pqrs", type: "suggestion", subject: "Más horarios para el coworking", message: "Sugiero ampliar el horario del coworking los fines de semana; muchos trabajamos desde casa.", status: "open", priority: "low", radicationOffsetDays: -12, residentName: personName["t1-105"] },
  { id: "pqrs-playas-012", unitId: "t2-204", unitLabel: "T2-204", category: "billing", type: "claim", subject: "Cobro de multa que desconozco", message: "Aparece una multa en mi estado de cuenta que no reconozco. Solicito el detalle del motivo.", status: "in_progress", priority: "medium", radicationOffsetDays: -4, residentName: personName["t2-204"] },
  { id: "pqrs-playas-013", unitId: "t1-101", unitLabel: "T1-101", category: "maintenance", type: "petition", subject: "Revisión de cámara de seguridad de la entrada", message: "La cámara de la entrada principal parece estar desenfocada. Solicito su revisión.", status: "resolved", priority: "medium", radicationOffsetDays: -60, residentName: personName["t1-101"], response: "Se reajustó y limpió la cámara de la entrada. La imagen ya es nítida.", respondedAt: -57 },
  { id: "pqrs-playas-014", unitId: "t2-203", unitLabel: "T2-203", category: "pqrs", type: "complaint", subject: "Estacionamiento de visitas ocupado por residentes", message: "Los cajones de visitas están siendo usados por residentes. Solicito control de la portería.", status: "resolved", priority: "medium", radicationOffsetDays: -45, residentName: personName["t2-203"], response: "Se reforzó el control de cajones de visita con la portería y se notificó a los residentes.", respondedAt: -42 },
];

// ── Encuestas + respuestas (resultados sólidos) ─────────────────────────────────
export const SURVEYS_PLAYAS = [
  {
    id: "survey-playas-001",
    title: "Satisfacción con la administración (trimestre)",
    description: "Queremos conocer tu opinión sobre la gestión del conjunto durante el último trimestre.",
    status: "published",
    minResponsesForResults: 3,
    createdBy: DEMO_EMAIL,
    createdOffsetDays: -6,
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
    createdBy: DEMO_EMAIL,
    createdOffsetDays: -35,
    closingOffsetDays: -5,
    questions: [
      { id: "q1", type: "single_choice", text: "¿Qué horario prefieres para la alberca?", options: ["7:00–21:00", "8:00–22:00", "6:00–20:00"], required: true },
    ],
  },
  {
    id: "survey-playas-003",
    title: "¿Aprobamos la compra de cámaras adicionales?",
    description: "Consulta a la comunidad sobre reforzar la seguridad con 4 cámaras nuevas.",
    status: "closed",
    minResponsesForResults: 3,
    createdBy: DEMO_EMAIL,
    createdOffsetDays: -55,
    closingOffsetDays: -40,
    questions: [
      { id: "q1", type: "single_choice", text: "¿Estás de acuerdo con la compra de 4 cámaras adicionales con cargo al fondo de reserva?", options: ["Sí", "No"], required: true },
    ],
  },
];

// Respuestas: la mayoría de unidades responden las encuestas cerradas (resultados sólidos).
function buildSurveyResponses() {
  const out = [];
  let n = 1;
  // Encuesta 002 (horario alberca): 10 unidades; gana "8:00–22:00".
  const horario = ["8:00–22:00", "7:00–21:00", "8:00–22:00", "8:00–22:00", "6:00–20:00", "8:00–22:00", "7:00–21:00", "8:00–22:00", "8:00–22:00", "6:00–20:00"];
  horario.forEach((val, i) => {
    const slug = SLUGS[i];
    out.push({ id: `sresp-playas-${String(n).padStart(3, "0")}`, surveyId: "survey-playas-002", respondentName: personName[slug], unitId: slug, answers: [{ questionId: "q1", value: val }], respondedOffsetDays: -30 + i });
    n++;
  });
  // Encuesta 003 (cámaras): 9 unidades; gana "Sí".
  const camaras = ["Sí", "Sí", "No", "Sí", "Sí", "Sí", "No", "Sí", "Sí"];
  camaras.forEach((val, i) => {
    const slug = SLUGS[i];
    out.push({ id: `sresp-playas-${String(n).padStart(3, "0")}`, surveyId: "survey-playas-003", respondentName: personName[slug], unitId: slug, answers: [{ questionId: "q1", value: val }], respondedOffsetDays: -50 + i });
    n++;
  });
  // Encuesta 001 (abierta): unas pocas respuestas tempranas.
  const sat = ["Muy satisfecho", "Satisfecho", "Neutral", "Satisfecho"];
  sat.forEach((val, i) => {
    const slug = SLUGS[i];
    out.push({ id: `sresp-playas-${String(n).padStart(3, "0")}`, surveyId: "survey-playas-001", respondentName: personName[slug], unitId: slug, answers: [{ questionId: "q1", value: val }, { questionId: "q2", value: AMENITY_NAMES[i % AMENITY_NAMES.length] }], respondedOffsetDays: -4 + i });
    n++;
  });
  return out;
}
export const SURVEY_RESPONSES_PLAYAS = buildSurveyResponses();
// responseCount por encuesta (para que los resultados se muestren).
export const SURVEY_RESPONSE_COUNTS_PLAYAS = SURVEY_RESPONSES_PLAYAS.reduce((acc, r) => {
  acc[r.surveyId] = (acc[r.surveyId] ?? 0) + 1;
  return acc;
}, {});

// ── Acuerdos de comité ──────────────────────────────────────────────────────────
export const AGREEMENTS_PLAYAS = [
  { id: "agreement-playas-001", title: "Acta de asamblea: aprobación de presupuesto anual", sessionOffsetDays: -15, signatureMode: "obligatoria", signerScope: "all", status: "enviado", createdBy: DEMO_EMAIL, signedUnitIds: ["t1-101", "t1-102", "t2-201", "t1-105", "t2-203", "t1-106"] },
  { id: "agreement-playas-002", title: "Comunicado del comité: lineamientos de mascotas", sessionOffsetDays: -35, signatureMode: "informativo", signerScope: "all", status: "enviado", createdBy: DEMO_EMAIL, signedUnitIds: [] },
  { id: "agreement-playas-003", title: "Acuerdo: reglamento de uso de amenidades", sessionOffsetDays: -55, signatureMode: "obligatoria", signerScope: "all", status: "cerrado", createdBy: DEMO_EMAIL, signedUnitIds: SLUGS },
];
