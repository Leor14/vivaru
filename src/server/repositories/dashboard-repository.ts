import { demoCommunications, demoReservations, demoTenants, demoTickets } from "@/lib/demo/data";

export function getSuperadminMetrics() {
  return {
    totalTenants: demoTenants.length,
    activeTenants: demoTenants.filter((tenant) => tenant.status === "active").length,
    trialTenants: demoTenants.filter((tenant) => tenant.status === "trial").length,
    suspendedTenants: demoTenants.filter((tenant) => tenant.status === "suspended").length,
    totalReservations: demoReservations.length,
    openTickets: demoTickets.filter((ticket) => ticket.status !== "resolved").length,
  };
}

export function getTenantMetrics(tenantId: string) {
  return {
    communications: demoCommunications.filter((item) => item.tenantId === tenantId).length,
    reservationsToday: demoReservations.filter((item) => item.tenantId === tenantId).length,
    openTickets: demoTickets.filter((item) => item.tenantId === tenantId && item.status !== "resolved").length,
    pendingPackages: 8,
    pendingVisitors: 5,
    monthlyCollection: "$94.200.000",
  };
}
