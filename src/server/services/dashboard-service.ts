import { getSuperadminMetrics, getTenantMetrics } from "@/server/repositories/dashboard-repository";

export function superadminDashboardService() {
  return getSuperadminMetrics();
}

export function tenantDashboardService(tenantId: string) {
  return getTenantMetrics(tenantId);
}
