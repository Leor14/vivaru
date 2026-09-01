"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";

import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import {
  visitasDePorteria,
  type PaseParaHistorial,
  type ConstanciaTono,
} from "@/features/visitors/historial-de-porteria";
import { db } from "@/lib/firebase/client";

/**
 * `PRD-V-FLOW-005`, `CA10` — **las visitas de portería de la unidad, con su constancia.**
 *
 * Es la mitad que le faltaba al portal: el panel «Alguien te visita ahora» enseña lo pendiente y
 * lo resuelto desaparecía sin dejar rastro. La lógica de qué se enseña y con qué texto vive en
 * `src/features/visitors/historial-de-porteria.ts`, que tiene banco propio — aquí solo se
 * suscribe y se pinta.
 *
 * **Sin `orderBy` a propósito**, como el panel de arriba y por la misma trampa: un `orderBy`
 * descarta los documentos que no traen el campo, sin error. Se ordena en memoria.
 */

const TONO_A_CLASE: Record<ConstanciaTono, string> = {
  ok: "text-[var(--slate-600)]",
  rechazo: "font-medium text-[var(--danger-700)]",
  neutro: "text-[var(--slate-500)]",
};

function comoIso(valor: unknown): string | undefined {
  if (typeof valor === "string") return valor;
  const t = valor as { toDate?: () => Date } | undefined;
  return typeof t?.toDate === "function" ? t.toDate().toISOString() : undefined;
}

export function PorterVisitHistory({ tenantId, unitId }: { tenantId?: string; unitId?: string }) {
  const [pases, setPases] = useState<PaseParaHistorial[]>([]);

  // La caducidad se deriva al leer: un «pendiente» viejo pasa al historial solo. Con refrescar el
  // reloj cada 15 s alcanza — aquí no hay cuenta atrás que pintar.
  const [ahoraMs, setAhoraMs] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setAhoraMs(Date.now()), 15_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!tenantId || !unitId || !db) {
      setPases([]);
      return;
    }
    return onSnapshot(
      query(collection(db, "visitorPasses"), where("tenantId", "==", tenantId), where("unitId", "==", unitId)),
      (snap) => {
        setPases(
          snap.docs.map((d) => {
            const raw = d.data();
            return {
              id: d.id,
              visitorName: String(raw.visitorName ?? ""),
              documentNumber: String(raw.documentNumber ?? ""),
              date: typeof raw.date === "string" ? raw.date : undefined,
              scheduledTime: typeof raw.scheduledTime === "string" ? raw.scheduledTime : undefined,
              status: typeof raw.status === "string" ? raw.status : undefined,
              origen: typeof raw.origen === "string" ? raw.origen : undefined,
              authorizationStatus:
                typeof raw.authorizationStatus === "string" ? raw.authorizationStatus : undefined,
              authorizationRequestedAt: comoIso(raw.authorizationRequestedAt),
              authorizationResolvedAt: comoIso(raw.authorizationResolvedAt),
              createdAt: comoIso(raw.createdAt),
              authorizedByName:
                typeof raw.authorizedByName === "string" ? raw.authorizedByName : undefined,
              authorizationMedium:
                typeof raw.authorizationMedium === "string" ? raw.authorizationMedium : undefined,
            };
          }),
        );
      },
      () => setPases([]),
    );
  }, [tenantId, unitId]);

  const visitas = useMemo(() => visitasDePorteria(pases, ahoraMs), [pases, ahoraMs]);

  // Sin visitas de portería no hay sección: en la mayoría de unidades esto estaría siempre vacío
  // y una caja vacía permanente solo enseña a no mirar.
  if (visitas.length === 0) return null;

  return (
    <Card>
      <CardTitle>Visitas registradas en portería</CardTitle>
      <CardDescription className="mt-1">
        Las visitas a tu unidad que llegaron sin aviso, con quién las autorizó y por qué medio.
      </CardDescription>

      <div className="mt-4 space-y-3">
        {visitas.map((v) => (
          <article key={v.id} className="rounded-xl border border-[var(--slate-200)] p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-[var(--slate-900)]">{v.visitorName}</h3>
                <p className="text-sm text-[var(--slate-700)]">Documento: {v.documentNumber}</p>
                <p className="text-sm text-[var(--slate-600)]">
                  {v.fecha}
                  {v.hora ? ` · ${v.hora}` : ""}
                </p>
                <p className={`text-sm ${TONO_A_CLASE[v.constancia.tono]}`}>{v.constancia.texto}</p>
              </div>
              {v.ciclo ? (
                <Badge
                  className={
                    v.ciclo === "dentro"
                      ? "bg-[var(--brand-50)] text-[var(--brand-900)]"
                      : "bg-[var(--slate-200)] text-[var(--slate-700)]"
                  }
                >
                  {v.ciclo === "dentro" ? "Dentro" : "Finalizado"}
                </Badge>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </Card>
  );
}
