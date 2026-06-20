import type { Timestamp } from "firebase/firestore";

export type AgreementSignatureMode = "obligatoria" | "parcial" | "informativo";
export type AgreementSignerScope = "all" | "selected";
export type AgreementStatus = "borrador" | "enviado" | "cerrado";

/**
 * Acuerdo de una sesión de comité. Paralelo al reglamento pero hay muchos
 * (uno por sesión, ordenados por fecha). Ver docs/plan-acuerdos-comite.md.
 */
export interface CommitteeAgreement {
  id: string;
  tenantId: string;
  title: string;
  /** Fecha de la sesión (YYYY-MM-DD). */
  sessionDate: string;
  /** = sessionDate; campo canónico para reportes/consulta por rango. */
  eventDate: string;
  description?: string | null;
  fileUrl?: string | null;
  storagePath?: string | null;
  fileName?: string | null;
  signatureMode: AgreementSignatureMode;
  signerScope: AgreementSignerScope;
  /** Unidades firmantes cuando signerScope === "selected". */
  signerUnitIds?: string[] | null;
  /** Cuórum mínimo opcional (modalidad parcial). */
  quorum?: number | null;
  status: AgreementStatus;
  createdBy: string;
  createdAt?: string;
  sentAt?: string | null;
}

/** Firma write-once de una unidad sobre un acuerdo (id = "{agreementId}_{unitId}"). */
export interface CommitteeAgreementSignature {
  id: string;
  tenantId: string;
  agreementId: string;
  unitId: string;
  signedBy: string;
  signedAt: Timestamp;
  agreementTitle: string;
  agreementSessionDate: string;
}
