"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";

import { db } from "@/lib/firebase/client";
import {
  type AppCurrency,
  formatAmount as formatAmountLib,
  formatAmountCompact as formatAmountCompactLib,
} from "@/lib/currency";
import { useAuth } from "@/features/auth/auth-context";

export function useTenantCurrency() {
  const { user } = useAuth();
  const [currency, setCurrency] = useState<AppCurrency>("COP");

  useEffect(() => {
    if (!user?.tenantId || !db) return;
    return onSnapshot(doc(db, "tenants", user.tenantId), (snap) => {
      const data = snap.data();
      const c = data?.currency;
      if (c === "COP" || c === "MXN" || c === "USD") {
        setCurrency(c);
      }
    });
  }, [user?.tenantId]);

  return {
    currency,
    formatAmount: (value: number) => formatAmountLib(value, currency),
    formatAmountCompact: (value: number) => formatAmountCompactLib(value, currency),
  };
}
