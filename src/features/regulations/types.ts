import type { Timestamp } from "firebase/firestore";

export interface RegulationSignature {
  id: string; // "{regulationId}_{unitId}"
  tenantId: string;
  regulationId: string; // FK to /documents/{id}
  unitId: string;
  signedBy: string; // uid del residente
  signedAt: Timestamp;
  regulationVersion: string; // snapshot del título al firmar
}

export interface RegulationDoc {
  id: string;
  tenantId: string;
  title: string;
  fileUrl: string;
  uploadedAt: string;
}
