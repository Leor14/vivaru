import { useEffect, useState } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { UnitChangeRequest } from "../types";

// createdAt puede llegar como Timestamp de Firestore, Date o forma serializada.
function toMillis(value: unknown): number {
  if (value && typeof (value as { toMillis?: () => number }).toMillis === "function") {
    return (value as { toMillis: () => number }).toMillis();
  }
  if (value instanceof Date) return value.getTime();
  if (value && typeof (value as { seconds?: number }).seconds === "number") {
    return (value as { seconds: number }).seconds * 1000;
  }
  return 0;
}

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
        // Solo igualdad (sin orderBy) para no exigir un indice compuesto. Un
        // residente tiene muy pocas solicitudes: ordenamos en el cliente y
        // tomamos la mas reciente.
        const q = query(
          collection(db, "unitChangeRequests"),
          where("userId", "==", userId),
        );
        const snap = await getDocs(q);
        if (snap.empty) {
          setRequest(null);
        } else {
          const docs = snap.docs.map(
            (docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as UnitChangeRequest,
          );
          docs.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
          setRequest(docs[0]);
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Error al consultar solicitud");
      } finally {
        setLoading(false);
      }
    };
    fetchRequest();
  }, [userId]);

  return { request, loading, error };
}
