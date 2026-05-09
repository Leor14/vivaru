import type {
  BillingStatement,
  Communication,
  PackageItem,
  Reservation,
  SessionUser,
  Tenant,
  TenantDocument,
  Ticket,
  VisitorPass,
} from "@/types/domain";

export const demoTenants: Tenant[] = [
  {
    id: "tenant-santa-maria",
    name: "Conjunto Residencial Santa Maria",
    city: "Bogota",
    status: "active",
    planId: "plus",
    onboardingStatus: "completed",
    branding: { primaryColor: "#0b3c5d", accentColor: "#f39c12" },
    createdAt: "2026-02-01T08:00:00.000Z",
    updatedAt: "2026-03-05T08:00:00.000Z",
  },
  {
    id: "tenant-altos-del-lago",
    name: "Edificio Altos del Lago",
    city: "Medellin",
    status: "trial",
    planId: "starter",
    onboardingStatus: "in_progress",
    branding: { primaryColor: "#124559", accentColor: "#f0a202" },
    createdAt: "2026-02-20T08:00:00.000Z",
    updatedAt: "2026-03-03T08:00:00.000Z",
  },
];

export const demoUsers: Array<SessionUser & { password: string }> = [
  {
    uid: "usr-superadmin-1",
    email: "superadmin@hogaru.co",
    fullName: "Paula Sierra",
    role: "superadmin",
    status: "active",
    password: "Demo1234*",
  },
  {
    uid: "usr-admin-1",
    email: "admin@santamaria.co",
    fullName: "Carlos Ramirez",
    role: "tenant_admin",
    tenantId: "tenant-santa-maria",
    tenantName: "Conjunto Residencial Santa Maria",
    status: "active",
    password: "Demo1234*",
  },
  {
    uid: "usr-resident-1",
    email: "residente@santamaria.co",
    fullName: "Ana Lucia Perez",
    role: "resident",
    tenantId: "tenant-santa-maria",
    tenantName: "Conjunto Residencial Santa Maria",
    unitId: "unit-t2-503",
    unitLabel: "T2-503",
    status: "active",
    password: "Demo1234*",
  },
];

export const demoCommunications: Communication[] = [
  {
    id: "com-1",
    tenantId: "tenant-santa-maria",
    title: "Mantenimiento de ascensores",
    body: "El martes 12 de marzo se realizara mantenimiento preventivo entre 9:00 a.m. y 1:00 p.m.",
    audience: "all",
    publishedAt: "2026-03-07T10:00:00.000Z",
    authorName: "Administración",
  },
  {
    id: "com-2",
    tenantId: "tenant-santa-maria",
    title: "Recordatorio cuota de administración",
    body: "Recuerda pagar antes del 15 para evitar intereses de mora.",
    audience: "all",
    publishedAt: "2026-03-08T12:00:00.000Z",
    authorName: "Cartera",
  },
];

export const demoReservations: Reservation[] = [
  {
    id: "res-1",
    tenantId: "tenant-santa-maria",
    unitId: "unit-t2-503",
    amenity: "Salon social",
    unitLabel: "T2-503",
    date: "2026-03-15",
    slot: "6:00 p.m. - 10:00 p.m.",
    status: "approved",
    createdBy: "usr-resident-1",
  },
  {
    id: "res-2",
    tenantId: "tenant-santa-maria",
    unitId: "unit-t1-204",
    amenity: "BBQ",
    unitLabel: "T1-204",
    date: "2026-03-17",
    slot: "12:00 p.m. - 3:00 p.m.",
    status: "pending",
    createdBy: "usr-admin-1",
  },
];

export const demoTickets: Ticket[] = [
  {
    id: "tic-1",
    tenantId: "tenant-santa-maria",
    unitId: "unit-t2-503",
    unitLabel: "T2-503",
    category: "pqrs",
    subject: "Ruido en torre 1 en horarios nocturnos",
    status: "in_progress",
    updatedAt: "2026-03-08T20:00:00.000Z",
    createdBy: "usr-resident-1",
  },
  {
    id: "tic-2",
    tenantId: "tenant-santa-maria",
    unitId: "unit-t1-204",
    unitLabel: "T1-204",
    category: "maintenance",
    subject: "Fuga en shut de basuras",
    status: "open",
    updatedAt: "2026-03-07T14:00:00.000Z",
    createdBy: "usr-admin-1",
  },
];

export const demoPackages: PackageItem[] = [
  {
    id: "pkg-1",
    tenantId: "tenant-santa-maria",
    unitId: "unit-t2-503",
    unitLabel: "T2-503",
    reference: "PK-1001",
    status: "pending",
    arrivedAt: "2026-03-08T08:15:00.000Z",
  },
  {
    id: "pkg-2",
    tenantId: "tenant-santa-maria",
    unitId: "unit-t1-204",
    unitLabel: "T1-204",
    reference: "PK-1002",
    status: "delivered",
    arrivedAt: "2026-03-07T16:40:00.000Z",
  },
];

export const demoVisitorPasses: VisitorPass[] = [
  {
    id: "vis-1",
    tenantId: "tenant-santa-maria",
    unitId: "unit-t2-503",
    unitLabel: "T2-503",
    visitorName: "Maria Rojas",
    documentNumber: "1023344556",
    qrCodeValue: "QR-8ZKD31",
    hostResidentName: "Laura Gomez",
    tower: "T2",
    unit: "503",
    date: "2026-03-11",
    scheduledTime: "2026-03-11T10:30:00.000Z",
    status: "scheduled",
    createdBy: "usr-resident-1",
  },
  {
    id: "vis-2",
    tenantId: "tenant-santa-maria",
    unitId: "unit-t1-204",
    unitLabel: "T1-204",
    visitorName: "Servicio tecnico Claro",
    documentNumber: "900443221",
    qrCodeValue: "QR-2QJ58B",
    hostResidentName: "Carlos Torres",
    tower: "T1",
    unit: "204",
    date: "2026-03-12",
    scheduledTime: "2026-03-12T15:00:00.000Z",
    status: "inside",
    checkInAt: "2026-03-12T15:02:00.000Z",
    createdBy: "usr-admin-1",
  },
];

export const demoBillingStatements: BillingStatement[] = [
  {
    id: "bill-1",
    tenantId: "tenant-santa-maria",
    unitId: "unit-t2-503",
    unitLabel: "T2-503",
    period: "2026-03",
    balance: 1120000,
    status: "pending",
    lastPaymentAt: "2026-02-10",
    createdBy: "usr-admin-1",
  },
  {
    id: "bill-2",
    tenantId: "tenant-santa-maria",
    unitId: "unit-t1-204",
    unitLabel: "T1-204",
    period: "2026-03",
    balance: 0,
    status: "paid",
    lastPaymentAt: "2026-03-02",
    createdBy: "usr-admin-1",
  },
];

export const demoTenantDocuments: TenantDocument[] = [
  {
    id: "doc-1",
    tenantId: "tenant-santa-maria",
    title: "Reglamento de propiedad horizontal.pdf",
    category: "reglamento",
    audience: "all",
    uploadedAt: "2026-02-05T10:00:00.000Z",
    createdBy: "usr-admin-1",
  },
  {
    id: "doc-2",
    tenantId: "tenant-santa-maria",
    title: "Acta asamblea ordinaria 2025.pdf",
    category: "acta",
    audience: "all",
    uploadedAt: "2026-01-29T14:20:00.000Z",
    createdBy: "usr-admin-1",
  },
];
