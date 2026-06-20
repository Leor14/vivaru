import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";

import { db, storage } from "@/lib/firebase/client";
import type {
  AgreementSignatureMode,
  AgreementSignerScope,
  CommitteeAgreement,
  CommitteeAgreementSignature,
} from "./types";

const AGREEMENTS = "committee_agreements";
const SIGNATURES = "committee_agreement_signatures";

// ─── CRUD del acuerdo ───────────────────────────────────────────────────────

export async function createCommitteeAgreement(input: {
  tenantId: string;
  userId: string;
  title: string;
  sessionDate: string; // YYYY-MM-DD
  signatureMode: AgreementSignatureMode;
  signerScope: AgreementSignerScope;
  signerUnitIds?: string[];
  description?: string;
  quorum?: number | null;
}): Promise<string> {
  if (!db) throw new Error("DB_UNAVAILABLE");

  const docRef = await addDoc(collection(db, AGREEMENTS), {
    tenantId: input.tenantId,
    title: input.title.trim(),
    sessionDate: input.sessionDate,
    eventDate: input.sessionDate,
    description: input.description?.trim() || null,
    signatureMode: input.signatureMode,
    signerScope: input.signerScope,
    signerUnitIds: input.signerScope === "selected" ? (input.signerUnitIds ?? []) : null,
    quorum: input.quorum ?? null,
    status: "borrador",
    createdBy: input.userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return docRef.id;
}

/** Sube el PDF a Storage y lo enlaza al acuerdo. */
export async function uploadAgreementFile(input: {
  tenantId: string;
  userId: string;
  agreementId: string;
  file: File;
}): Promise<string> {
  if (!db) throw new Error("DB_UNAVAILABLE");
  if (!storage) throw new Error("STORAGE_UNAVAILABLE");

  const cleanName = input.file.name.toLowerCase().replace(/[^a-z0-9.\-_]+/g, "-");
  const storagePath = `tenants/${input.tenantId}/agreements/${Date.now()}-${cleanName}`;
  const storageRef = ref(storage, storagePath);

  await uploadBytes(storageRef, input.file);
  const fileUrl = await getDownloadURL(storageRef);

  await updateDoc(doc(db, AGREEMENTS, input.agreementId), {
    fileUrl,
    storagePath,
    fileName: input.file.name,
    updatedBy: input.userId,
    updatedAt: serverTimestamp(),
  });

  return fileUrl;
}

export async function updateCommitteeAgreement(
  agreementId: string,
  patch: Partial<CommitteeAgreement>,
): Promise<void> {
  if (!db) throw new Error("DB_UNAVAILABLE");
  await updateDoc(doc(db, AGREEMENTS, agreementId), { ...patch, updatedAt: serverTimestamp() });
}

/** Marca el acuerdo como enviado a firma. */
export async function sendAgreementToSignature(agreementId: string): Promise<void> {
  if (!db) throw new Error("DB_UNAVAILABLE");
  await updateDoc(doc(db, AGREEMENTS, agreementId), {
    status: "enviado",
    sentAt: new Date().toISOString(),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteCommitteeAgreement(agreementId: string): Promise<void> {
  if (!db) throw new Error("DB_UNAVAILABLE");
  await deleteDoc(doc(db, AGREEMENTS, agreementId));
}

// ─── Firmas ─────────────────────────────────────────────────────────────────

/** Firma write-once por unidad. Lanza "ALREADY_SIGNED" si ya estaba firmada. */
export async function signCommitteeAgreement(
  tenantId: string,
  agreement: Pick<CommitteeAgreement, "id" | "title" | "sessionDate">,
  unitId: string,
  uid: string,
): Promise<void> {
  if (!db) throw new Error("DB_UNAVAILABLE");

  const signatureId = `${agreement.id}_${unitId}`;
  const signatureRef = doc(db, SIGNATURES, signatureId);

  await runTransaction(db, async (transaction) => {
    const existing = await transaction.get(signatureRef);
    if (existing.exists()) throw new Error("ALREADY_SIGNED");
    transaction.set(signatureRef, {
      id: signatureId,
      tenantId,
      agreementId: agreement.id,
      unitId,
      signedBy: uid,
      signedAt: serverTimestamp(),
      agreementTitle: agreement.title,
      agreementSessionDate: agreement.sessionDate,
    });
  });
}

export async function getAgreementSignatures(
  tenantId: string,
  agreementId: string,
): Promise<CommitteeAgreementSignature[]> {
  if (!db) return [];
  const snap = await getDocs(
    query(
      collection(db, SIGNATURES),
      where("tenantId", "==", tenantId),
      where("agreementId", "==", agreementId),
      orderBy("signedAt", "desc"),
    ),
  );
  return snap.docs.map((d) => d.data() as CommitteeAgreementSignature);
}

export async function getMyAgreementSignature(
  agreementId: string,
  unitId: string,
): Promise<CommitteeAgreementSignature | null> {
  if (!db) return null;
  const snap = await getDoc(doc(db, SIGNATURES, `${agreementId}_${unitId}`));
  return snap.exists() ? (snap.data() as CommitteeAgreementSignature) : null;
}
