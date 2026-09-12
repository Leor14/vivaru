import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";

import { db } from "@/lib/firebase/client";
import { aplicaMora } from "@/features/reservations/politica-del-area";

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
  /** `PRD-V-FIX-001` entrega 2: la política del área elegida; sin ella, la del conjunto. */
  politicaDelArea?: boolean | null,
): Promise<{ eligible: boolean; amountDue: number; reason?: string }> {
  if (!db) {
    // Fail-open: if Firebase isn't configured, don't block the user.
    return { eligible: true, amountDue: 0 };
  }

  // Step 1 — tenant policy check
  const settingsRef = doc(db, "tenantSettings", tenantId);
  const settingsSnap = await getDoc(settingsRef);
  const settings = settingsSnap.data() as { reservationPolicy?: { blockOnDebt?: boolean } } | undefined;

  if (!aplicaMora(settings?.reservationPolicy?.blockOnDebt, politicaDelArea)) {
    return { eligible: true, amountDue: 0 };
  }

  // Step 2 — per-unit exemption check. `PRD-V-FIX-001` entrega 1.1: por el DOC ID,
  // que es lo que viaja en la sesión —como hace el servidor—, y por el campo
  // `unitId` solo para unidades viejas cuyo id no case. Buscarla solo por el campo
  // (un slug) no casaba nunca: una unidad exenta veía el aviso de mora mientras el
  // servidor la dejaba reservar.
  const unitByIdSnap = await getDoc(doc(db, "units", unitId));
  if (unitByIdSnap.exists()) {
    const unitData = unitByIdSnap.data() as { tenantId?: string; reservationExempt?: boolean };
    if (unitData.tenantId === tenantId && unitData.reservationExempt === true) {
      return { eligible: true, amountDue: 0 };
    }
  } else {
    const unitSnap = await getDocs(
      query(collection(db, "units"), where("tenantId", "==", tenantId), where("unitId", "==", unitId)),
    );
    if (!unitSnap.empty) {
      const unitData = unitSnap.docs[0].data() as { reservationExempt?: boolean };
      if (unitData.reservationExempt === true) {
        return { eligible: true, amountDue: 0 };
      }
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
