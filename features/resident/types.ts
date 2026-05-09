export type UnitChangeRequestStatus = "pending" | "approved" | "rejected";

export interface UnitChangeRequest {
  id: string;
  tenantId: string;
  userId: string;
  currentUnitId: string;
  requestedUnitId: string;
  currentUnitDisplay: string;
  requestedUnitDisplay: string;
  reason?: string;
  status: UnitChangeRequestStatus;
  createdAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
}
