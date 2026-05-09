import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updateEmail as updateFirebaseEmail,
  updatePassword as updateFirebasePassword,
} from "firebase/auth";
import { doc, updateDoc, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";
import type { UnitChangeRequest } from "./types";

export async function updateResidentEmail(input: {
  uid: string;
  email: string;
  currentPassword: string;
}) {
  if (!db || !auth?.currentUser) {
    throw new Error("Sesion invalida para actualizar correo");
  }
  if (auth.currentUser.uid !== input.uid) {
    throw new Error("No autorizado para actualizar este correo");
  }
  if (!auth.currentUser.email) {
    throw new Error("La cuenta no tiene correo asociado");
  }

  const normalizedEmail = input.email.trim().toLowerCase();
  const credential = EmailAuthProvider.credential(auth.currentUser.email, input.currentPassword);

  await reauthenticateWithCredential(auth.currentUser, credential);
  await updateFirebaseEmail(auth.currentUser, normalizedEmail);
  await auth.currentUser.getIdToken(true);

  const userRef = doc(db, "users", input.uid);
  await updateDoc(userRef, {
    email: normalizedEmail,
    updatedAt: serverTimestamp(),
  });
}

export async function updateResidentPassword(input: {
  uid: string;
  currentPassword: string;
  newPassword: string;
}) {
  if (!auth?.currentUser) {
    throw new Error("Sesion invalida para actualizar contrasena");
  }
  if (auth.currentUser.uid !== input.uid) {
    throw new Error("No autorizado para actualizar esta contrasena");
  }
  if (!auth.currentUser.email) {
    throw new Error("La cuenta no tiene correo asociado");
  }

  const credential = EmailAuthProvider.credential(auth.currentUser.email, input.currentPassword);
  await reauthenticateWithCredential(auth.currentUser, credential);
  await updateFirebasePassword(auth.currentUser, input.newPassword);
  await auth.currentUser.getIdToken(true);
}

export async function createUnitChangeRequest(data: Omit<UnitChangeRequest, "id" | "status" | "createdAt" | "reviewedAt" | "reviewedBy"> & { reason?: string }) {
  if (!db) throw new Error("Firestore no inicializado");
  // Validación mínima: no permitir solicitud si requestedUnitId === currentUnitId
  if (data.currentUnitId === data.requestedUnitId) throw new Error("La unidad solicitada es igual a la actual");
  const ref = collection(db, "unitChangeRequests");
  const docRef = await addDoc(ref, {
    ...data,
    status: "pending",
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}
