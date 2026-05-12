"use client";

import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { useEffect, useState } from "react";

import { db } from "@/lib/firebase/client";
import type { RegulationDoc, RegulationSignature } from "./types";

// ─── useActiveRegulation ──────────────────────────────────────────────────────

export function useActiveRegulation(tenantId?: string) {
  const [activeRegulation, setActiveRegulation] = useState<RegulationDoc | null>(null);
  const [loading, setLoading] = useState(Boolean(tenantId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId || !db) {
      setLoading(false);
      return;
    }

    const firestore = db;

    const unsub = onSnapshot(
      doc(firestore, "tenantSettings", tenantId),
      (settingsSnap) => {
        const activeRegulationId = settingsSnap.exists()
          ? (settingsSnap.data().activeRegulationId as string | undefined)
          : undefined;

        if (!activeRegulationId) {
          setActiveRegulation(null);
          setLoading(false);
          return;
        }

        getDoc(doc(firestore, "documents", activeRegulationId))
          .then((regulationSnap) => {
            if (regulationSnap.exists()) {
              const data = regulationSnap.data() as Record<string, unknown>;
              setActiveRegulation({
                id: regulationSnap.id,
                tenantId: data.tenantId as string,
                title: (data.title ?? data.fileName ?? "Reglamento") as string,
                fileUrl: data.fileUrl as string,
                uploadedAt: (data.uploadedAt ?? "") as string,
              });
            } else {
              setActiveRegulation(null);
            }
            setLoading(false);
          })
          .catch(() => {
            setError("Error al cargar el reglamento activo");
            setLoading(false);
          });
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );

    return () => unsub();
  }, [tenantId]);

  return { activeRegulation, loading, error };
}

// ─── useRegulationSignatures ──────────────────────────────────────────────────

export function useRegulationSignatures(tenantId?: string, regulationId?: string) {
  const [signatures, setSignatures] = useState<RegulationSignature[]>([]);
  const [loading, setLoading] = useState(Boolean(tenantId && regulationId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId || !regulationId || !db) {
      setLoading(false);
      return;
    }

    const unsub = onSnapshot(
      query(
        collection(db, "regulation_signatures"),
        where("tenantId", "==", tenantId),
        where("regulationId", "==", regulationId),
        orderBy("signedAt", "desc"),
      ),
      (snap) => {
        setSignatures(snap.docs.map((d) => d.data() as RegulationSignature));
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );

    return () => unsub();
  }, [tenantId, regulationId]);

  return { signatures, loading, error };
}
