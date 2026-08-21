import type { AppRole } from "@/lib/constants/roles";
import type { AppCurrency } from "@/lib/currency";

/**
 * Estado del ambiente habitacional.
 * - `trial`: prueba de 15 días, opera con módulos acotados.
 * - `active`: cliente. - `suspended`: dejó de pagar. - `expired`: prueba vencida.
 *
 * `suspended` y `expired` quedan en SOLO LECTURA (ver `assertTenantOperable` en
 * functions y `tenantOperable()` en firestore.rules).
 */
export type TenantStatus = "trial" | "active" | "suspended" | "expired";

/** Estados en los que el ambiente puede escribir. */
export const WRITABLE_TENANT_STATUSES: readonly TenantStatus[] = ["trial", "active"];

export function isTenantWritable(status: TenantStatus | undefined | null): boolean {
  if (!status) return true; // datos previos al campo
  return WRITABLE_TENANT_STATUSES.includes(status);
}

export interface Tenant {
  id: string;
  name: string;
  nit?: string;
  city: string;
  status: TenantStatus;
  planId: string;
  onboardingStatus: "not_started" | "in_progress" | "completed";
  /**
   * País del conjunto, ISO-3166-1 alpha-2. Gobierna la moneda y la tarifa.
   *
   * **La moneda no basta para identificarlo:** Panamá y Ecuador comparten USD y
   * tienen precios distintos (USD 3,77 contra 3,15 por unidad). Ojo: esto NO es
   * `FiscalProfile.country`, que es dónde factura y puede diferir.
   */
  country?: string;
  currency?: AppCurrency;
  branding: {
    logoUrl?: string;
    primaryColor: string;
    accentColor: string;
  };
  // ── Ciclo de vida del trial (ver docs/plan-self-service-trial.md) ──────────
  /** Inicio de la prueba (ISO). */
  trialStartedAt?: string;
  /** Fin de la prueba (ISO). La fecha que gobierna vencimiento y avisos. */
  trialEndsAt?: string;
  /** Lead que originó el ambiente, para atribuir el origen comercial. */
  leadId?: string;
  /** Sello de conversión a cliente: se llenan al pasar de trial/expired a active. */
  convertedAt?: string;
  convertedBy?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Override editable de una notificación. Cualquier campo vacío usa el default del
 * catálogo. Se persiste en tenantSettings/{tenantId}.notificationTemplates (mapa
 * por clave de notificación).
 */
export interface NotificationTemplateOverride {
  title?: string;
  body?: string;
  emailSubject?: string;
  emailBody?: string;
  emailEnabled?: boolean;
}

/** Mapa por clave de notificación (ver catálogo) → override del tenant. */
export type NotificationTemplates = Record<string, NotificationTemplateOverride>;

export interface SessionUser {
  uid: string;
  email: string;
  fullName: string;
  photoURL?: string;
  avatarId?: string;
  role: AppRole;
  tenantId?: string;
  tenantName?: string;
  unitId?: string;
  unitLabel?: string;
  documentNumber?: string;
  mustChangePassword?: boolean;
  temporaryPassword?: boolean;
  passwordStatus?: "temporary" | "updated";
  status: "active" | "inactive";
}

export interface UserNotification {
  id: string;
  userId: string;
  tenantId?: string;
  type: "package" | "communication" | "reservation" | "visitor" | "ticket" | "system" | "billing" | "regulation" | "survey";
  title: string;
  description: string;
  read: boolean;
  createdAt?: string;
  link?: string;
}

export interface Communication {
  id: string;
  tenantId: string;
  title: string;
  body: string;
  audience: "all" | "owners" | "tenants";
  publishedAt: string;
  authorName: string;
}

export interface Reservation {
  id: string;
  tenantId: string;
  unitId: string;
  amenityId?: string;
  amenity: string;
  unitLabel: string;
  date: string;
  startTime?: string;
  endTime?: string;
  slot?: string;
  exclusiveUse?: boolean;
  /**
   * Discriminator. `amenity` (default) for common-area bookings; `mudanza`
   * for moving requests, which carry additional metadata in `mudanza`.
   */
  kind?: "amenity" | "mudanza";
  mudanza?: {
    requiresElevator?: boolean;
    depositPaid?: boolean;
    depositAmount?: number;
    receiptUrl?: string;
    receiptName?: string;
    additionalNotes?: string;
  };
  status: "pending" | "approved" | "rejected" | "cancelled";
  cancelledAt?: string;
  cancellationReason?: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  createdByName?: string;
  residentName?: string;
}

export interface Ticket {
  id: string;
  tenantId: string;
  unitId: string;
  unitLabel: string;
  category: "pqrs" | "maintenance" | "billing";
  type?: "petition" | "complaint" | "claim" | "suggestion" | "other";
  radicado?: string;
  subject: string;
  message?: string;
  status: "open" | "in_progress" | "resolved" | "responded" | "closed";
  priority?: "low" | "medium" | "high";
  radicationDate?: string;
  /** Fecha canónica del evento (YYYY-MM-DD) para reportes/consultas por rango. Ver utils/event-date.ts */
  eventDate?: string;
  createdAt?: string;
  updatedAt: string;
  residentId?: string;
  residentName?: string;
  tower?: string;
  response?: string;
  respondedAt?: string;
  respondedBy?: string;
  respondedByName?: string;
  attachmentUrl?: string;
  attachmentName?: string;
  attachments?: Array<{
    name?: string;
    url: string;
  }>;
  responseHistory?: Array<{
    id: string;
    message: string;
    status: string;
    createdAt: string;
    createdBy: string;
    createdByName?: string;
  }>;
  createdBy?: string;
}

export interface PackageItem {
  id: string;
  tenantId: string;
  unitId: string;
  unitLabel: string;
  reference: string;
  towerId?: string;
  residentId?: string;
  residentName?: string;
  recipientName?: string;
  tower?: string;
  unit?: string;
  description?: string;
  receivedByGuardId?: string;
  receivedByGuardName?: string;
  status: "pending" | "delivered";
  arrivedAt: string;
  registeredBy?: string;
  registeredByName?: string;
  createdBy?: string;
  receivedBy?: string;
  deliveredToId?: string;
  deliveredToName?: string;
  deliveredBy?: string;
  receivedAt?: string;
  deliveredAt?: string;
}

export interface VisitorPass {
  id: string;
  tenantId: string;
  unitId: string;
  unitLabel: string;
  visitorName: string;
  documentNumber: string;
  qrCodeValue: string;
  hostResidentName: string;
  tower: string;
  unit: string;
  date: string;
  /** Fecha canónica del evento (YYYY-MM-DD) para reportes/consultas por rango. Ver utils/event-date.ts */
  eventDate?: string;
  scheduledTime: string;
  status: "scheduled" | "inside" | "completed";
  /** Tipo de autorización de origen (puntual = un día; larga_duracion = ventana). */
  authorizationType?: "puntual" | "larga_duracion";
  /** Ventana de vigencia (YYYY-MM-DD). validUntil ausente ⇒ se asume `date`. */
  validFrom?: string;
  validUntil?: string;
  checkInAt?: string;
  checkOutAt?: string;
  /** True si la visita fue registrada por portería en modo registro simple (sin QR). */
  registeredByGuard?: boolean;
  // Legacy compatibility fields for existing records not yet migrated.
  visitDate?: string;
  residentName?: string;
  createdBy?: string;
  createdByName?: string;
  guardNotes?: Array<{
    text: string;
    createdAt: string;   // ISO string, normalizado desde Firestore Timestamp
    guardId: string;
    guardName?: string;
    /** Imagen adjunta a la nota (sube el guardia; visible para el admin). */
    imageUrl?: string;
    storagePath?: string;
  }>;
}

export type BillingConcept =
  | "administracion"
  | "extraordinaria"
  | "multa"
  | "reparacion"
  | "interes_mora"
  | "parqueadero"
  | "otro";

export interface BillingStatement {
  id: string;
  tenantId: string;
  unitId: string;
  unitLabel: string;
  period: string;
  /** Concepto del cobro (default: administración). */
  concept?: BillingConcept;
  /** Liga el cobro a una campaña (lote). null/ausente = cobro individual. */
  campaignId?: string | null;
  amount?: number;
  paymentAmount?: number;
  balance: number;
  dueDate?: string;
  status: "pending" | "paid" | "overdue";
  lastPaymentAt?: string;
  /** Nº de recordatorios enviados (trazabilidad CRM, C2). */
  reminderCount?: number;
  /** Período cerrado/archivado: fuera de la tabla viva del admin (C4a). No borra datos. */
  archived?: boolean;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
}

/** Campaña de cobro = una corrida de lote (inmediata o programada al publicarse). */
export interface BillingCampaign {
  id: string;
  tenantId: string;
  concept?: BillingConcept;
  period: string;
  unitAmount: number;
  dueDate?: string | null;
  source: "immediate" | "scheduled";
  unitCount: number;
  sentAt?: string;
  status: "vigente" | "cerrada";
  createdBy?: string;
}

export interface PaymentReceipt {
  id: string;
  tenantId: string;
  unitId: string;
  uploadedBy: string;
  uploadedAt: string;
  fileUrl: string;
  fileName: string;
  storagePath: string;
  /** Lifecycle: pending → approved | rejected */
  status: "pending" | "approved" | "rejected";
  /** Links this receipt to a specific billing period */
  statementId?: string;
  /** Monto declarado por el residente al subir el comprobante */
  amount?: number;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewedByName?: string;
  /** Reason given by admin when status is "rejected" */
  rejectedReason?: string;
}

export interface TenantDocument {
  id: string;
  tenantId: string;
  title: string;
  category: "reglamento" | "acta" | "circular";
  audience: "all" | "admins";
  uploadedAt: string;
  url?: string;
  createdBy?: string;
}

// ─────────────────────────────────────────────────────────────
// Finanzas — core contable de propiedad horizontal (F1)
// Diseñado para EC/CO/MX: el core es común; la capa fiscal por país
// se resuelve con un ComprobanteFiscalProvider (ver features/finanzas).
// ─────────────────────────────────────────────────────────────

/** País del conjunto; define el provider fiscal del comprobante. */
export type FiscalCountry = "EC" | "CO" | "MX";

/**
 * Perfil fiscal del conjunto, usado para emitir comprobantes/recibos.
 * Persistido dentro del documento de tenantSettings.
 */
export interface FiscalProfile {
  /** RUC (EC) / NIT (CO) / RFC (MX) del conjunto. */
  taxId?: string;
  legalName?: string;
  address?: string;
  country?: FiscalCountry;
  /** Prefijo/serie del secuencial de comprobantes, ej. "001-001". */
  voucherSeriesPrefix?: string;
  /**
   * Meses tras los cuales se anonimizan los datos sensibles (cédula, nombre)
   * de los comprobantes ya transmitidos. La conservación legal recae en el
   * contribuyente, no en la plataforma. Default 12 si no se define.
   */
  dataRetentionMonths?: number;
}

export type ExpenseCategory =
  | "nomina"
  | "servicios_publicos"
  | "mantenimiento"
  | "proveedores"
  | "administracion"
  | "seguros"
  | "impuestos"
  | "otros";

export type PaymentMethod = "transferencia" | "cheque" | "efectivo" | "otro";

export type ExpenseStatus = "registrado" | "pagado" | "anulado";

/** Egreso / cuenta por pagar del conjunto. */
export interface Expense {
  id: string;
  tenantId: string;
  category: ExpenseCategory;
  description: string;
  vendorName?: string;
  vendorTaxId?: string;
  amount: number;
  /** Fecha de causación / emisión del egreso (YYYY-MM-DD). */
  issueDate: string;
  /** Vencimiento para cuentas por pagar (YYYY-MM-DD). */
  dueDate?: string;
  status: ExpenseStatus;
  paymentMethod?: PaymentMethod;
  /** Número de cheque cuando paymentMethod === "cheque". */
  checkNumber?: string;
  bankAccountId?: string;
  paidAt?: string;
  /** Documento de soporte (factura del proveedor) en Storage. */
  supportFileUrl?: string;
  supportFileName?: string;
  supportStoragePath?: string;
  /** Movimiento de libro generado al pagar el egreso. */
  ledgerEntryId?: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface BankAccount {
  id: string;
  tenantId: string;
  label: string;
  bankName: string;
  /** Número de cuenta (puede guardarse enmascarado). */
  accountNumber?: string;
  accountType?: "corriente" | "ahorros";
  currency?: AppCurrency;
  /** Saldo inicial registrado al dar de alta la cuenta. */
  openingBalance?: number;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
}

export type LedgerEntryType = "ingreso" | "egreso";

export type LedgerCategory =
  | ExpenseCategory
  | "alicuota"
  | "extraordinaria"
  | "interes_mora"
  | "arriendo"
  | "otros_ingresos";

/** Movimiento del libro de ingresos/egresos. Backbone contable + conciliación. */
export interface LedgerEntry {
  /**
   * `FIN-001`. Clave de la operación que creó este asiento, presente solo en los
   * de `sourceType: "billingStatement"`. Es lo que permite revertir el pago
   * entero —cuota, asiento y comprobante— desde la fila del libro. Los asientos
   * anteriores a FIN-001 no la tienen y **no se pueden revertir por esa vía**.
   */
  operationKey?: string;
  id: string;
  tenantId: string;
  type: LedgerEntryType;
  /** Fecha contable del movimiento (YYYY-MM-DD). */
  date: string;
  amount: number;
  concept: string;
  category?: LedgerCategory;
  bankAccountId?: string;
  /** Referencia al origen del movimiento. "reversal" = asiento inverso de otro movimiento. */
  sourceType?: "billingStatement" | "expense" | "manual" | "reversal";
  sourceId?: string;
  /** Id del asiento inverso que anuló este movimiento (los asientos contables no se borran). */
  reversedByEntryId?: string;
  /** Conciliación bancaria. */
  reconciled?: boolean;
  reconciledAt?: string;
  bankStatementLineId?: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
}

export type VoucherType = "ingreso" | "egreso";

/**
 * Recibo emitido por Vivaru al registrar un pago. **No es un documento fiscal**
 * (decisión de David, 20 de agosto de 2026): la factura la emite el cliente.
 */
export interface PaymentVoucher {
  id: string;
  tenantId: string;
  type: VoucherType;
  /**
   * Identificador legible, ej. `REC-A7F3K2`. **No es correlativo**: se deriva del
   * id del documento. Hasta el 20 de agosto de 2026 era un secuencial con
   * contador, porque una serie fiscal no admite huecos; al dejar de ser fiscal,
   * el contador solo aportaba contención —serializaba todos los pagos de un
   * conjunto sobre un único documento—.
   */
  code: string;
  /**
   * Secuencial de los recibos emitidos ANTES del 20 de agosto de 2026, cuando el
   * recibo era un documento fiscal. **No se escribe nunca más**, pero se lee:
   * los que ya existen no se migran, porque cambiarle el número a un papel que
   * alguien descargó es peor que soportar dos formas. Ver `codigoDeRecibo`.
   */
  sequentialNumber?: string;
  issueDate: string;
  amount: number;
  concept: string;
  /** Datos del pagador (residente) — para comprobante de alícuota. */
  payerName?: string;
  payerTaxId?: string;
  payerUnitId?: string;
  payerUnitLabel?: string;
  /** Snapshot de los datos fiscales del emisor al momento de emitir. */
  issuerTaxId?: string;
  issuerLegalName?: string;
  issuerAddress?: string;
  issuerCountry?: FiscalCountry;
  sourceType?: "billingStatement" | "expense" | "manual";
  sourceId?: string;
  ledgerEntryId?: string;
  /** Clave de la operación de pago que lo emitió. El puente con el reverso. */
  operationKey?: string;
  /**
   * Anulado al revertir su pago. Sustituye a la nota de crédito, que era un
   * instrumento fiscal y por tanto una tarea manual que nadie perseguía.
   */
  anulado?: boolean;
  anuladoEn?: string;
  anuladoPor?: string;
  anuladoMotivo?: string;
  /** PDF generado en Storage (si aplica). */
  pdfUrl?: string;
  pdfStoragePath?: string;
  /** Fecha en que se anonimizaron los datos sensibles (retención, F2/G4). */
  anonymizedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
}

/** Línea de extracto bancario importada para conciliación. */
export interface BankStatementLine {
  id: string;
  tenantId: string;
  bankAccountId: string;
  date: string;
  description: string;
  /** Positivo = crédito/ingreso; negativo = débito/egreso. */
  amount: number;
  /** Conciliación: enlazado a un ledgerEntry. */
  matchedLedgerEntryId?: string;
  reconciled: boolean;
  /** Lote de importación (para revertir una carga). */
  importBatchId?: string;
  createdAt?: string;
  createdBy?: string;
}
