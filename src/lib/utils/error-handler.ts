import { toast } from "sonner";

/**
 * Translates any Firebase error (Firestore SDK or Cloud Functions) to a
 * user-friendly Spanish message. Strips namespace prefixes ("firestore/",
 * "functions/", etc.) before looking up the code.
 */
export function normalizeFirebaseError(error: unknown): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawCode = (error as any)?.code ?? "";
  const code = typeof rawCode === "string" ? rawCode.replace(/^[a-z-]+\//, "") : "";

  const messages: Record<string, string> = {
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
