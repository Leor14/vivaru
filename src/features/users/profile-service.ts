import { updateProfile } from "firebase/auth";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { normalizeFirebaseError } from "@/lib/utils/error-handler";

import { auth, db } from "@/lib/firebase/client";
import { TEMAS, type Tema } from "@/lib/ui/tema";

type PrimitiveProfilePatch = {
  fullName?: string;
  displayName?: string;
  visibleName?: string;
  avatarId?: string;
  phone?: string;
  preferredContactMethod?: string;
  tema?: string;
};

export type UserProfilePatch = {
  fullName?: string;
  avatarId?: string;
  phone?: string;
  preferredContactMethod?: string;
  tema?: Tema;
};

function debugLog(message: string, payload?: Record<string, unknown>) {
  if (process.env.NODE_ENV === "production") return;
  if (payload) {
    console.info(message, payload);
    return;
  }
  console.info(message);
}

function pickNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function sanitizeUserProfilePatch(input: PrimitiveProfilePatch): UserProfilePatch {
  const normalizedFullName =
    pickNonEmptyString(input.fullName) ??
    pickNonEmptyString(input.displayName) ??
    pickNonEmptyString(input.visibleName);

  const sanitized: UserProfilePatch = {
    ...(normalizedFullName ? { fullName: normalizedFullName } : {}),
    ...(pickNonEmptyString(input.avatarId) ? { avatarId: pickNonEmptyString(input.avatarId) } : {}),
    ...(pickNonEmptyString(input.phone) ? { phone: pickNonEmptyString(input.phone) } : {}),
    ...(pickNonEmptyString(input.preferredContactMethod)
      ? { preferredContactMethod: pickNonEmptyString(input.preferredContactMethod) }
      : {}),
  };

  // `PRD-V-FEAT-007`. Un valor desconocido NO se escribe: se cae del parche y el
  // documento se queda como estaba. La regla de Firestore lo vuelve a rechazar
  // desde el servidor — el cliente no es el guardian.
  if (TEMAS.includes(input.tema as Tema)) sanitized.tema = input.tema as Tema;

  return sanitized;
}

export async function updateUserProfile(uid: string, patch: PrimitiveProfilePatch) {
  if (!db) throw new Error("Firestore no inicializado");
  if (!auth?.currentUser || auth.currentUser.uid !== uid) {
    throw new Error("Sesion invalida para actualizar perfil");
  }

  const sanitizedPayload = sanitizeUserProfilePatch(patch);
  const docPath = `users/${uid}`;

  if (Object.keys(sanitizedPayload).length === 0) {
    throw new Error("No hay cambios validos para actualizar el perfil");
  }

  debugLog("[updateUserProfile] uid", { uid, authUid: auth.currentUser.uid });
  debugLog("[updateUserProfile] docPath", { docPath, method: "updateDoc" });
  debugLog("[updateUserProfile] sanitizedPayload", sanitizedPayload as Record<string, unknown>);

  try {
    await updateDoc(doc(db, "users", uid), {
      ...sanitizedPayload,
      updatedAt: serverTimestamp(),
    });

    if (sanitizedPayload.fullName) {
      await updateProfile(auth.currentUser, { displayName: sanitizedPayload.fullName });
    }

    await auth.currentUser.getIdToken(true);
    debugLog("[updateUserProfile] success", { docPath });
  } catch (error) {
    console.error("[updateUserProfile] error", {
      uid,
      docPath,
      code: (error as { code?: string } | null | undefined)?.code,
      message: normalizeFirebaseError(error),
    });
    throw error;
  }
}
