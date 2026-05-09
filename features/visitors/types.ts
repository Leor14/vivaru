// Modelo de invitación de visitante para flujo residente
// FASE 1 — visitor invitation model

export type VisitorInvitationStatus =
  | 'active'
  | 'cancelled'
  | 'expired'
  | 'used_up';

export interface VisitorInvitation {
  id: string;
  tenantId: string;
  unitId: string;
  residentUserId: string;
  authorizedByName: string;
  visitorName: string;
  visitorIdentification: string;
  plate?: string;
  visitReason: string;
  adultsCount: number;
  childrenCount: number;
  allowedUses: number;
  startAt: Date; // O Timestamp si usas Firestore Timestamp
  endAt: Date;
  status: VisitorInvitationStatus;
  qrToken: string;
  invitationCode: string;
  createdAt: Date;
  updatedAt: Date;
  cancelledAt?: Date;
}
