"use client";

import { useEffect, useMemo, useState } from "react";

import { subscribeTenantCollection } from "@/lib/firebase/realtime-helpers";
import type { CommitteeAgreement, CommitteeAgreementSignature } from "./types";

type UnitRow = { id: string; status?: string };

/**
 * Resumen de cumplimiento de acuerdos para el Panel de control: cuántos acuerdos
 * enviados (de firma) tienen firmas pendientes, y cuántas firmas faltan en total.
 * El esperado por acuerdo = todas las unidades activas o las seleccionadas.
 */
export function useAgreementsComplianceSummary(tenantId?: string) {
  const [agreements, setAgreements] = useState<CommitteeAgreement[]>([]);
  const [signatures, setSignatures] = useState<CommitteeAgreementSignature[]>([]);
  const [units, setUnits] = useState<UnitRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) {
      setLoading(false);
      return;
    }
    let a = false;
    let s = false;
    let u = false;
    const done = () => {
      if (a && s && u) setLoading(false);
    };
    const ua = subscribeTenantCollection<CommitteeAgreement>(
      "committee_agreements",
      tenantId,
      (d) => { setAgreements(d); a = true; done(); },
      () => { a = true; done(); },
    );
    const us = subscribeTenantCollection<CommitteeAgreementSignature>(
      "committee_agreement_signatures",
      tenantId,
      (d) => { setSignatures(d); s = true; done(); },
      () => { s = true; done(); },
    );
    const uu = subscribeTenantCollection<UnitRow>(
      "units",
      tenantId,
      (d) => { setUnits(d); u = true; done(); },
      () => { u = true; done(); },
    );
    return () => {
      ua?.();
      us?.();
      uu?.();
    };
  }, [tenantId]);

  return useMemo(() => {
    const activeUnits = units.filter((x) => x.status === "active").length;
    const signedByAgreement = new Map<string, number>();
    for (const sig of signatures) {
      signedByAgreement.set(sig.agreementId, (signedByAgreement.get(sig.agreementId) ?? 0) + 1);
    }
    const sentForSignature = agreements.filter(
      (ag) => ag.status === "enviado" && ag.signatureMode !== "informativo",
    );
    let pendingAgreements = 0;
    let pendingSignatures = 0;
    for (const ag of sentForSignature) {
      const expected = ag.signerScope === "selected" ? (ag.signerUnitIds?.length ?? 0) : activeUnits;
      const signed = signedByAgreement.get(ag.id) ?? 0;
      if (signed < expected) {
        pendingAgreements += 1;
        pendingSignatures += expected - signed;
      }
    }
    return { pendingAgreements, pendingSignatures, loading };
  }, [agreements, signatures, units, loading]);
}
