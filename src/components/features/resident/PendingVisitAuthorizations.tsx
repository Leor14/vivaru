"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { estadoDeAutorizacion, segundosRestantes } from "@/features/visitors/autorizacion";
import { db } from "@/lib/firebase/client";
import { resolveVisitAuthorizationCallable } from "@/lib/firebase/callables";
import { toastFirebaseError } from "@/lib/utils/error-handler";

/**
 * `PRD-V-FLOW-005` — **la decisión, en el teléfono del residente.**
 *
 * Hay una persona esperando en la puerta mientras esto se lee: es el único aviso del producto con
 * alguien parado al otro lado. Por eso el panel va arriba del todo y no dentro de un detalle.
 *
 * **Solo se pinta si hay algo que decidir.** Un panel permanente que casi siempre está vacío
 * entrena a no mirarlo, y este hay que mirarlo en cinco minutos.
 */

type PaseDeAutorizacion = {
  id: string;
  visitorName: string;
  documentNumber: string;
  authorizationStatus?: string;
  authorizationRequestedAt?: string;
};

function comoIso(valor: unknown): string | undefined {
  if (typeof valor === "string") return valor;
  const t = valor as { toDate?: () => Date } | undefined;
  return typeof t?.toDate === "function" ? t.toDate().toISOString() : undefined;
}

export function PendingVisitAuthorizations({ tenantId, unitId }: { tenantId?: string; unitId?: string }) {
  const [pases, setPases] = useState<PaseDeAutorizacion[]>([]);
  const [resolviendo, setResolviendo] = useState<string | null>(null);

  /**
   * **El reloj como estado.** Sin él la cuenta atrás se congela hasta que cambie algún documento,
   * y aquí lo que se enseña es precisamente cuánto queda.
   */
  const [ahoraMs, setAhoraMs] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setAhoraMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!tenantId || !unitId || !db) {
      setPases([]);
      return;
    }
    // **Sin `orderBy` a propósito.** Un `orderBy` DESCARTA los documentos que no traen ese campo,
    // sin error y sin aviso — es lo que dejó la lista de documentos del residente diciendo «Sin
    // documentos» teniendo ocho. Se filtra y ordena en memoria, que aquí son unos pocos.
    return onSnapshot(
      query(collection(db, "visitorPasses"), where("tenantId", "==", tenantId), where("unitId", "==", unitId)),
      (snap) => {
        setPases(
          snap.docs
            .map((d) => {
              const raw = d.data();
              return {
                id: d.id,
                visitorName: String(raw.visitorName ?? ""),
                documentNumber: String(raw.documentNumber ?? ""),
                authorizationStatus: typeof raw.authorizationStatus === "string" ? raw.authorizationStatus : undefined,
                authorizationRequestedAt: comoIso(raw.authorizationRequestedAt),
              };
            })
            .filter((p) => p.authorizationStatus === "pendiente"),
        );
      },
      () => setPases([]),
    );
  }, [tenantId, unitId]);

  // El estado real se DERIVA: una petición de hace una hora ya está expirada aunque su documento
  // siga diciendo «pendiente», porque nadie corre nada para cambiarlo.
  const porDecidir = useMemo(
    () =>
      pases.filter(
        (p) =>
          estadoDeAutorizacion(
            p.authorizationStatus,
            p.authorizationRequestedAt ? Date.parse(p.authorizationRequestedAt) : null,
            ahoraMs,
          ) === "pendiente",
      ),
    [pases, ahoraMs],
  );

  async function decidir(pase: PaseDeAutorizacion, decision: "autorizar" | "rechazar") {
    if (resolviendo || !tenantId) return;
    setResolviendo(pase.id);
    try {
      const res = await resolveVisitAuthorizationCallable({
        tenantId,
        visitorPassId: pase.id,
        decision,
      });
      // **`aplicada: false` no es un error**: alguien de la unidad contestó primero. Decirlo como
      // fallo convertiría una carrera normal en algo que parece roto.
      toast.success(
        res.aplicada
          ? decision === "autorizar"
            ? "Autorizada. Puede pasar."
            : "Rechazada. Se lo decimos a portería."
          : `${res.resueltaPor} ya había respondido.`,
      );
    } catch (e) {
      toastFirebaseError(e);
    } finally {
      setResolviendo(null);
    }
  }

  if (!tenantId || porDecidir.length === 0) return null;

  return (
    <Card className="border-2 border-[var(--amber-300)] bg-[var(--amber-50)]/60 p-5">
      <CardTitle>Alguien te visita ahora</CardTitle>
      <CardDescription className="mt-1">Está en portería esperando tu respuesta.</CardDescription>

      <div className="mt-4 space-y-3">
        {porDecidir.map((pase) => {
          const restan = segundosRestantes(
            pase.authorizationRequestedAt ? Date.parse(pase.authorizationRequestedAt) : null,
            ahoraMs,
          );
          return (
            <div key={pase.id} className="rounded-2xl border border-[var(--amber-200)] bg-[var(--surface-strong)] p-4">
              <p className="text-base font-semibold text-[var(--slate-900)]">{pase.visitorName}</p>
              <p className="text-xs text-[var(--slate-600)]">
                Documento {pase.documentNumber || "—"} · quedan{" "}
                <span className="font-medium tabular-nums">
                  {Math.floor(restan / 60)}:{String(restan % 60).padStart(2, "0")}
                </span>
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button
                  className="w-full bg-[var(--relleno-exito)] text-[var(--on-fill)] hover:bg-[var(--relleno-exito-hover)]"
                  disabled={resolviendo === pase.id}
                  onClick={() => void decidir(pase, "autorizar")}
                >
                  {resolviendo === pase.id ? "..." : "Autorizar"}
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={resolviendo === pase.id}
                  onClick={() => void decidir(pase, "rechazar")}
                >
                  Rechazar
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
