"use client";

import { useEffect } from "react";

import { logError } from "@/lib/observability/log-error";

// G4 · Observabilidad: registra errores no controlados del navegador
// (errores sueltos y promesas rechazadas) hacia `errorLogs`. Best-effort.
export function ErrorTracker() {
  useEffect(() => {
    function onError(event: ErrorEvent) {
      void logError(event.message || "window.onerror", "window.error", event.error?.stack);
    }
    function onRejection(event: PromiseRejectionEvent) {
      const reason = event.reason;
      const message = reason instanceof Error ? reason.message : String(reason);
      const stack = reason instanceof Error ? reason.stack : undefined;
      void logError(message || "unhandledrejection", "unhandledrejection", stack);
    }

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
