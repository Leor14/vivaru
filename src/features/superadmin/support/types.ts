import type { Timestamp } from "firebase/firestore";

export interface SupportTicket {
  id: string;
  tenantId: string;
  tenantName: string;
  reportedBy: string;
  reportedByName?: string;
  category: "technical" | "billing" | "operational" | "other";
  subject: string;
  description: string;
  priority: "high" | "medium" | "low";
  status: "open" | "in_progress" | "resolved";
  createdAt: Timestamp;
  updatedAt: Timestamp;
  resolvedAt?: Timestamp;
  createdBy: string;
  notes?: string;
  responseHistory?: Array<{
    id: string;
    message: string;
    createdAt: string;
    createdBy: string;
    createdByName?: string;
  }>;
}

export const SUPPORT_CATEGORIES = {
  technical: "Técnico",
  billing: "Facturación",
  operational: "Operativo",
  other: "Otro",
} as const;

export const SUPPORT_STATUSES = {
  open: "Abierto",
  in_progress: "En progreso",
  resolved: "Resuelto",
} as const;

export const SUPPORT_PRIORITIES = {
  high: "Alta",
  medium: "Media",
  low: "Baja",
} as const;
