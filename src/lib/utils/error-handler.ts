import { toast } from "sonner";

/**
 * Un error de callable **cuyo mensaje ya está en lenguaje de usuario**.
 *
 * Lo lanza `executeCallable` (`src/lib/firebase/callables.ts`) después de sacar
 * el mensaje que escribió el servidor. Existe para que ese mensaje se distinga
 * de una excepción cualquiera: enseñar el texto de un error interno al
 * administrador es peor que no enseñar nada, así que **solo pasan los que están
 * marcados como escritos para leerse**.
 *
 * **El defecto que cierra, medido en staging el 24 de agosto de 2026.** El
 * servidor devolvía «Ese cruce ya se deshizo», `executeCallable` lo componía
 * bien, lo envolvía en un `Error` plano — y `normalizeFirebaseError` lo tiraba,
 * porque un `Error` plano no tiene `code` y caía en el genérico. En pantalla se
 * leía «Ocurrió un error inesperado. Intenta de nuevo.»
 *
 * Afectaba a **todas** las llamadas del producto, no solo a los anticipos, y no
 * lo cazó ninguna suite: las pruebas comprueban que el servidor lanza el error
 * correcto, y nadie miraba qué se pintaba. Salió de abrir la pantalla.
 */
export class CallableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CallableError";
  }
}

/**
 * Translates any Firebase error (Firestore SDK or Cloud Functions) to a
 * user-friendly Spanish message. Strips namespace prefixes ("firestore/",
 * "functions/", etc.) before looking up the code.
 */
export function normalizeFirebaseError(error: unknown): string {
  // Ya viene traducido y con el matiz del servidor —qué cruce deshacer, qué
  // cargo bloquea—, que es justo lo que el mapa de códigos de abajo no puede
  // saber. `failed-precondition` a secas dice «no se cumplen las condiciones»,
  // que no le sirve a nadie.
  if (error instanceof CallableError && error.message) return error.message;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawCode = (error as any)?.code ?? "";
  const code = typeof rawCode === "string" ? rawCode.replace(/^[a-z-]+\//, "") : "";

  const messages: Record<string, string> = {
    // Firebase Auth (login): sin estos códigos, una credencial incorrecta se
    // mostraba como "error inesperado" y parecía una caída de la plataforma.
    "invalid-credential":        "Correo o contraseña incorrectos.",
    "invalid-login-credentials": "Correo o contraseña incorrectos.",
    "wrong-password":            "Correo o contraseña incorrectos.",
    "user-not-found":            "No existe una cuenta con ese correo.",
    "invalid-email":             "El correo no tiene un formato válido.",
    "user-disabled":             "Esta cuenta está desactivada. Contacta a la administración.",
    "too-many-requests":         "Demasiados intentos. Espera unos minutos e intenta de nuevo.",
    "network-request-failed":    "Sin conexión con el servidor. Revisa tu internet e intenta de nuevo.",
    "permission-denied":   "No tienes permiso para realizar esta acción.",
    "unauthenticated":     "Tu sesión ha expirado. Vuelve a iniciar sesión.",
    "not-found":           "No se encontró la información solicitada.",
    "already-exists":      "Este registro ya existe.",
    "unavailable":         "El servicio no está disponible. Intenta de nuevo.",
    "failed-precondition": "No se cumplen las condiciones para esta acción.",
    "invalid-argument":    "Los datos enviados no son válidos.",
    "internal":            "Ocurrió un error interno. Intenta de nuevo.",
    "resource-exhausted":  "Demasiadas solicitudes. Espera un momento.",
    "cancelled":           "La operación fue cancelada.",
    "deadline-exceeded":   "La operación tardó demasiado. Intenta de nuevo.",
    "data-loss":           "Error de datos. Contacta al soporte.",
    "aborted":             "La operación fue interrumpida. Intenta de nuevo.",
  };

  return messages[code] ?? "Ocurrió un error inesperado. Intenta de nuevo.";
}

/**
 * Convenience wrapper: translates a Firebase error and shows it via Sonner toast.
 */
export function toastFirebaseError(error: unknown): void {
  toast.error(normalizeFirebaseError(error));
}
