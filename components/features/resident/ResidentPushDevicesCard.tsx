"use client";

// Dispositivos con avisos activados, en el perfil del residente
// (PRD-V-PLAT-005 §4.5: la baja manual). La consulta filtra userId Y tenantId
// —invariante de la casa— y son dos igualdades: sin índice compuesto. Sin
// orderBy a propósito (patrón watchLedger): se ordena en memoria.

import { useCallback, useEffect, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
} from "firebase/firestore";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/features/auth/auth-context";
import { db } from "@/lib/firebase/client";
import { useFeatureFlag } from "@/lib/feature-flags/provider";
import {
  estadoDeSoportePush,
  limpiarBajaManual,
  marcarBajaManual,
  registrarDispositivo,
} from "@/lib/push/registro";

interface Dispositivo {
  token: string;
  platform: string;
  creadoMs: number;
}

const ETIQUETA: Record<string, string> = {
  android: "Android",
  ios: "iPhone / iPad",
  desktop: "Computador",
  otro: "Dispositivo",
};

export function ResidentPushDevicesCard() {
  const { user } = useAuth();
  const encendida = useFeatureFlag("producto-notificaciones-push");
  const [dispositivos, setDispositivos] = useState<Dispositivo[] | null>(null);
  const [borrando, setBorrando] = useState<string | null>(null);
  const [activable, setActivable] = useState(false);
  const [activando, setActivando] = useState(false);

  const cargar = useCallback(async () => {
    if (!db || !user?.uid || !user?.tenantId) return;
    const snap = await getDocs(
      query(
        collection(db, "pushTokens"),
        where("userId", "==", user.uid),
        where("tenantId", "==", user.tenantId),
      ),
    );
    const filas = snap.docs
      .map((d) => ({
        token: d.id,
        platform: String(d.data().platform ?? "otro"),
        creadoMs:
          (d.data().createdAt as { toMillis?: () => number } | null)?.toMillis?.() ?? 0,
      }))
      .sort((a, b) => b.creadoMs - a.creadoMs);
    setDispositivos(filas);
  }, [user?.uid, user?.tenantId]);

  useEffect(() => {
    if (!encendida) return;
    void cargar();
    // El botón de activar solo tiene sentido donde el permiso puede pedirse:
    // aquí mismo (soportado). En iOS sin instalar la explicación vive en el
    // banner del portal, no en esta tarjeta.
    setActivable(estadoDeSoportePush() === "soportado");
  }, [encendida, cargar]);

  if (!encendida || !user?.tenantId) return null;

  const darDeBaja = async (token: string) => {
    if (!db) return;
    setBorrando(token);
    try {
      await deleteDoc(doc(db, "pushTokens", token));
      // La marca evita que el re-registro silencioso del banner resucite el
      // dispositivo al relanzar la app: la baja fue una decisión (CA9).
      marcarBajaManual();
      await cargar();
    } catch (e) {
      console.error("[push] baja de dispositivo", e);
    } finally {
      setBorrando(null);
    }
  };

  const activarAqui = async () => {
    if (!user?.tenantId) return;
    setActivando(true);
    try {
      const token = await registrarDispositivo({ uid: user.uid, tenantId: user.tenantId });
      if (token) limpiarBajaManual();
      await cargar();
    } catch (e) {
      console.error("[push] activar desde el perfil", e);
    } finally {
      setActivando(false);
    }
  };

  return (
    <Card>
      <CardTitle>Avisos en tus dispositivos</CardTitle>
      <CardDescription className="mt-1">
        Dispositivos donde activaste las notificaciones de Vivaru.
      </CardDescription>
      <div className="mt-3 flex flex-col gap-2">
        {dispositivos === null ? (
          <p className="text-sm text-[var(--slate-500)]">Cargando…</p>
        ) : dispositivos.length === 0 ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-[var(--slate-500)]">
              Ninguno todavía. Cuando actives los avisos en un teléfono o computador, aparecerá
              aquí.
            </p>
            {activable && (
              <Button size="sm" onClick={activarAqui} disabled={activando} className="shrink-0">
                {activando ? "Activando…" : "Activar en este dispositivo"}
              </Button>
            )}
          </div>
        ) : (
          dispositivos.map((d) => (
            <div
              key={d.token}
              className="flex items-center justify-between rounded-md border border-[var(--slate-200)] px-3 py-2"
            >
              <div className="text-sm">
                <span className="font-medium">{ETIQUETA[d.platform] ?? ETIQUETA.otro}</span>
                {d.creadoMs > 0 && (
                  <span className="ml-2 text-[var(--slate-500)]">
                    desde {new Date(d.creadoMs).toLocaleDateString("es-CO")}
                  </span>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => darDeBaja(d.token)}
                disabled={borrando === d.token}
              >
                {borrando === d.token ? "Quitando…" : "Quitar"}
              </Button>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
