import { logClientErrorCallable } from "@/lib/firebase/callables";

// G4 · Observabilidad (lado cliente).
// logError envía un error no controlado a la Cloud Function `logClientError`,
// que lo persiste en `errorLogs` (visible para el superadmin). Es best-effort:
// nunca lanza, deduplica en memoria y limita el volumen para no inundar.

const recent = new Set<string>();

export async function logError(message: string, context?: string, stack?: string): Promise<void> {
  try {
    const msg = (message || "").trim();
    if (!msg) return;

    // Dedup simple en memoria por mensaje+contexto (evita ráfagas del mismo error).
    const key = `${msg}|${context ?? ""}`;
    if (recent.has(key)) return;
    recent.add(key);
    if (recent.size > 50) recent.clear();

    await logClientErrorCallable({
      message: msg.slice(0, 2000),
      stack: stack?.slice(0, 8000),
      context,
      url: typeof window !== "undefined" ? window.location.href : undefined,
      severity: "error",
    });
  } catch {
    // Best-effort: el monitoreo nunca debe romper el flujo del usuario.
  }
}
