import { httpsCallable } from "firebase/functions";
import { FirebaseError } from "firebase/app";
import { onAuthStateChanged, type User } from "firebase/auth";

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
  temporaryPassword: string;
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
  temporaryPassword: string;
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

export async function provisionResidentTemporaryAccessCallable(input: ProvisionResidentTemporaryAccessInput) {
  if (!functions) {
    throw new Error("Firebase Functions no esta configurado en este entorno.");
  }

  const callable = httpsCallable<
    ProvisionResidentTemporaryAccessInput,
    { uid: string; email: string; fullName: string; temporaryPasswordSource: "documentNumber" }
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

    if (code === "already-exists") return "Ya existe un usuario con ese correo.";
    if (code === "invalid-argument") return "Datos invalidos. Revisa tenant, correo, contrasena y estado.";
    if (code === "permission-denied") return "No tienes permisos para ejecutar esta accion.";
    if (code === "not-found") return "El tenant o usuario no existe.";
    if (code === "failed-precondition") return cleanMessage || "No se cumplen las condiciones de seguridad para esta accion.";
    if (code === "unauthenticated") return "Debes iniciar sesion nuevamente para continuar.";
    if (code === "unavailable") return "CORS_ERROR: El servicio no esta disponible o la conexion fue bloqueada.";
    if (code === "internal") return "Ocurrio un error interno al procesar la solicitud. Intenta nuevamente.";
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return fallbackMessage;
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
