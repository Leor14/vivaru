import { httpsCallable } from "firebase/functions";
import { FirebaseError } from "firebase/app";
import { onAuthStateChanged, type User } from "firebase/auth";
import { normalizeFirebaseError } from "@/lib/utils/error-handler";

import { auth, functions } from "@/lib/firebase/client";
// Solo el tipo: `import type` se borra al compilar, así que el módulo puro de
// datos faltantes no arrastra Firebase a quien lo pruebe.
import type { DatoFaltante } from "@/lib/ai/datos-faltantes";

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

export type RegisterWalkInVisitInput = {
  tenantId: string;
  unitId: string;
  unitLabel: string;
  visitorName: string;
  documentNumber: string;
  hostResidentName?: string;
  date?: string;
  scheduledTime?: string;
};

export async function registerWalkInVisitCallable(input: RegisterWalkInVisitInput) {
  if (!functions) {
    throw new Error("Firebase Functions no esta configurado en este entorno.");
  }

  const callable = httpsCallable<RegisterWalkInVisitInput, { visitorPassId: string }>(functions, "registerWalkInVisit");
  return executeCallable(callable, input, "No fue posible registrar la visita.");
}

export async function retransmitVoucherCallable(input: { voucherId: string }) {
  if (!functions) {
    throw new Error("Firebase Functions no esta configurado en este entorno.");
  }

  const callable = httpsCallable<{ voucherId: string }, { ok: boolean }>(functions, "retransmitVoucher");
  return executeCallable(callable, input, "No fue posible reintentar la transmisión al SRI.");
}

/**
 * Provisión del ambiente de prueba desde el registro público del landing.
 * No requiere sesión: es el único punto de entrada del self-service.
 */
export async function createTrialWorkspaceCallable(input: {
  nombre: string;
  email: string;
  telefono?: string;
  conjunto: string;
  ciudad: string;
  pais?: string;
  unidadesEstimadas?: number;
}) {
  if (!functions) {
    throw new Error("Firebase Functions no esta configurado en este entorno.");
  }

  const callable = httpsCallable<typeof input, { tenantId: string; trialEndsAt: string }>(
    functions,
    "createTrialWorkspace",
  );
  // Sin sesión: no se puede usar executeCallable (que exige usuario autenticado).
  try {
    const response = await callable(input);
    return response.data;
  } catch (error) {
    throw new Error(normalizeCallableError(error, "No fue posible crear tu ambiente de prueba. Intenta de nuevo."));
  }
}

/**
 * Alta de cliente a partir de un lead sin ambiente (solo superadmin).
 * Para leads que ya tienen ambiente de prueba, se usa "Convertir a cliente"
 * en la consola de ambientes, que no crea nada nuevo.
 */
export async function createTenantFromLeadCallable(input: {
  leadId: string;
  planId?: string;
  seedExamples?: boolean;
}) {
  if (!functions) {
    throw new Error("Firebase Functions no esta configurado en este entorno.");
  }

  const callable = httpsCallable<typeof input, { tenantId: string }>(functions, "createTenantFromLead");
  return executeCallable(callable, input, "No fue posible crear el ambiente para este lead.");
}

/** Solicitud de contacto comercial desde el portal (reemplaza el mailto:). */
export async function requestAdvisorContactCallable(input: {
  tenantId: string;
  motivo: string;
  mensaje?: string;
  telefono?: string;
  horarioPreferido?: string;
  /** Cargo de quien pide: lo único que no se sabe ya del registro. */
  cargo?: string;
}) {
  if (!functions) {
    throw new Error("Firebase Functions no esta configurado en este entorno.");
  }

  const callable = httpsCallable<typeof input, { ok: boolean }>(functions, "requestAdvisorContact");
  return executeCallable(callable, input, "No fue posible enviar tu solicitud. Intenta de nuevo.");
}

export async function remindPackagePickupCallable(input: { tenantId: string; packageId: string }) {
  if (!functions) {
    throw new Error("Firebase Functions no esta configurado en este entorno.");
  }

  const callable = httpsCallable<typeof input, { ok: boolean; notified: number }>(functions, "remindPackagePickup");
  return executeCallable(callable, input, "No fue posible enviar el recordatorio al residente.");
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
  systemKey: "communications" | "regulations" | "committee_agreements" | "payment_receipts" | "billing_closures" | "committee_reports" | "cartera_history" | "ledger_history";
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
  const callable = httpsCallable<typeof input, { ok: boolean; notified: number; units?: number; unitsWithoutRecipient?: number }>(functions, "sendBillingReminder");
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

// G4 · Observabilidad: envío best-effort de errores del cliente. No usa
// executeCallable (no debe mostrar toasts ni propagar si el log falla).
export async function logClientErrorCallable(input: {
  message: string;
  stack?: string;
  context?: string;
  url?: string;
  severity?: "error" | "warning";
}) {
  if (!functions) return { ok: false };
  const callable = httpsCallable<typeof input, { ok: boolean }>(functions, "logClientError");
  const result = await callable(input);
  return result.data;
}

// Onboarding por invitación (Opción B). getAccountInvite valida sin consumir.
export async function getAccountInviteCallable(token: string) {
  if (!functions) throw new Error("Firebase Functions no esta configurado en este entorno.");
  const callable = httpsCallable<
    { token: string },
    { status: "valid" | "invalid" | "expired" | "used"; email?: string; fullName?: string }
  >(functions, "getAccountInvite");
  const result = await callable({ token });
  return result.data;
}

export async function activateAccountCallable(input: { token: string; password: string }) {
  if (!functions) throw new Error("Firebase Functions no esta configurado en este entorno.");
  // Flujo PÚBLICO (sin sesión): no usar executeCallable, que exige usuario
  // autenticado. Se llama directo y se normaliza el error de la función.
  const callable = httpsCallable<typeof input, { ok: true }>(functions, "activateAccount");
  try {
    const result = await callable(input);
    return result.data;
  } catch (error) {
    throw new Error(normalizeCallableError(error, "No fue posible activar la cuenta."));
  }
}

export async function resendAccountInviteCallable(input: { tenantId: string; uid: string }) {
  if (!functions) throw new Error("Firebase Functions no esta configurado en este entorno.");
  const callable = httpsCallable<typeof input, { ok: true }>(functions, "resendAccountInvite");
  return executeCallable(callable, input, "No fue posible reenviar el acceso.");
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


// ── Soporte al cliente (PRD-V-FEAT-001) ──────────────────────────────────────
// Toda escritura de tickets pasa por callable: las reglas no dejan escribir a
// nadie desde el cliente, ni siquiera al superadmin.

export async function createSupportTicketCallable(input: {
  tenantId: string;
  category: string;
  subject: string;
  description: string;
  attachments?: Array<{ name: string; path: string; url: string }>;
}) {
  if (!functions) throw new Error("Firebase Functions no esta configurado en este entorno.");
  const callable = httpsCallable<typeof input, { ticketId: string }>(functions, "createSupportTicket");
  return executeCallable(callable, input, "No fue posible abrir el ticket. Intenta de nuevo.");
}

export async function replyToSupportTicketCallable(input: {
  ticketId: string;
  message: string;
  attachments?: Array<{ name: string; path: string; url: string }>;
}) {
  if (!functions) throw new Error("Firebase Functions no esta configurado en este entorno.");
  const callable = httpsCallable<typeof input, { ok: true; status: string }>(functions, "replyToSupportTicket");
  return executeCallable(callable, input, "No fue posible enviar tu mensaje. Intenta de nuevo.");
}

export async function updateSupportTicketStatusCallable(input: {
  ticketId: string;
  status?: string;
  priority?: string;
}) {
  if (!functions) throw new Error("Firebase Functions no esta configurado en este entorno.");
  const callable = httpsCallable<typeof input, { ok: true }>(functions, "updateSupportTicketStatus");
  return executeCallable(callable, input, "No fue posible actualizar el ticket.");
}

export async function reopenSupportTicketCallable(input: { ticketId: string; message: string }) {
  if (!functions) throw new Error("Firebase Functions no esta configurado en este entorno.");
  const callable = httpsCallable<typeof input, { ok: true }>(functions, "reopenSupportTicketCallable");
  return executeCallable(callable, input, "No fue posible reabrir el ticket.");
}

export async function closeSupportTicketCallable(input: { ticketId: string }) {
  if (!functions) throw new Error("Firebase Functions no esta configurado en este entorno.");
  const callable = httpsCallable<typeof input, { ok: true }>(functions, "closeSupportTicketCallable");
  return executeCallable(callable, input, "No fue posible cerrar el ticket.");
}

export async function addSupportNoteCallable(input: { ticketId: string; note: string }) {
  if (!functions) throw new Error("Firebase Functions no esta configurado en este entorno.");
  const callable = httpsCallable<typeof input, { ok: true }>(functions, "addSupportNote");
  return executeCallable(callable, input, "No fue posible guardar la nota.");
}

/**
 * Resumen de consumo de IA (Paso 1.5 de docs/hoja-de-ruta-ia.md). Solo
 * superadmin: agrega datos de todos los conjuntos a la vez.
 */
export interface AiUsageBucket {
  llamadas: number;
  fallos: number;
  inputTokens: number;
  outputTokens: number;
  costoUsd: number;
  latenciaMediaMs: number;
}

export interface AiUsageSummaryResponse {
  from: string;
  to: string;
  total: AiUsageBucket;
  porConjunto: Array<{ tenantId: string } & AiUsageBucket>;
  porOperacion: Array<{ operationKey: string } & AiUsageBucket>;
  fallosPorMotivo: Array<{ outcome: string; veces: number }>;
  filas: number;
  truncado: boolean;
  priceTableVersion: string;
}

export async function getAiUsageCallable(input: { from?: string; to?: string } = {}) {
  if (!functions) throw new Error("Firebase Functions no esta configurado en este entorno.");
  const callable = httpsCallable<typeof input, AiUsageSummaryResponse>(functions, "getAiUsage");
  return executeCallable(callable, input, "No fue posible leer el consumo de IA.");
}

export interface BorradorComunicacion {
  title: string;
  body: string;
  notificationSummary: string;
  missingInformation: DatoFaltante[];
  qualityFlags: string[];
  /** Vacío siempre: si el modelo asumió algo, el servidor ya rechazó la respuesta entera. */
  assumptions: string[];
}

export interface CuotaRestante {
  conjuntoDia: number;
  conjuntoMes: number;
  usuarioDia: number;
}

export interface RedactarComunicacionResult {
  output: BorradorComunicacion;
  cuotaRestante: CuotaRestante;
}

export interface RedactarComunicacionInput {
  proposito: string;
  hechos: string[];
  tono: "informativo" | "urgente" | "cordial";
}

/**
 * Pide un borrador asistido de comunicación (Paso 2.5).
 *
 * **No manda `tenantId`, y no es un olvido.** La puerta rechaza cualquier
 * llamada que lo traiga en el cuerpo *aunque coincida* con el de la sesión: el
 * conjunto sale del token y de la membresía, nunca del cliente (Paso 1.2).
 *
 * Tampoco manda audiencia, torres, unidades, vigencia ni estado. No están en el
 * esquema de entrada del catálogo, así que no hay forma de que la IA los toque.
 *
 * Cuando falla, el mensaje que llega ya está escrito para la persona y termina
 * en «puedes continuar con el proceso manual». Quien llama solo tiene que
 * mostrarlo: el detalle técnico se queda en los logs del servidor.
 */
export async function redactarComunicacionCallable(input: RedactarComunicacionInput) {
  if (!functions) throw new Error("Firebase Functions no esta configurado en este entorno.");
  const callable = httpsCallable<
    { operationKey: string; input: RedactarComunicacionInput },
    RedactarComunicacionResult
  >(functions, "aiInvoke");
  return executeCallable(
    callable,
    { operationKey: "comunicaciones-redactar", input },
    "No pudimos preparar el borrador. Puedes continuar con el proceso manual.",
  );
}

/** Salida del asistente de PQRS, tal y como la fija el §7 de PRD-VAI-FEAT-002. */
export interface AsistenciaPqrs {
  summary: string;
  /** `null` siempre en `buzon_simple`: contrato de producto, no calidad de modelo. */
  suggestedCategory: "pqrs" | "maintenance" | "billing" | null;
  suggestedType: "petition" | "complaint" | "claim" | "suggestion" | "other" | null;
  suggestedPriority: "low" | "medium" | "high";
  priorityReason: string;
  needsHumanReview: boolean;
  requests: string[];
  missingInformation: string[];
  nextSteps: string[];
  draftResponse: string;
  safetyFlags: Array<"amenaza" | "dato_sensible" | "lenguaje_ofensivo" | "posible_urgencia" | "enfado">;
}

/** Qué se quedó fuera por no caber en el esquema. Se le enseña a la persona. */
export interface RecorteAsistencia {
  mensaje: boolean;
  historialOmitido: number;
}

export interface AsistirTicketPqrsResult {
  output: AsistenciaPqrs;
  cuotaRestante: CuotaRestante;
  recorte: RecorteAsistencia;
}

/**
 * Pide la asistencia de un ticket de PQRS (Fase 3 de `PRD-VAI-FEAT-002`).
 *
 * **Manda un `ticketId` y nada más, y eso es el diseño entero.** No manda el
 * mensaje, ni el historial, ni —lo que importa— la variante del conjunto: los
 * lee el servidor. `variante` es lo que decide la puerta dura de `buzon_simple`
 * (nulls siempre), así que dejar que la afirme el navegador sería poner una
 * puerta de producto en manos del cliente.
 *
 * Tampoco manda `tenantId`: sale de la sesión, igual que en el resto de la
 * plataforma de IA. Cuando falla, el mensaje ya viene escrito para la persona.
 */
export async function asistirTicketPqrsCallable(ticketId: string) {
  if (!functions) throw new Error("Firebase Functions no esta configurado en este entorno.");
  const callable = httpsCallable<{ ticketId: string }, AsistirTicketPqrsResult>(functions, "asistirTicketPqrs");
  return executeCallable(
    callable,
    { ticketId },
    "No pudimos preparar la asistencia. Puedes atender el ticket a mano, como siempre.",
  );
}

/**
 * Registra qué hizo el administrador con el borrador asistido (Paso 2.5).
 *
 * **Best-effort a propósito, como `logClientErrorCallable`.** No usa
 * `executeCallable` porque no debe propagar: si esto falla, el comunicado ya se
 * guardó bien y enseñarle un error a la persona sería mentirle. Se pierde una
 * fila de medición, que es molesto y no es su problema.
 *
 * No manda `tenantId` — sale de la sesión, igual que en la puerta.
 */
export interface FeedbackComunicacionesInput {
  /** Une los varios envíos de una misma sesión de borrador en una sola fila. */
  sesionId: string;
  operationKey: "comunicaciones-redactar";
  propuestas: number;
  aplicada: boolean;
  deshecha: boolean;
  guardada: boolean;
  mostrados: string[];
  descartados: string[];
  respondidos: string[];
  distanciaEdicion: number | null;
}

/** Los tres ejes. Catálogos cerrados: aquí no cabe contenido del ticket. */
export interface ClasificacionMedidaPqrs {
  category: "pqrs" | "maintenance" | "billing" | null;
  type: "petition" | "complaint" | "claim" | "suggestion" | "other" | null;
  priority: "low" | "medium" | "high" | null;
}

export interface FeedbackPqrsInput {
  sesionId: string;
  operationKey: "pqrs-asistir";
  lecturas: number;
  /** Lo que propuso el modelo. */
  sugerida: ClasificacionMedidaPqrs;
  clasificacionAplicada: boolean;
  /** Lo que quedó escrito en el ticket, o `null` si no llegó a guardar. */
  guardada: ClasificacionMedidaPqrs | null;
  borradorCopiado: boolean;
  respuestaGuardada: boolean;
  distanciaEdicion: number | null;
}

export async function registrarFeedbackIaCallable(
  input: FeedbackComunicacionesInput | FeedbackPqrsInput,
): Promise<{ ok: boolean }> {
  if (!functions) return { ok: false };
  try {
    const callable = httpsCallable<typeof input, { ok: true }>(functions, "registrarFeedbackIa");
    const result = await callable(input);
    return result.data;
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[feedback-ia] no se pudo registrar", error);
    }
    return { ok: false };
  }
}

/**
 * Registra un intento de importación tabular (`PRD-V-FEAT-002`, `CA-13`).
 *
 * **Best-effort, como el registro de feedback del canario**: si falla, la
 * importación ya ocurrió y enseñar un error sería mentirle a la persona sobre
 * lo que pasó con sus datos. Devuelve `ok: false` y sigue.
 *
 * No manda `tenantId`: sale de la sesión en el servidor.
 */
export async function registrarImportacionCallable(input: {
  /** Une el inicio y el fin de un mismo intento. */
  runId: string;
  fase: "inicio" | "fin";
  entidad: "unit" | "person";
  pista?: string;
  formato: "csv" | "xlsx";
  hojas: number;
  filas: number;
  camposPorAlias: number;
  camposAMano: number;
  encabezadosSinUsar: string[];
  importadas?: number;
  omitidas?: number;
}): Promise<{ ok: boolean }> {
  if (!functions) return { ok: false };
  try {
    const callable = httpsCallable<typeof input, { ok: boolean }>(functions, "registrarImportacion");
    const result = await callable(input);
    return { ok: Boolean(result.data?.ok) };
  } catch {
    return { ok: false };
  }
}
