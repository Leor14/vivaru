import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase/client";

export interface AvailableUnit {
  id: string;
  display: string;
  status: "active" | "inactive";
  block?: string;
  tower?: string;
}

export function useAvailableUnits(tenantId: string, excludeUnitId?: string) {
  const [units, setUnits] = useState<AvailableUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId) {
      setUnits([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    const fetchUnits = async () => {
      if (!db) {
        setUnits([]);
        setLoading(false);
        setError(null);
        return;
      }
      try {
        const q = query(
          collection(db, "units"),
          where("tenantId", "==", tenantId),
          where("status", "==", "active")
        );
        const snap = await getDocs(q);
        let result: AvailableUnit[] = [];
        snap.forEach((doc) => {
          const d = doc.data();
          if (doc.id !== excludeUnitId) {
            result.push({
              id: doc.id,
              display: d.display || d.name || doc.id,
              status: d.status,
              block: d.block,
              tower: d.tower,
            });
          }
        });
        setUnits(result);
      } catch (e: any) {
        setError(e.message || "Error al cargar unidades");
      } finally {
        setLoading(false);
      }
    };
    fetchUnits();
  }, [tenantId, excludeUnitId, db]);

  return { units, loading, error };
}
