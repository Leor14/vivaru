"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";

import { db } from "@/lib/firebase/client";
import type { TenantStatus } from "@/types/domain";

/**
 * Estado del ambiente para la UI del trial: qué estado tiene y cuántos días le
 * quedan. Alimenta el banner de vigencia y el candado de módulos.
 */
export type TenantTrialState = {
  status: TenantStatus | undefined;
  trialEndsAt: string | undefined;
  /** Días restantes; negativo si ya venció, null si no aplica. */
  daysLeft: number | null;
  isTrial: boolean;
  isExpired: boolean;
  loading: boolean;
};

const INITIAL: TenantTrialState = {
  status: undefined,
  trialEndsAt: undefined,
  daysLeft: null,
  isTrial: false,
  isExpired: false,
  loading: true,
};

function computeDaysLeft(trialEndsAt: string | undefined): number | null {
  if (!trialEndsAt) return null;
  const end = new Date(trialEndsAt).getTime();
  if (Number.isNaN(end)) return null;
  return Math.ceil((end - Date.now()) / 86_400_000);
}

export function useTenantTrial(tenantId: string | undefined): TenantTrialState {
  const [state, setState] = useState<TenantTrialState>(INITIAL);

  useEffect(() => {
    if (!tenantId || !db) {
      setState({ ...INITIAL, loading: false });
      return;
    }

    const unsub = onSnapshot(
      doc(db, "tenants", tenantId),
      (snap) => {
        const data = snap.data() as { status?: TenantStatus; trialEndsAt?: string } | undefined;
        const status = data?.status;
        setState({
          status,
          trialEndsAt: data?.trialEndsAt,
          daysLeft: computeDaysLeft(data?.trialEndsAt),
          isTrial: status === "trial",
          isExpired: status === "expired",
          loading: false,
        });
      },
      // Un fallo de lectura no debe romper el shell: se asume ambiente normal.
      () => setState({ ...INITIAL, loading: false }),
    );

    return () => unsub();
  }, [tenantId]);

  return state;
}
