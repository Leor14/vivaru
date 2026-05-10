export interface TenantAdoptionMetrics {
  tenantId: string;
  tenantName: string;
  status: "trial" | "active" | "suspended";
  planId?: string;
  units: number;
  activeResidents: number;
  openTickets: number;
  ticketsLast30d: number;
  visitsLast30d: number;
  billingsLast30d: number;
  packagesLast30d: number;
  adoptionScore: number;
  adoptionLevel: "high" | "medium" | "low";
  fetchedAt: Date;
}

export interface GlobalAdoptionSummary {
  totalTenants: number;
  activeTenants: number;
  totalOpenTickets: number;
  highAdoptionCount: number;
}
