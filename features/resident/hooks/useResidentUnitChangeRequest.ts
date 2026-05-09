import { useEffect, useState } from "react";
import { collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { UnitChangeRequest } from "../types";

export function useResidentUnitChangeRequest(userId: string) {
  const [request, setRequest] = useState<UnitChangeRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    const fetchRequest = async () => {
      if (!db) {
        setRequest(null);
        setLoading(false);
        setError(null);
        return;
      }
      try {
        const q = query(
          collection(db, "unitChangeRequests"),
          where("userId", "==", userId),
          orderBy("createdAt", "desc"),
          limit(1)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          const docSnap = snap.docs[0];
          setRequest({ id: docSnap.id, ...docSnap.data() } as UnitChangeRequest);
        } else {
          setRequest(null);
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Error al consultar solicitud");
      } finally {
        setLoading(false);
      }
    };
    fetchRequest();
  }, [userId, db]);

  return { request, loading, error };
}
