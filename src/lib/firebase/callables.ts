import { httpsCallable } from "firebase/functions";
import { FirebaseError } from "firebase/app";
import { onAuthStateChanged, type User } from "firebase/auth";
import { normalizeFirebaseError } from "@/lib/utils/error-handler";

import { auth, functions } from "@/lib/firebase/client";

type CreateVisitorPassInput = {
  tenantId: string;
  unitId: string;
  unitLabel: string;
  visitorName: string;
  documentNumber: string;
  qrCodeValue: string;
  date: string;
  scheduledTime: string;
  hostResidentName?: string;
  tower?: string;
  unit?: string;
};

type ConfirmPackageReceiptInput = {
  tenantId: string;
  packageId: string;
};

type CreateTenantWorkspaceInput = {
  name: string;
  city: string;
  planId: string;
  status: "active" | "suspended" | "trial";
  onboardingStatus: "not_started" | "in_progress" | "completed";
};

type CreateTenantAdminInput = {
  tenantId: string;
  fullName: string;
  email: string;
  temporaryPassword?: string;
  status: "active" | "inactive";
};

type UpdateTenantAdminInput = {
  uid: string;
  tenantId: string;
  fullName: string;
  email: string;
  status: "active" | "inactive";
};

type CreateTenantOperationalUserInput = {
  tenantId: string;
  fullName: string;
  email: string;
  temporaryPassword?: string;
  role: "tenant_admin" | "security_guard";
  status: "active" | "inactive";
};

type ProvisionResidentTemporaryAccessInput = {
  tenantId: string;
  personId: string;
};

type CompleteResidentPasswordChangeInput = {
  currentPassword: string;
  newPassword: string;
};

export async function createVisitorPassCallable(input: CreateVisitorPassInput) {
  if (!functions) {
    throw new Error("Firebase Functions no esta configurado en este entorno.");
  }

  const callable = httpsCallable<CreateVisitorPassInput, { visitorPassId: string }>(functions, "createVisitorPass");
  return executeCallable(callable, input, "No fue posible crear el visitante.");
}

export async function retransmitVoucherCallable(input: { voucherId: string }) {
  if (!functions) {
    throw new Error("Firebase Functions no esta configurado en este entorno.");
  }

  const callable = httpsCallable<{ voucherId: string }, { ok: boolean }>(functions, "retransmitVoucher");
  return executeCallable(callable, input, "No fue posible reintentar la transmisión al SRI.");
}

export async function notifyBillingBatchCallable(input: { tenantId: string; period: string; unitIds: string[] }) {
  if (!functions) {
    throw new Error("Firebase Functions no esta configurado en este entorno.");
  }

  const callable = httpsCallable<typeof input, { ok: boolean; notified: number }>(functions, "notifyBillingBatch");
  return executeCallable(callable, input, "No fue posible notificar a los residentes del lote de cartera.");
}

export async function confirmPackageReceiptCallable(input: ConfirmPackageReceiptInput) {
  if (!functions) {
    throw new Error("Firebase Functions no esta configurado en este entorno.");
  }

  const callable = httpsCallable<ConfirmPackageReceiptInput, { packageId: string; alreadyDelivered: boolean }>(
    functions,
    "confirmPackageReceipt",
  );
  const response = await callable(input);
  return response.data;
}

export async function createTenantWorkspaceCallable(input: CreateTenantWorkspaceInput) {
  if (!functions) {
    throw new Error("Firebase Functions no esta configurado en este entorno.");
  }

  const callable = httpsCallable<CreateTenantWorkspaceInput, { tenantId: string }>(functions, "createTenantWorkspace");
  return executeCallable(callable, input, "No fue posible crear el tenant.");
}

export async function createTenantAdminCallable(input: CreateTenantAdminInput) {
  if (!functions) {
    throw new Error("Firebase Functions no esta configurado en este entorno.");
  }

  const callable = httpsCallable<CreateTenantAdminInput, { uid: string }>(functions, "createTenantAdmin");
  return executeCallable(callable, input, "No fue posible crear el admin de tenant.");
}

export async function updateTenantAdminCallable(input: UpdateTenantAdminInput) {
  if (!functions) {
    throw new Error("Firebase Functions no esta configurado en este entorno.");
  }

  const callable = httpsCallable<UpdateTenantAdminInput, { uid: string }>(functions, "updateTenantAdmin");
  return executeCallable(callable, input, "No fue posible actualizar el admin de tenant.");
}

export async function createTenantOperationalUserCallable(input: CreateTenantOperationalUserInput) {
  if (!functions) {
    throw new Error("Firebase Functions no esta configurado en este entorno.");
  }

  const callable = httpsCallable<CreateTenantOperationalUserInput, { uid: string }>(
    functions,
    "createTenantOperationalUser",
  );
  return executeCallable(callable, input, "No fue posible crear el usuario operativo.");
}

export async function setOperationalUserStatusCallable(input: {
  tenantId: string;
  uid: string;
  status: "active" | "inactive";
}) {
  if (!functions) {
    throw new Error("Firebase Functions no esta configurado en este entorno.");
  }

  const callable = httpsCallable<typeof input, { ok: boolean; status: "active" | "inactive" }>(
    functions,
    "setOperationalUserStatus",
  );
  return executeCallable(callable, input, "No fue posible actualizar el estado del usuario.");
}

export async function updateOperationalUserCallable(input: {
  tenantId: string;
  uid: string;
  fullName?: string;
  role?: "tenant_admin" | "security_guard";
}) {
  if (!functions) {
    throw new Error("Firebase Functions no esta configurado en este entorno.");
  }

  const callable = httpsCallable<typeof input, { ok: boolean }>(functions, "updateOperationalUser");
  return executeCallable(callable, input, "No fue posible actualizar el usuario.");
}

export async function deleteOperationalUserCallable(input: { tenantId: string; uid: string }) {
  if (!functions) {
    throw new Error("Firebase Functions no esta configurado en este entorno.");
  }

  const callable = httpsCallable<typeof input, { ok: boolean }>(functions, "deleteOperationalUser");
  return executeCallable(callable, input, "No fue posible eliminar el usuario.");
}

export async function createDocumentFolderCallable(input: {
  tenantId: string;
  name: string;
  parentId?: string | null;
  description?: string;
}) {
  if (!functions) {
    throw new Error("Firebase Functions no esta configurado en este entorno.");
  }

  const callable = httpsCallable<typeof input, { ok: boolean; folderId: string; depth: number; path: string }>(
    functions,
    "createDocumentFolder",
  );
  return executeCallable(callable, input, "No fue posible crear la carpeta.");
}

export async function updateDocumentFolderCallable(input: {
  tenantId: string;
  folderId: string;
  name?: string;
  description?: string;
  color?: "gray" | "blue" | "green" | "amber" | "purple" | "teal";
}) {
  if (!functions) throw new Error("Firebase Functions no esta configurado en este entorno.");
  const callable = httpsCallable<typeof input, { ok: boolean }>(functions, "renameDocumentFolder");
  return executeCallable(callable, input, "No fue posible actualizar la carpeta.");
}

export async function deleteDocumentFolderCallable(input: { tenantId: string; folderId: string }) {
  if (!functions) throw new Error("Firebase Functions no esta configurado en este entorno.");
  const callable = httpsCallable<typeof input, { ok: boolean }>(functions, "deleteDocumentFolder");
  return executeCallable(callable, input, "No fue posible eliminar la carpeta.");
}

export async function moveDocumentFolderCallable(input: {
  tenantId: string;
  folderId: string;
  targetParentId?: string | null;
}) {
  if (!functions) throw new Error("Firebase Functions no esta configurado en este entorno.");
  const callable = httpsCallable<typeof input, { ok: boolean }>(functions, "moveDocumentFolder");
  return executeCallable(callable, input, "No fue posible mover la carpeta.");
}

export async function ensureCommunicationsFolderCallable(input: { tenantId: string }) {
  if (!functions) throw new Error("Firebase Functions no esta configurado en este entorno.");
  const callable = httpsCallable<typeof input, { folderId: string }>(functions, "ensureCommunicationsFolder");
  return executeCallable(callable, input, "No fue posible abrir la carpeta de comunicados.");
}

export async function ensureSystemFolderCallable(input: {
  tenantId: string;
  systemKey: "communications" | "regulations" | "committee_agreements" | "payment_receipts" | "billing_closures";
}) {
  if (!functions) throw new Error("Firebase Functions no esta configurado en este entorno.");
  const callable = httpsCallable<typeof input, { folderId: string }>(functions, "ensureSystemFolder");
  return executeCallable(callable, input, "No fue posible abrir la carpeta del sistema.");
}

export async function notifyResidentReceiptCallable(input: {
  tenantId: string;
  unitId: string;
  kind: "adjusted" | "rejected";
  amount?: number;
  reason?: string;
}) {
  if (!functions) throw new Error("Firebase Functions no esta configurado en este entorno.");
  const callable = httpsCallable<typeof input, { ok: boolean; notified: number }>(functions, "notifyResidentReceipt");
  return executeCallable(callable, input, "No fue posible notificar al residente.");
}

export async function sendBillingReminderCallable(input: { tenantId: string; unitIds: string[] }) {
  if (!functions) throw new Error("Firebase Functions no esta configurado en este entorno.");
  const callable = httpsCallable<typeof input, { ok: boolean; notified: number }>(functions, "sendBillingReminder");
  return executeCallable(callable, input, "No fue posible enviar el recordatorio.");
}

export async function mergeUnitsCallable(input: { tenantId: string; survivorId: string; duplicateIds: string[] }) {
  if (!functions) throw new Error("Firebase Functions no esta configurado en este entorno.");
  const callable = httpsCallable<typeof input, { ok: boolean; merged: number; repointed: number }>(functions, "mergeUnits");
  return executeCallable(callable, input, "No fue posible fusionar las unidades.");
}

export async function getDocumentDownloadUrlCallable(input: { documentId: string }) {
  if (!functions) throw new Error("Firebase Functions no esta configurado en este entorno.");
  const callable = httpsCallable<typeof input, { url: string }>(functions, "getDocumentDownloadUrl");
  return executeCallable(callable, input, "No fue posible abrir el documento.");
}

export async function provisionResidentTemporaryAccessCallable(input: ProvisionResidentTemporaryAccessInput) {
  if (!functions) {
    throw new Error("Firebase Functions no esta configurado en este entorno.");
  }

  const callable = httpsCallable<
    ProvisionResidentTemporaryAccessInput,
    { uid: string; email: string; fullName: string; temporaryPasswordSource: "resetLink" }
  >(functions, "provisionResidentTemporaryAccess");
  return executeCallable(callable, input, "No fue posible restablecer la clave temporal del residente.");
}

export async function completeResidentPasswordChangeCallable(input: CompleteResidentPasswordChangeInput) {
  if (!functions) {
    throw new Error("Firebase Functions no esta configurado en este entorno.");
  }

  const callable = httpsCallable<CompleteResidentPasswordChangeInput, { ok: true; mustChangePassword: false }>(
    functions,
    "completeResidentPasswordChange",
  );
  return executeCallable(callable, input, "No fue posible completar el cambio obligatorio de contrasena.");
}

function normalizeCallableError(error: unknown, fallbackMessage: string) {
  if (error instanceof TypeError && /fetch/i.test(error.message)) {
    return "CORS_ERROR: No fue posible conectar con el servicio de creación. Verifica sesion, red y origen permitido.";
  }

  if (error instanceof FirebaseError && error.code.startsWith("functions/")) {
    const code = error.code.replace("functions/", "");
    const cleanMessage = error.message.replace(/^Firebase:\s*/i, "").replace(/\s*\(functions\/.+\)\.?$/i, "").trim();
    if (cleanMessage && cleanMessage.toLowerCase() !== code.toLowerCase()) {
      return cleanMessage;
    }
  }

  const mapped = normalizeFirebaseError(error);
  // If normalizeFirebaseError returns the generic fallback, prefer the caller-specific fallbackMessage
  return mapped !== "Ocurrió un error inesperado. Intenta de nuevo." ? mapped : fallbackMessage;
}

async function executeCallable<TInput, TResult>(
  callable: (payload: TInput) => Promise<{ data: TResult }>,
  input: TInput,
  fallbackMessage: string,
) {
  try {
    const user = await waitForAuthenticatedUser();
    if (!user) {
      throw new Error("Tu sesion no esta activa. Inicia sesion nuevamente.");
    }

    // Fuerza token fresco para asegurar claims actualizados (p. ej. superadmin).
    await user.getIdToken(true);

    const response = await callable(input);
    return response.data;
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[callable] request failed", { input, error });
    }
    throw new Error(normalizeCallableError(error, fallbackMessage));
  }
}

async function waitForAuthenticatedUser(timeoutMs = 4000): Promise<User | null> {
  const firebaseAuth = auth;
  if (!firebaseAuth) return null;
  if (firebaseAuth.currentUser) return firebaseAuth.currentUser;

  return new Promise((resolve) => {
    let settled = false;
    const timeout = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      unsubscribe();
      resolve(firebaseAuth.currentUser);
    }, timeoutMs);

    const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      unsubscribe();
      resolve(user);
    });
  });
}
