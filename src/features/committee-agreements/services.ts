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
  folderId?: string | null;
  title?: string;
}): Promise<string> {
  if (!db) throw new Error("DB_UNAVAILABLE");
  if (!storage) throw new Error("STORAGE_UNAVAILABLE");
  const firestore = db;

  const cleanName = input.file.name.toLowerCase().replace(/[^a-z0-9.\-_]+/g, "-");
  const storagePath = `tenants/${input.tenantId}/agreements/${Date.now()}-${cleanName}`;
  const storageRef = ref(storage, storagePath);

  await uploadBytes(storageRef, input.file);
  const fileUrl = await getDownloadURL(storageRef);

  await updateDoc(doc(firestore, AGREEMENTS, input.agreementId), {
    fileUrl,
    storagePath,
    fileName: input.file.name,
    updatedBy: input.userId,
    updatedAt: serverTimestamp(),
  });

  // Registra el archivo en el repositorio de Documentos (categoría "acuerdo").
  await addDoc(collection(firestore, "documents"), {
    tenantId: input.tenantId,
    fileName: input.file.name,
    description: input.title ? `Acuerdo: ${input.title}` : "Acuerdo de comité",
    fileUrl,
    storagePath,
    folderId: input.folderId ?? null,
    fileSize: input.file.size,
    contentType: input.file.type || "",
    category: "acuerdo",
    source: "committee_agreement",
    sourceId: input.agreementId,
    uploadedBy: input.userId,
    uploadedByName: "",
    createdBy: input.userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return fileUrl;
}

/** Backfill: registra en Documentos los acuerdos con archivo que aún no están. */
export async function foldAgreementsIntoFolder(tenantId: string, folderId: string, userId: string): Promise<void> {
  if (!db) return;
  const firestore = db;
  const [ags, docsSnap] = await Promise.all([
    getDocs(query(collection(firestore, AGREEMENTS), where("tenantId", "==", tenantId))),
    getDocs(query(collection(firestore, "documents"), where("tenantId", "==", tenantId), where("category", "==", "acuerdo"))),
  ]);
  const registered = new Set(
    docsSnap.docs.map((d) => (d.data() as { storagePath?: string }).storagePath).filter(Boolean) as string[],
  );
  const pending = ags.docs.filter((a) => {
    const data = a.data() as { storagePath?: string; fileUrl?: string };
    return Boolean(data.storagePath && data.fileUrl && !registered.has(data.storagePath));
  });
  await Promise.all(
    pending.map((a) => {
      const data = a.data() as { storagePath?: string; fileUrl?: string; fileName?: string; title?: string };
      return addDoc(collection(firestore, "documents"), {
        tenantId,
        fileName: data.fileName || "Acuerdo de comité.pdf",
        description: data.title ? `Acuerdo: ${data.title}` : "Acuerdo de comité",
        fileUrl: data.fileUrl,
        storagePath: data.storagePath,
        folderId,
        category: "acuerdo",
        source: "committee_agreement",
        sourceId: a.id,
        uploadedBy: userId,
        uploadedByName: "",
        createdBy: userId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }),
  );
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
