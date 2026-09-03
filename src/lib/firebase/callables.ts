import { httpsCallable } from "firebase/functions";
import { FirebaseError } from "firebase/app";
import { onAuthStateChanged, type User } from "firebase/auth";
import { CallableError, normalizeFirebaseError } from "@/lib/utils/error-handler";

import { auth, functions } from "@/lib/firebase/client";
import { loadSession } from "@/lib/auth/session";
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
  /** ISO-3166-1 alpha-2. El servidor deriva la moneda de aquí. */
  country: string;
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

export type CreateReservationRequestInput = {
  tenantId: string;
  unitId: string;
  unitLabel: string;
  amenityId: string;
  date: string;
  startTime: string;
  endTime: string;
  exclusiveUse?: boolean;
  createdByName?: string;
};

/**
 * PRD-V-FIX-001 entrega 1: la reserva del residente decidida en el servidor.
 * El error del servidor trae `details.regla` con la regla concreta incumplida;
 * el mensaje ya viene listo para mostrarse.
 */
export async function createReservationRequestCallable(input: CreateReservationRequestInput) {
  if (!functions) {
    throw new Error("Firebase Functions no esta configurado en este entorno.");
  }

  const callable = httpsCallable<CreateReservationRequestInput, { ok: true; reservationId: string; status: "pending" }>(
    functions,
    "createReservationRequest",
  );
  return executeCallable(callable, input, "No fue posible crear la reserva en este momento.");
}

export type GenerateCoefficientCampaignInput = {
  tenantId: string;
  totalAmount: number;
  /** `YYYY-MM`. */
  period: string;
  concept?: string;
  dueDate?: string;
  /** true = solo vista previa, no escribe nada. */
  dryRun?: boolean;
  operationKey: string;
};

export type CoefficientCampaignLine = {
  unitId: string;
  unitLabel: string;
  coefficient: number;
  amount: number;
  roundingAdjustment: number;
};

export type GenerateCoefficientCampaignResult = {
  ok: true;
  dryRun: boolean;
  campaignId?: string;
  created?: boolean;
  lines: CoefficientCampaignLine[];
  total: number;
  coefficientSum: number;
};

/**
 * PRD-V-PLAT-001: corrida por coeficiente. La MISMA callable sirve la vista
 * previa (dryRun) y la generación — el reparto vive solo en el servidor.
 */
export async function generateCoefficientCampaignCallable(input: GenerateCoefficientCampaignInput) {
  if (!functions) {
    throw new Error("Firebase Functions no esta configurado en este entorno.");
  }

  const callable = httpsCallable<GenerateCoefficientCampaignInput, GenerateCoefficientCampaignResult>(
    functions,
    "generateCoefficientCampaign",
  );
  return executeCallable(callable, input, "No fue posible generar la corrida por coeficiente.");
}

/**
 * `PRD-V-FLOW-001` — repartir un egreso entre las unidades.
 *
 * **La MISMA callable sirve la vista previa y el reparto**, igual que la corrida
 * por coeficiente y por el mismo motivo de §11.1: si el navegador calculara los
 * importes, un cliente manipulado emitiría los que quisiera. Aquí solo se dice
 * QUÉ egreso y CON QUÉ concepto; los importes los calcula el servidor las dos
 * veces, así que la vista previa no puede diferir de lo que se acaba creando.
 */
export type DistributeExpenseInput = {
  tenantId: string;
  expenseId: string;
  period: string;
  concept?: string;
  payerRelation?: "responsible" | "owner" | "tenant";
  dueDate?: string;
  /** true = solo vista previa, no escribe nada. */
  dryRun?: boolean;
  /** R5 · repartir un egreso YA repartido exige decir que sí a sabiendas. */
  confirmarRepetido?: boolean;
  operationKey: string;
};

export type DistributeExpenseResult = {
  ok: true;
  dryRun: boolean;
  campaignId?: string;
  created?: boolean;
  lines: CoefficientCampaignLine[];
  total: number;
  coefficientSum: number;
  /** El gasto es ordinario y puede estar ya cubierto por la cuota (§5.2). */
  avisoDobleCobro: boolean;
  /** Corridas anteriores VIVAS de este mismo egreso. Las anuladas no cuentan. */
  yaRepartido: string[];
};

export async function distributeExpenseCallable(input: DistributeExpenseInput) {
  if (!functions) {
    throw new Error("Firebase Functions no esta configurado en este entorno.");
  }

  const callable = httpsCallable<DistributeExpenseInput, DistributeExpenseResult>(
    functions,
    "distributeExpense",
  );
  return executeCallable(callable, input, "No fue posible repartir el egreso.");
}

export type CancelDistributionInput = {
  tenantId: string;
  campaignId: string;
  /** R8 · obligatorio. */
  reason: string;
};

export type CancelDistributionResult = {
  ok: true;
  campaignId: string;
  cancelled: number;
  alreadyCancelled: boolean;
};

/**
 * Anula la corrida entera. **No revierte pagos**: una corrida con algún cargo
 * cobrado la rechaza el servidor nombrando las unidades (R7), y deshacer un
 * pago es `revertirPago`, que tiene su propia trazabilidad.
 */
export async function cancelDistributionCallable(input: CancelDistributionInput) {
  if (!functions) {
    throw new Error("Firebase Functions no esta configurado en este entorno.");
  }

  const callable = httpsCallable<CancelDistributionInput, CancelDistributionResult>(
    functions,
    "cancelDistribution",
  );
  return executeCallable(callable, input, "No fue posible anular la corrida.");
}

/**
 * `PRD-V-FEAT-004` — el certificado de paz y salvo.
 *
 * **Va por callable y el estado de cuenta no**, y la diferencia es toda la
 * ficha: la única condición de este documento es «saldo cero», y esa **no la
 * puede evaluar el cliente**. Un navegador manipulado emitiría uno falso, y
 * este papel se enseña ante un tercero.
 *
 * **La puede llamar el RESIDENTE de la unidad**, no solo la administración: si
 * está al día, el documento es una consecuencia aritmética y no una concesión.
 */
export type EmitClearanceCertificateInput = {
  tenantId: string;
  unitId: string;
  unitLabel?: string;
  /** `YYYY-MM-DD`. La pone la pantalla: el servidor no inventa qué día es hoy. */
  issueDate: string;
  operationKey: string;
};

export type EmitClearanceCertificateResult = {
  ok: true;
  certificateId: string;
  code: string;
  created: boolean;
  balanceAtIssue: number;
  creditBalance: number;
};

export async function emitClearanceCertificateCallable(input: EmitClearanceCertificateInput) {
  if (!functions) {
    throw new Error("Firebase Functions no esta configurado en este entorno.");
  }

  const callable = httpsCallable<EmitClearanceCertificateInput, EmitClearanceCertificateResult>(
    functions,
    "emitClearanceCertificate",
  );
  return executeCallable(callable, input, "No fue posible emitir el certificado.");
}

export type CancelClearanceCertificateInput = {
  tenantId: string;
  certificateId: string;
  /** R8 · obligatorio. */
  reason: string;
};

export async function cancelClearanceCertificateCallable(input: CancelClearanceCertificateInput) {
  if (!functions) {
    throw new Error("Firebase Functions no esta configurado en este entorno.");
  }

  const callable = httpsCallable<CancelClearanceCertificateInput, { ok: true; certificateId: string; alreadyCancelled: boolean }>(
    functions,
    "cancelClearanceCertificate",
  );
  return executeCallable(callable, input, "No fue posible anular el certificado.");
}

export type RegisterWalkInVisitInput = {
  tenantId: string;
  unitId: string;
  unitLabel: string;
  visitorName: string;
  documentNumber: string;
  hostResidentName?: string;
  /**
   * `PRD-V-FLOW-005`. **`app`** = se le pregunta al residente y el pase espera cinco minutos.
   * **`llamada`** = el guardia llamó por fuera y autoriza él, declarando el medio.
   */
  via?: "app" | "llamada";
  date?: string;
  scheduledTime?: string;
};

export async function registerWalkInVisitCallable(input: RegisterWalkInVisitInput) {
  if (!functions) {
    throw new Error("Firebase Functions no esta configurado en este entorno.");
  }

  const callable = httpsCallable<
    RegisterWalkInVisitInput,
    { visitorPassId: string; authorizationStatus: "pendiente" | "autorizada" }
  >(functions, "registerWalkInVisit");
  return executeCallable(callable, input, "No fue posible registrar la visita.");
}

/**
 * `PRD-V-FLOW-005` — el residente autoriza o rechaza; el guardia rescata una expirada por la vía B.
 *
 * **`aplicada: false` no es un fallo**: significa que alguien de la unidad se adelantó, y viene con
 * su nombre. Quien lo consuma tiene que distinguirlo, o convertirá una carrera normal en un error.
 */
export async function resolveVisitAuthorizationCallable(input: {
  tenantId: string;
  visitorPassId: string;
  decision: "autorizar" | "rechazar";
}) {
  if (!functions) throw new Error("Firebase Functions no esta configurado en este entorno.");
  const callable = httpsCallable<
    typeof input,
    { ok: boolean; aplicada: boolean; estado: "autorizada" | "rechazada" | "expirada" | "pendiente"; resueltaPor: string }
  >(functions, "resolveVisitAuthorization");
  return executeCallable(callable, input, "No fue posible resolver la visita.");
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
    throw new CallableError(normalizeCallableError(error, "No fue posible crear tu ambiente de prueba. Intenta de nuevo."));
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
  /** Quién vendió (REVOPS-001E). Id en `salesReps`; el servidor lo valida. */
  vendedorId?: string;
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

/**
 * Cierra el acceso de un residente antes de borrar su ficha.
 *
 * Vive en el servidor porque desactivar una cuenta y revocar sus tokens son
 * operaciones del Admin SDK — y porque si el navegador pudiera hacerlo,
 * cualquiera con la consola abierta podría cerrar cuentas ajenas.
 */
export async function revokeResidentAccessCallable(input: { tenantId: string; personId: string }) {
  if (!functions) {
    throw new Error("Firebase Functions no esta configurado en este entorno.");
  }

  const callable = httpsCallable<
    typeof input,
    {
      revoked: boolean;
      accion: "sin-cuenta" | "revocar-y-borrar" | "revocar-y-conservar";
      motivo: string;
      uid: string | null;
    }
  >(functions, "revokeResidentAccess");
  return executeCallable(callable, input, "No fue posible cerrar el acceso del residente.");
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

/**
 * `PRD-V-FEAT-005` — fusionar registros duplicados del padrón.
 *
 * **El motivo es obligatorio y no es burocracia**: dentro de un año, una fusión sin porqué obliga
 * a reabrir la pregunta entera. El servidor lo exige; aquí solo se transporta.
 */
export async function mergePeopleCallable(input: {
  tenantId: string;
  survivorId: string;
  mergedIds: string[];
  motivo: string;
}) {
  if (!functions) throw new Error("Firebase Functions no esta configurado en este entorno.");
  const callable = httpsCallable<typeof input, { ok: boolean; fusionadas: number; repuntadas: number; decisionId: string }>(
    functions,
    "mergePeople",
  );
  return executeCallable(callable, input, "No fue posible fusionar las personas.");
}

/** `PRD-V-FEAT-005` — «no son la misma persona», con motivo. */
export async function dismissDuplicatePeopleGroupCallable(input: { tenantId: string; ids: string[]; motivo: string }) {
  if (!functions) throw new Error("Firebase Functions no esta configurado en este entorno.");
  const callable = httpsCallable<typeof input, { ok: boolean; clave: string }>(functions, "dismissDuplicatePeopleGroup");
  return executeCallable(callable, input, "No fue posible descartar el grupo.");
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

/**
 * El conjunto en el que la persona está trabajando AHORA.
 *
 * `PLAT-002` partió en dos lo que antes era un solo valor: el claim del token
 * pasó a significar «el último conjunto conocido» (§7.4) y el conjunto activo
 * vive en la sesión, porque puede cambiarlo el selector sin volver a
 * autenticarse. Todo lo que el servidor resolvía leyendo el claim tiene que
 * recibirlo desde aquí — y **comprobarlo contra la membresía**, que es lo que
 * lo hace seguro. Devolver `undefined` es válido: el servidor cae al claim,
 * que es el comportamiento de siempre.
 */
function conjuntoActivo(): string | undefined {
  return loadSession()?.tenantId;
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
  // El conjunto ACTIVO viaja aquí, no en el claim (`PLAT-002` §7.4). El
  // servidor lo comprueba contra la membresía antes de creerlo: mandarlo mal no
  // concede nada, y no mandarlo archivaba el error en el conjunto equivocado.
  // Se lee de la sesión y no se pide en cada sitio de llamada, que son muchos.
  const cuerpo = { ...input, tenantId: conjuntoActivo() };
  const callable = httpsCallable<typeof cuerpo, { ok: boolean }>(functions, "logClientError");
  const result = await callable(cuerpo);
  return result.data;
}

/**
 * **`PLAT-002` — re-emite el claim al conjunto activo.**
 *
 * El servidor comprueba la membresía antes de emitir, así que pedir un conjunto
 * ajeno no da nada. **Quien llame tiene que refrescar el token después**
 * (`getIdToken(true)`): sin eso el claim nuevo no llega a las reglas de Storage,
 * que es justo para lo que existe.
 */
export async function switchActiveTenantCallable(tenantId: string) {
  if (!functions) throw new Error("Firebase Functions no esta configurado en este entorno.");
  const callable = httpsCallable<{ tenantId: string }, { ok: true; tenantId: string }>(
    functions,
    "switchActiveTenant",
  );
  const result = await callable({ tenantId });
  return result.data;
}

/**
 * **`PLAT-002` §7.1 — la empresa administradora.** Solo superadmin (G5): quien
 * la crea es el equipo de Vivaru, en el alta comercial.
 *
 * No manda `tenantId` y aquí sí es correcto: la administradora vive POR ENCIMA
 * del conjunto, así que no hay conjunto activo que valga.
 */
export async function saveManagementCompanyCallable(input: {
  id?: string;
  name: string;
  taxId?: string;
  country: string;
  contactEmail?: string;
  contactPhone?: string;
  status: "active" | "inactive";
}) {
  if (!functions) throw new Error("Firebase Functions no esta configurado en este entorno.");
  const callable = httpsCallable<typeof input, { ok: true; id: string; conjuntosRenombrados: number }>(
    functions,
    "saveManagementCompany",
  );
  return executeCallable(callable, input, "No pudimos guardar la administradora.");
}

/**
 * Asocia o desasocia un conjunto. `managementCompanyId: null` lo deja suelto.
 *
 * **Mover un conjunto de una administradora a otra se RECHAZA** (R5): hay que
 * desasociarlo primero. Ese segundo paso es el que da la oportunidad de darse
 * cuenta de que se están pasando conjuntos de dueño.
 */
export async function setTenantManagementCompanyCallable(input: {
  tenantId: string;
  managementCompanyId: string | null;
}) {
  if (!functions) throw new Error("Firebase Functions no esta configurado en este entorno.");
  const callable = httpsCallable<typeof input, { ok: true; cambiado: boolean }>(
    functions,
    "setTenantManagementCompany",
  );
  return executeCallable(callable, input, "No pudimos cambiar la administradora del conjunto.");
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
    throw new CallableError(normalizeCallableError(error, "No fue posible activar la cuenta."));
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
    // `CallableError` y no `Error`: es lo que le dice a `normalizeFirebaseError`
    // que este mensaje ya está escrito para leerse y no debe sustituirlo por el
    // genérico. Ver el defecto que documenta esa clase.
    throw new CallableError(normalizeCallableError(error, fallbackMessage));
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

/**
 * `FIN-001` — la única vía por la que un pago toca la cartera y el libro.
 *
 * La `operationKey` es la clave de idempotencia: **la genera el llamante y la
 * repite si reintenta**. Enviarla dos veces aplica el pago una sola vez, y la
 * segunda respuesta trae `applied: false` con el mismo resultado. Generar una
 * clave nueva en cada intento anula la protección — por eso no se genera aquí.
 */
export async function applyPaymentCallable(input: {
  tenantId: string;
  /** El cargo, cuando el pago va a uno solo. Sigue siendo la forma normal. */
  statementId?: string;
  /**
   * **D-B.** El reparto entre varios cargos de la MISMA unidad, en una sola
   * operación. El cambio de firma es **aditivo**: si llega `statementId` el
   * servidor lo trata como un reparto de una línea, así que la pantalla de hoy
   * sigue funcionando sin tocar nada. Va detrás de `producto-pago-multiple`.
   */
  allocations?: { statementId: string; amount: number }[];
  amount: number;
  date: string;
  operationKey: string;
  source: "manual" | "receipt";
  receiptId?: string;
  reviewerName?: string;
  /** Quién pagó, para el recibo. Solo los usa el cobro manual. */
  payerName?: string | null;
  payerTaxId?: string | null;
  /**
   * **D-C.** A qué cuenta bancaria entró el dinero. El servidor comprueba que
   * exista, que sea de este conjunto y que esté activa; si no viene, el asiento
   * queda con `null`, que es lo correcto para el efectivo (R11).
   */
  bankAccountId?: string | null;
}) {
  if (!functions) throw new Error("Firebase Functions no esta configurado en este entorno.");
  const callable = httpsCallable<
    typeof input,
    {
      ok: true;
      applied: boolean;
      ledgerEntryId: string;
      paymentAmount: number;
      balance: number;
      status: "paid" | "overdue" | "pending";
      /**
       * El recibo, emitido por el servidor DENTRO de la transacción del pago
       * desde el 20 de agosto de 2026. Antes lo construía y lo escribía este
       * lado, después de aplicar el pago: si esa escritura fallaba, el pago
       * quedaba sin recibo. Solo viene en el cobro manual.
       */
      voucherId?: string;
      voucherCode?: string;
      /**
       * **D-B.** Una entrada por cargo cubierto, con su asiento y su importe.
       * Con un solo cargo trae una. Es lo que permite enseñar en pantalla a qué
       * fue cada peso sin volver a leer la cartera.
       */
      allocations?: { statementId: string; ledgerEntryId: string; amount: number }[];
      /**
       * **R2/R3.** El anticipo que dejó el sobrepago, si lo hubo. **Ausente
       * cuando el pago no sobró nada**: un anticipo de cero no se crea.
       *
       * Llevaba viajando desde la sesión A y **no estaba declarado aquí**, así
       * que llegaba al navegador y moría en el tipo — exactamente lo que le pasó
       * a `cayoEnOtrosIngresos` hasta el 23 de agosto de 2026.
       */
      advanceId?: string;
      advanceAmount?: number;
      /**
       * **R8.** `true` cuando el concepto del cargo no tenía cuenta equivalente
       * y el asiento cayó en «Otros ingresos». El servidor lo devuelve desde la
       * 1b-ii; hasta el 23 de agosto de 2026 **ni siquiera estaba declarado
       * aquí**, así que el dato llegaba al navegador y moría en el tipo.
       *
       * No es un error: R8 dice que un concepto desconocido **nunca se
       * descarta**. Es un aviso, y por eso el servidor lo distingue en vez de
       * tragárselo — un ingreso mal clasificado no se nota hasta que alguien
       * cuadra el estado financiero y le sobra dinero en «Otros».
       *
       * Solo puede venir con la bandera `producto-concepto-al-libro` encendida:
       * apagada, todo asiento se escribe como `alicuota` y no hay resolución
       * que pueda caer por defecto.
       */
      cayoEnOtrosIngresos?: boolean;
    }
  >(functions, "applyPayment");
  return executeCallable(callable, input, "No fue posible registrar el cobro.");
}

/**
 * `FIN-001` — deshace un pago ya aplicado.
 *
 * Se identifica por la `operationKey` **del pago original**, no por el asiento:
 * la clave es lo único que conoce todo lo que hay que deshacer —cuota, asiento
 * y comprobante— sin tener que reconstruirlo.
 *
 * `reversalKey` es la idempotencia de esta reversión y **tiene que ser distinta**
 * de la del pago; si no, la marca del pago se confundiría con la del reverso.
 *
 * `voucherAnuladoId` dice QUÉ recibo se anuló, si el pago había emitido uno.
 * Hasta el 20 de agosto de 2026 aquí venía `requiereNotaCredito`: el recibo NO se
 * anulaba —eso pedía una nota de crédito, que era fiscal— y quien operaba tenía
 * que acordarse de emitirla. **Ahora la anulación ocurre dentro de la misma
 * transacción**, así que esto informa de un hecho en vez de recordar una tarea.
 */
export async function revertPaymentCallable(input: {
  tenantId: string;
  operationKey: string;
  reversalKey: string;
  reason: string;
}) {
  if (!functions) throw new Error("Firebase Functions no esta configurado en este entorno.");
  const callable = httpsCallable<
    typeof input,
    {
      ok: true;
      reversed: boolean;
      reversalEntryId: string;
      paymentAmount: number;
      balance: number;
      status: "paid" | "overdue" | "pending";
      voucherAnuladoId?: string;
    }
  >(functions, "revertPayment");
  return executeCallable(callable, input, "No fue posible revertir el pago.");
}

/**
 * **`FLOW-002` §11.3 — el reparto sugerido, calculado por el SERVIDOR.**
 *
 * De solo lectura: no aplica nada, propone. Lo que devuelve es una sugerencia
 * que el administrador puede editar línea a línea antes de confirmar; quien
 * decide de verdad sigue siendo `aplicarPago`, que topa cada línea al saldo del
 * cargo mire lo que mire la pantalla.
 *
 * **Estaba en el navegador hasta el 24 de agosto de 2026**, y se movió porque el
 * ORDEN en que se imputa el dinero de alguien (R7, del más antiguo al más nuevo)
 * es una regla de negocio: en el cliente, ni el servidor puede garantizarla ni
 * la hereda el próximo que llame a la API.
 *
 * `sobranteSeraAnticipo` dice si la bandera está encendida, para que la pantalla
 * no prometa un saldo a favor que no se va a crear.
 */
export async function previewPaymentAllocationCallable(input: {
  tenantId: string;
  unitId: string;
  amount: number;
  /** Los cargos a considerar. Sin esto, todos los de la unidad con deuda. */
  statementIds?: string[];
}) {
  if (!functions) throw new Error("Firebase Functions no esta configurado en este entorno.");
  const callable = httpsCallable<
    typeof input,
    {
      ok: true;
      lineas: Array<{
        statementId: string;
        amount: number;
        period?: string;
        concept?: string;
        unitLabel?: string;
        deuda: number;
      }>;
      sobrante: number;
      sobranteSeraAnticipo: boolean;
    }
  >(functions, "previewPaymentAllocation");
  return executeCallable(callable, input, "No fue posible calcular el reparto.");
}

// ── FLOW-002 · anticipos ─────────────────────────────────────────────────────
//
// Las tres van por callable y no por escritura directa porque tocan
// `advances`, `advanceApplications` y `billingStatements` a la vez dentro de una
// transacción, y porque las reglas no dejan al cliente escribir ni una: es
// dinero. Leer anticipos sí es directo — ver `use-advances.ts`.

/**
 * **Cruza un anticipo contra un cargo (R6).**
 *
 * `amount` es lo que se PIDE aplicar, no necesariamente lo que se aplica: §5.3
 * lo limita al saldo del cargo y devuelve el resto al anticipo, así que la
 * pantalla tiene que enseñar `appliedAmount` y no el importe que envió. Un cruce
 * mayor que el saldo **no se rechaza**; lo que se rechaza es cruzar contra un
 * cargo ya saldado, que no es un límite sino una operación sin efecto (CF12).
 *
 * **Cruzar no mueve dinero**: no se escribe ningún asiento de libro y no se toca
 * `paymentAmount`. El ingreso se registró cuando el anticipo entró (R5). Lo
 * cruzado sube `advanceAppliedAmount`, que solo escribe el servidor (R4).
 *
 * `operationKey` es la idempotencia: la genera quien llama y **la repite en los
 * reintentos**. Una clave nueva por intento anula la protección.
 */
export async function applyAdvanceCallable(input: {
  tenantId: string;
  advanceId: string;
  statementId: string;
  amount: number;
  /** ISO `YYYY-MM-DD`. */
  date: string;
  operationKey: string;
}) {
  if (!functions) throw new Error("Firebase Functions no esta configurado en este entorno.");
  const callable = httpsCallable<
    typeof input,
    {
      ok: true;
      /** `false` si ya estaba cruzado con esa clave: fue un reintento. */
      applied: boolean;
      applicationId: string;
      /** Lo que de verdad se aplicó, que puede ser menos de lo pedido (§5.3). */
      appliedAmount: number;
      remaining: number;
      advanceStatus: "open" | "applied" | "cancelled";
      balance: number;
      status: "paid" | "overdue" | "pending";
    }
  >(functions, "applyAdvance");
  return executeCallable(callable, input, "No fue posible cruzar el anticipo.");
}

/**
 * **Deshace un cruce (CA12).** El anticipo vuelve a `open` con su remanente.
 *
 * Se identifica por el CRUCE, no por el anticipo: un anticipo puede tener
 * varios, y deshacer «el del anticipo» sería ambiguo.
 *
 * `operationKey` es la de ESTA operación y **tiene que ser distinta** de la del
 * cruce; si no, la marca del cruce se confundiría con la de su reverso.
 */
export async function undoAdvanceApplicationCallable(input: {
  tenantId: string;
  applicationId: string;
  operationKey: string;
  reason?: string;
}) {
  if (!functions) throw new Error("Firebase Functions no esta configurado en este entorno.");
  const callable = httpsCallable<
    typeof input,
    {
      ok: true;
      reversed: boolean;
      remaining: number;
      advanceStatus: "open" | "applied" | "cancelled";
      balance: number;
      status: "paid" | "overdue" | "pending";
    }
  >(functions, "undoAdvanceApplication");
  return executeCallable(callable, input, "No fue posible deshacer el cruce.");
}

/**
 * **Anula un anticipo con motivo (R9).** Terminal: de `cancelled` no se sale.
 *
 * `reason` es obligatorio y el servidor lo exige (CF4). Va al registro de
 * auditoría: es la única forma de saber después por qué el saldo a favor de un
 * residente dejó de existir.
 *
 * **Solo si el remanente está intacto.** Un anticipo parcialmente cruzado se
 * rechaza (CF3): primero se deshacen los cruces.
 *
 * **Anular NO devuelve el dinero y NO baja el ingreso.** El dinero entró y se
 * queda en el conjunto; lo que desaparece es el crédito de esa unidad.
 * Devolverlo es un egreso, y §4 lo deja fuera de esta ficha a propósito.
 * Revertir el PAGO que lo creó es otra cosa y sí revierte los dos asientos (R15).
 */
export async function cancelAdvanceCallable(input: {
  tenantId: string;
  advanceId: string;
  reason: string;
  operationKey: string;
}) {
  if (!functions) throw new Error("Firebase Functions no esta configurado en este entorno.");
  const callable = httpsCallable<typeof input, { ok: true; cancelled: boolean }>(functions, "cancelAdvance");
  return executeCallable(callable, input, "No fue posible anular el anticipo.");
}

export async function updateSupportTicketStatusCallable(input: {
  ticketId: string;
  status?: string;
  priority?: string;
  /** SUP-001. `null` desasigna; omitirlo deja la asignación como esté. */
  assignedTo?: string | null;
  assignedToName?: string;
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
 * **Manda el `tenantId` ACTIVO, y el servidor lo comprueba contra la
 * membresía.** Este comentario decía lo contrario —«la puerta rechaza cualquier
 * llamada que lo traiga, aunque coincida»— y era correcto hasta el selector de
 * `PLAT-002`: desde entonces el claim significa «el último conjunto conocido»,
 * así que no mandarlo dejaba a la IA trabajando sobre el conjunto equivocado.
 * Lo que protege no es el rechazo, es la membresía.
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
    { operationKey: string; input: RedactarComunicacionInput; tenantId?: string },
    RedactarComunicacionResult
  >(functions, "aiInvoke");
  return executeCallable(
    callable,
    { operationKey: "comunicaciones-redactar", input, tenantId: conjuntoActivo() },
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

/**
 * Un trozo del borrador que la comprobación del servidor marcó, con su
 * posición dentro de `draftResponse`. Es lo que permite resaltar la frase
 * DENTRO del texto en vez de avisar al lado — el aviso general se probó con
 * una persona el 16 de agosto de 2026 y publicó el borrador literal igual.
 *
 * Viaja en el sobre y no en `output` a propósito: `output` es el esquema de la
 * operación y ese esquema se le manda al modelo dentro del prompt. El servidor
 * calcula esto después, sobre la salida ya validada.
 */
export interface FraseMarcadaPqrs {
  marca: "afirma_accion";
  /** El texto literal, tal y como está en el borrador. */
  texto: string;
  desde: number;
  hasta: number;
}

export interface AsistirTicketPqrsResult {
  output: AsistenciaPqrs;
  cuotaRestante: CuotaRestante;
  recorte: RecorteAsistencia;
  /**
   * Opcional porque el frente y las functions no se despliegan juntos: el
   * frente sale con el push a `develop` y las functions a mano. Mientras el
   * servidor sirva la versión anterior, este campo no llega — y la pantalla
   * tiene que comportarse como antes, no romperse.
   */
  frasesMarcadas?: FraseMarcadaPqrs[];
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
 * Sí manda `tenantId`, y solo eso: el conjunto ACTIVO, que el servidor
 * comprueba contra la membresía. Decía «sale de la sesión» y con el selector de
 * `PLAT-002` la sesión dejó de caber en el claim. Cuando falla, el mensaje ya
 * viene escrito para la persona.
 */
export async function asistirTicketPqrsCallable(ticketId: string) {
  if (!functions) throw new Error("Firebase Functions no esta configurado en este entorno.");
  const callable = httpsCallable<{ ticketId: string; tenantId?: string }, AsistirTicketPqrsResult>(
    functions,
    "asistirTicketPqrs",
  );
  return executeCallable(
    callable,
    { ticketId, tenantId: conjuntoActivo() },
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
    const cuerpo = { ...input, tenantId: conjuntoActivo() };
    const callable = httpsCallable<typeof cuerpo, { ok: true }>(functions, "registrarFeedbackIa");
    const result = await callable(cuerpo);
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
 * **Manda el `tenantId` ACTIVO**, y el servidor lo comprueba contra la
 * membresía. Antes salía del claim del servidor; desde el selector de
 * `PLAT-002` el claim ya no es el conjunto en el que se trabaja, así que la
 * medición se le cargaba a otro cliente.
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
  /**
   * La FORMA del archivo, nunca su contenido — decisión de David del 1 de
   * septiembre de 2026 para acumular corpus de `AI-ONB-001` sin reversar §7 de
   * `PRD-V-FEAT-002`. Sale de `formaDelArchivo`, que es quien tiene la puerta
   * que impide mandar texto libre. Solo en `inicio`: describen el archivo, no
   * lo que la persona acabó eligiendo.
   */
  filasDePreambulo?: number;
  unidadPartida?: boolean;
  valoresNoReconocidos?: string[];
  /** Campos alimentados con más de una columna (`PRD-V-FEAT-006`, `CA9`). */
  camposUnidos?: number;
  importadas?: number;
  omitidas?: number;
}): Promise<{ ok: boolean }> {
  if (!functions) return { ok: false };
  try {
    const cuerpo = { ...input, tenantId: conjuntoActivo() };
    const callable = httpsCallable<typeof cuerpo, { ok: boolean }>(functions, "registrarImportacion");
    const result = await callable(cuerpo);
    return { ok: Boolean(result.data?.ok) };
  } catch {
    return { ok: false };
  }
}

// ── PRD-V-FLOW-004 · el expediente de conciliación ───────────────────────────
//
// **Estas cuatro sustituyen a `matchLine` y `unmatchLine`, que escribían desde
// el navegador sin comprobar nada.** Es la razón entera de la ficha: en
// producción hay una salida de banco de −300.000 casada contra una entrada de
// +40.000 porque el cliente escribía lo que se le pidiera. La regla le cierra
// ese camino (R8), y la aritmética la comprueba el servidor, que es el único
// que puede leer los dos documentos a la vez y negarse.

export type ReconcileCaseInput = {
  tenantId: string;
  bankStatementLineId: string;
  ledgerEntryId: string;
  expectedVersion?: number;
};

export async function reconcileCaseCallable(input: ReconcileCaseInput) {
  if (!functions) {
    throw new Error("Firebase Functions no esta configurado en este entorno.");
  }
  const callable = httpsCallable<ReconcileCaseInput, { ok: true; applied: boolean; status: string; version: number }>(
    functions,
    "reconcileCase",
  );
  return executeCallable(callable, input, "No fue posible conciliar esa línea.");
}

export type RejectReconciliationCaseInput = {
  tenantId: string;
  bankStatementLineId: string;
  motivoCodigo: string;
  motivoTexto?: string;
  expectedVersion?: number;
};

export async function rejectReconciliationCaseCallable(input: RejectReconciliationCaseInput) {
  if (!functions) {
    throw new Error("Firebase Functions no esta configurado en este entorno.");
  }
  const callable = httpsCallable<RejectReconciliationCaseInput, { ok: true; status: string; version: number }>(
    functions,
    "rejectReconciliationCase",
  );
  return executeCallable(callable, input, "No fue posible descartar esa línea.");
}

export async function reopenReconciliationCaseCallable(input: {
  tenantId: string;
  bankStatementLineId: string;
  expectedVersion?: number;
}) {
  if (!functions) {
    throw new Error("Firebase Functions no esta configurado en este entorno.");
  }
  const callable = httpsCallable<
    { tenantId: string; bankStatementLineId: string; expectedVersion?: number },
    { ok: true; status: string; version: number }
  >(functions, "reopenReconciliationCase");
  return executeCallable(callable, input, "No fue posible reabrir ese caso.");
}

/**
 * R7, el camino del cliente. **Se llama ANTES de anular o borrar un asiento**,
 * no después: la regla impide tocar un asiento conciliado, así que sin esta
 * llamada el ciclo automático de egresos se caería con un error de permisos que
 * se lee como un problema de rol y no de conciliación.
 */
export async function releaseReconciliationCallable(input: { tenantId: string; ledgerEntryId: string }) {
  if (!functions) {
    throw new Error("Firebase Functions no esta configurado en este entorno.");
  }
  const callable = httpsCallable<{ tenantId: string; ledgerEntryId: string }, { ok: true; released: boolean }>(
    functions,
    "releaseReconciliation",
  );
  return executeCallable(callable, input, "No fue posible liberar la conciliación de ese movimiento.");
}

/**
 * `CA1` — asegura que cada línea de una cuenta tenga su expediente. **La llama
 * el importador al terminar**: el cliente no puede escribir casos (R8), así que
 * sin esto una línea recién importada se quedaba sin expediente hasta que
 * alguien la tocara.
 */
export async function ensureReconciliationCasesCallable(input: { tenantId: string; bankAccountId?: string }) {
  if (!functions) {
    throw new Error("Firebase Functions no esta configurado en este entorno.");
  }
  const callable = httpsCallable<
    { tenantId: string; bankAccountId?: string },
    { ok: true; created: number; lines: number; truncated: boolean }
  >(functions, "ensureReconciliationCases");
  return executeCallable(callable, input, "No fue posible crear los expedientes de las líneas importadas.");
}

// ── PRD-V-FLOW-007 entrega 2 · el informe económico mensual ──────────────────
//
// **Ninguna de las cuatro manda una cifra.** Solo el conjunto y el período (o el
// informe). El servidor recalcula y sella: si los números viajaran desde aquí, el
// administrador emitiría el que quisiera, y `issuedBy` en un documento con
// sanción legal detrás no puede depender de lo que escriba un navegador.

export type MonthlyReportInput = { tenantId: string; period: string };

/** Rehace el borrador del período con los asientos de hoy. Solo sobre `borrador`. */
export async function regenerateMonthlyReportCallable(input: MonthlyReportInput) {
  if (!functions) {
    throw new Error("Firebase Functions no esta configurado en este entorno.");
  }
  const callable = httpsCallable<MonthlyReportInput, { ok: true; reportId: string }>(
    functions,
    "regenerateMonthlyReport",
  );
  return executeCallable(callable, input, "No fue posible generar el borrador del informe.");
}

/** Congela las cifras, sella el firmante y archiva el PDF. `created: false` = reintento. */
export async function issueMonthlyReportCallable(input: MonthlyReportInput) {
  if (!functions) {
    throw new Error("Firebase Functions no esta configurado en este entorno.");
  }
  const callable = httpsCallable<MonthlyReportInput, { ok: true; reportId: string; created: boolean }>(
    functions,
    "issueMonthlyReport",
  );
  return executeCallable(callable, input, "No fue posible emitir el informe.");
}

export type SignMonthlyReportInput = { tenantId: string; reportId: string };

/**
 * Deja constancia de la aprobación. **El nombre y el cargo NO viajan**: los lee el
 * servidor de la membresía, porque si vinieran de aquí cualquiera firmaría como
 * presidente del consejo mandando ese texto.
 */
export async function signMonthlyReportCallable(input: SignMonthlyReportInput) {
  if (!functions) {
    throw new Error("Firebase Functions no esta configurado en este entorno.");
  }
  const callable = httpsCallable<SignMonthlyReportInput, { ok: true; yaFirmado: boolean }>(
    functions,
    "signMonthlyReport",
  );
  return executeCallable(callable, input, "No fue posible firmar el informe.");
}

export type VoidMonthlyReportInput = {
  tenantId: string;
  reportId: string;
  /** `RN-06` · obligatorio, y el servidor lo exige además del formulario (`CA16`). */
  reason: string;
};

export async function voidMonthlyReportCallable(input: VoidMonthlyReportInput) {
  if (!functions) {
    throw new Error("Firebase Functions no esta configurado en este entorno.");
  }
  const callable = httpsCallable<VoidMonthlyReportInput, { ok: true; yaAnulado: boolean }>(
    functions,
    "voidMonthlyReport",
  );
  return executeCallable(callable, input, "No fue posible anular el informe.");
}
