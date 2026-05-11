import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";

import { db } from "@/lib/firebase/client";

/**
 * Checks whether a resident unit is eligible to create new reservations.
 *
 * Short-circuit order (fail-fast toward "eligible"):
 *  1. Tenant setting: if reservationPolicy.blockOnDebt is not enabled, always eligible.
 *  2. Unit exemption: if the unit has reservationExempt === true, always eligible.
 *  3. Overdue billing: if any billingStatement for the unit has status "overdue"
 *     with balance > 0, the unit is ineligible.
 *
 * Uses one-shot reads (getDocs/getDoc) for point-in-time accuracy — not subscriptions.
 */
export async function checkReservationEligibility(
  tenantId: string,
  unitId: string,
): Promise<{ eligible: boolean; amountDue: number; reason?: string }> {
  if (!db) {
    // Fail-open: if Firebase isn't configured, don't block the user.
    return { eligible: true, amountDue: 0 };
  }

  // Step 1 — tenant policy check
  const settingsRef = doc(db, "tenantSettings", tenantId);
  const settingsSnap = await getDoc(settingsRef);
  const settings = settingsSnap.data() as { reservationPolicy?: { blockOnDebt?: boolean } } | undefined;

  if (!settings?.reservationPolicy?.blockOnDebt) {
    return { eligible: true, amountDue: 0 };
  }

  // Step 2 — per-unit exemption check
  const unitsRef = collection(db, "units");
  const unitQuery = query(
    unitsRef,
    where("tenantId", "==", tenantId),
    where("unitId", "==", unitId),
  );
  const unitSnap = await getDocs(unitQuery);

  if (!unitSnap.empty) {
    const unitData = unitSnap.docs[0].data() as { reservationExempt?: boolean };
    if (unitData.reservationExempt === true) {
      return { eligible: true, amountDue: 0 };
    }
  }

  // Step 3 — overdue billing check
  const billingRef = collection(db, "billingStatements");
  const billingQuery = query(
    billingRef,
    where("tenantId", "==", tenantId),
    where("unitId", "==", unitId),
    where("status", "==", "overdue"),
  );
  const billingSnap = await getDocs(billingQuery);

  let totalDue = 0;
  billingSnap.forEach((billingDoc) => {
    const data = billingDoc.data() as { balance?: number };
    if (typeof data.balance === "number" && data.balance > 0) {
      totalDue += data.balance;
    }
  });

  if (totalDue > 0) {
    return { eligible: false, amountDue: totalDue, reason: "OVERDUE_BALANCE" };
  }

  return { eligible: true, amountDue: 0 };
}
