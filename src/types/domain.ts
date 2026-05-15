import type { AppRole } from "@/lib/constants/roles";
import type { AppCurrency } from "@/lib/currency";

export type TenantStatus = "trial" | "active" | "suspended";

export interface Tenant {
  id: string;
  name: string;
  nit?: string;
  city: string;
  status: TenantStatus;
  planId: string;
  onboardingStatus: "not_started" | "in_progress" | "completed";
  currency?: AppCurrency;
  branding: {
    logoUrl?: string;
    primaryColor: string;
    accentColor: string;
  };
  createdAt: string;
  updatedAt: string;
}

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
  type: "package" | "communication" | "reservation" | "visitor" | "ticket" | "system";
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
  scheduledTime: string;
  status: "scheduled" | "inside" | "completed";
  checkInAt?: string;
  checkOutAt?: string;
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
  }>;
}

export interface BillingStatement {
  id: string;
  tenantId: string;
  unitId: string;
  unitLabel: string;
  period: string;
  amount?: number;
  paymentAmount?: number;
  balance: number;
  dueDate?: string;
  status: "pending" | "paid" | "overdue";
  lastPaymentAt?: string;
  createdBy?: string;
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
