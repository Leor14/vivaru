"use client";

import { useEffect, useState } from "react";

import { subscribeTenantCollection } from "@/lib/firebase/realtime-helpers";
import type { CommitteeAgreement, CommitteeAgreementSignature } from "./types";

/**
 * Acuerdos de comité del tenant, ordenados por fecha de sesión (más nuevos
 * arriba). Realtime; requiere el índice (tenantId, sessionDate desc).
 */
export function useCommitteeAgreements(tenantId?: string) {
  const [items, setItems] = useState<CommitteeAgreement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId) {
      setLoading(false);
      return;
    }
    const unsub = subscribeTenantCollection<CommitteeAgreement>(
      "committee_agreements",
      tenantId,
      (data) => {
        setItems(data);
        setError(null);
        setLoading(false);
      },
      (message) => {
        setError(message);
        setLoading(false);
      },
      { orderByField: "sessionDate", orderDirection: "desc" },
    );
    return () => {
      if (unsub) unsub();
    };
  }, [tenantId]);

  return { items, loading, error };
}

/**
 * Firmas de la unidad del residente (realtime). Solo filtros de igualdad
 * (tenantId + unitId), sin índice compuesto. Sirve para saber qué acuerdos ya
 * firmó esa unidad.
 */
export function useMyAgreementSignatures(tenantId?: string, unitId?: string) {
  const [signatures, setSignatures] = useState<CommitteeAgreementSignature[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId || !unitId) {
      setSignatures([]);
      setLoading(false);
      return;
    }
    const unsub = subscribeTenantCollection<CommitteeAgreementSignature>(
      "committee_agreement_signatures",
      tenantId,
      (data) => {
        setSignatures(data);
        setLoading(false);
      },
      () => setLoading(false),
      { equals: [{ field: "unitId", value: unitId }] },
    );
    return () => {
      if (unsub) unsub();
    };
  }, [tenantId, unitId]);

  return { signatures, loading };
}

/**
 * Firmas de un acuerdo específico (realtime). Requiere el índice
 * (tenantId, agreementId, signedAt desc).
 */
export function useAgreementSignatures(tenantId?: string, agreementId?: string) {
  const [signatures, setSignatures] = useState<CommitteeAgreementSignature[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId || !agreementId) {
      setSignatures([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = subscribeTenantCollection<CommitteeAgreementSignature>(
      "committee_agreement_signatures",
      tenantId,
      (data) => {
        setSignatures(data);
        setLoading(false);
      },
      () => setLoading(false),
      { equals: [{ field: "agreementId", value: agreementId }], orderByField: "signedAt", orderDirection: "desc" },
    );
    return () => {
      if (unsub) unsub();
    };
  }, [tenantId, agreementId]);

  return { signatures, loading };
}
