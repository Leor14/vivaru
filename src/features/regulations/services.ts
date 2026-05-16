import {
  addDoc,
  collection,
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
import type { RegulationDoc, RegulationSignature } from "./types";

// ─── Upload ───────────────────────────────────────────────────────────────────

/**
 * Uploads a PDF regulation to Storage and creates a document record in
 * the /documents collection with category "reglamento". Returns the new doc ID.
 */
export async function uploadRegulationDocument(input: {
  tenantId: string;
  userId: string;
  file: File;
  title: string;
}): Promise<string> {
  if (!db) throw new Error("DB_UNAVAILABLE");
  if (!storage) throw new Error("STORAGE_UNAVAILABLE");

  const cleanName = input.file.name.toLowerCase().replace(/[^a-z0-9.\-_]+/g, "-");
  const storagePath = `tenants/${input.tenantId}/documents/${Date.now()}-${cleanName}`;
  const storageRef = ref(storage, storagePath);

  await uploadBytes(storageRef, input.file);
  const fileUrl = await getDownloadURL(storageRef);

  const docRef = await addDoc(collection(db, "documents"), {
    tenantId: input.tenantId,
    title: input.title,
    category: "reglamento",
    audience: "all",
    fileName: input.file.name,
    fileUrl,
    storagePath,
    uploadedBy: input.userId,
    createdBy: input.userId,
    uploadedAt: new Date().toISOString(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return docRef.id;
}

// ─── Active regulation ────────────────────────────────────────────────────────

export async function getActiveRegulation(tenantId: string): Promise<RegulationDoc | null> {
  if (!db) return null;

  const settingsSnap = await getDoc(doc(db, "tenantSettings", tenantId));
  if (!settingsSnap.exists()) return null;

  const activeRegulationId = settingsSnap.data().activeRegulationId as string | undefined;
  if (!activeRegulationId) return null;

  const regulationSnap = await getDoc(doc(db, "documents", activeRegulationId));
  if (!regulationSnap.exists()) return null;

  const data = regulationSnap.data() as Record<string, unknown>;
  return {
    id: regulationSnap.id,
    tenantId: data.tenantId as string,
    title: (data.title ?? data.fileName ?? "Reglamento") as string,
    fileUrl: data.fileUrl as string,
    uploadedAt: (data.uploadedAt ?? "") as string,
  };
}

export async function setActiveRegulation(
  tenantId: string,
  documentId: string,
): Promise<void> {
  if (!db) throw new Error("DB_UNAVAILABLE");
  await updateDoc(doc(db, "tenantSettings", tenantId), { activeRegulationId: documentId });
}

// ─── Signatures ───────────────────────────────────────────────────────────────

/**
 * Write-once transaction. Throws "ALREADY_SIGNED" if the unit already signed.
 */
export async function signRegulation(
  tenantId: string,
  regulation: RegulationDoc,
  unitId: string,
  uid: string,
): Promise<void> {
  if (!db) throw new Error("DB_UNAVAILABLE");

  const signatureId = `${regulation.id}_${unitId}`;
  const signatureRef = doc(db, "regulation_signatures", signatureId);

  await runTransaction(db, async (transaction) => {
    const existing = await transaction.get(signatureRef);
    if (existing.exists()) {
      throw new Error("ALREADY_SIGNED");
    }
    transaction.set(signatureRef, {
      id: signatureId,
      tenantId,
      regulationId: regulation.id,
      unitId,
      signedBy: uid,
      signedAt: serverTimestamp(),
      regulationVersion: regulation.title,
    });
  });
}

export async function getRegulationSignatures(
  tenantId: string,
  regulationId: string,
): Promise<RegulationSignature[]> {
  if (!db) return [];

  const snap = await getDocs(
    query(
      collection(db, "regulation_signatures"),
      where("tenantId", "==", tenantId),
      where("regulationId", "==", regulationId),
      orderBy("signedAt", "desc"),
    ),
  );

  return snap.docs.map((d) => d.data() as RegulationSignature);
}

export async function hasSignedRegulation(
  tenantId: string,
  regulationId: string,
  unitId: string,
): Promise<boolean> {
  if (!db) return false;
  const snap = await getDoc(doc(db, "regulation_signatures", `${regulationId}_${unitId}`));
  return snap.exists();
}

/**
 * Fetches the resident's own signature for display (returns null if unsigned).
 */
export async function getMySignature(
  regulationId: string,
  unitId: string,
): Promise<RegulationSignature | null> {
  if (!db) return null;
  const snap = await getDoc(
    doc(db, "regulation_signatures", `${regulationId}_${unitId}`),
  );
  if (!snap.exists()) return null;
  return snap.data() as RegulationSignature;
}
