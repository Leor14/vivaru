"use client";

import { useEffect, useState } from "react";

import { db } from "@/lib/firebase/client";
import { getAdminSurveys, getPublishedSurveysForResident } from "@/features/surveys/services";
import type { Survey } from "@/features/surveys/types";

export function useAdminSurveys(tenantId?: string) {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(Boolean(tenantId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId || !db) {
      setLoading(false);
      return;
    }

    const unsub = getAdminSurveys(
      tenantId,
      (data) => {
        setSurveys(data);
        setError(null);
        setLoading(false);
      },
      (message) => {
        console.error("[useAdminSurveys]", { tenantId, message });
        setError(message);
        setLoading(false);
      },
    );

    return () => {
      if (unsub) unsub();
    };
  }, [tenantId]);

  if (!tenantId) return { surveys: [], loading: false, error: null };
  if (!db) return { surveys: [], loading: false, error: "Firebase no esta configurado." };

  return { surveys, loading, error };
}

export function useResidentSurveys(tenantId?: string) {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(Boolean(tenantId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId || !db) {
      setLoading(false);
      return;
    }

    const unsub = getPublishedSurveysForResident(
      tenantId,
      (data) => {
        setSurveys(data);
        setError(null);
        setLoading(false);
      },
      (message) => {
        console.error("[useResidentSurveys]", { tenantId, message });
        setError(message);
        setLoading(false);
      },
    );

    return () => {
      if (unsub) unsub();
    };
  }, [tenantId]);

  if (!tenantId) return { surveys: [], loading: false, error: null };
  if (!db) return { surveys: [], loading: false, error: "Firebase no esta configurado." };

  return { surveys, loading, error };
}
