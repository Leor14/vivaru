import {
  collection,
  getDocs,
  query,
  where,
  type DocumentData,
} from "firebase/firestore";

import { db } from "@/lib/firebase/client";
import type { TenantAdoptionMetrics } from "./types";

function assertDb() {
  if (!db) throw new Error("Firebase no está configurado en este entorno.");
  return db;
}

async function fetchTenantMetrics(
  tenantId: string,
  tenantData: DocumentData,
): Promise<TenantAdoptionMetrics> {
  const firestore = assertDb();

  const now = Date.now();
  const iso30d = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
  const date30d = iso30d.slice(0, 10); // "YYYY-MM-DD"
  const period30d = iso30d.slice(0, 7); // "YYYY-MM"

  const [
    unitsSnap,
    activeResidentsSnap,
    openTicketsSnap,
    tickets30dSnap,
    visits30dSnap,
    billings30dSnap,
    packages30dSnap,
  ] = await Promise.all([
    // q1: units by tenant
    getDocs(query(collection(firestore, "units"), where("tenantId", "==", tenantId))),

    // q2: active people (residents)
    getDocs(
      query(
        collection(firestore, "people"),
        where("tenantId", "==", tenantId),
        where("status", "==", "active"),
      ),
    ),

    // q3: open tickets (not resolved/closed)
    getDocs(
      query(
        collection(firestore, "tickets"),
        where("tenantId", "==", tenantId),
        where("status", "in", ["open", "in_progress", "responded"]),
      ),
    ),

    // q4: tickets updated in last 30d (updatedAt >= iso30d)
    getDocs(
      query(
        collection(firestore, "tickets"),
        where("tenantId", "==", tenantId),
        where("updatedAt", ">=", iso30d),
      ),
    ),

    // q5: visitor passes with date >= date30d
    getDocs(
      query(
        collection(firestore, "visitorPasses"),
        where("tenantId", "==", tenantId),
        where("date", ">=", date30d),
      ),
    ),

    // q6: billing statements with period >= period30d
    getDocs(
      query(
        collection(firestore, "billingStatements"),
        where("tenantId", "==", tenantId),
        where("period", ">=", period30d),
      ),
    ),

    // q7: packages with arrivedAt >= iso30d (docs without arrivedAt are excluded by Firestore)
    getDocs(
      query(
        collection(firestore, "packages"),
        where("tenantId", "==", tenantId),
        where("arrivedAt", ">=", iso30d),
      ),
    ),
  ]);

  const units = unitsSnap.size;
  const activeResidents = activeResidentsSnap.size;
  const openTickets = openTicketsSnap.size;
  const ticketsLast30d = tickets30dSnap.size;
  const visitsLast30d = visits30dSnap.size;
  const billingsLast30d = billings30dSnap.size;
  const packagesLast30d = packages30dSnap.size;

  const activeModules = [
    activeResidents > 0,
    ticketsLast30d > 0,
    visitsLast30d > 0,
    billingsLast30d > 0,
    packagesLast30d > 0,
  ].filter(Boolean).length;

  const adoptionScore = Math.round((activeModules / 5) * 100);
  const adoptionLevel: "high" | "medium" | "low" =
    adoptionScore >= 80 ? "high" : adoptionScore >= 40 ? "medium" : "low";

  return {
    tenantId,
    tenantName: (tenantData.name as string) ?? tenantId,
    status: (tenantData.status as "trial" | "active" | "suspended") ?? "trial",
    planId: tenantData.planId as string | undefined,
    units,
    activeResidents,
    openTickets,
    ticketsLast30d,
    visitsLast30d,
    billingsLast30d,
    packagesLast30d,
    adoptionScore,
    adoptionLevel,
    fetchedAt: new Date(),
  };
}

export async function fetchAllTenantsMetrics(): Promise<TenantAdoptionMetrics[]> {
  const firestore = assertDb();
  const tenantsSnap = await getDocs(collection(firestore, "tenants"));

  const results = await Promise.all(
    tenantsSnap.docs.map((doc) => fetchTenantMetrics(doc.id, doc.data())),
  );

  return results.sort((a, b) => b.adoptionScore - a.adoptionScore);
}
