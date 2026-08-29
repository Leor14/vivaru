"use client";

// Invitación a activar los avisos push (PRD-V-PLAT-005 §5). No modal, y con
// tres mundos que distinguir ANTES de enseñar un botón: donde hay Push API se
// invita a activar; en iPhone/iPad sin instalar se explica añadir a inicio (el
// permiso ahí ni existe); y con el permiso denegado no se insiste (R5).

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/auth-context";
import { useFeatureFlag } from "@/lib/feature-flags/provider";
import { estadoDeSoportePush, registrarDispositivo, type SoportePush } from "@/lib/push/registro";

// «Ahora no» silencia 14 días (R5: silencia, no insiste). localStorage es
// conveniencia por dispositivo: si no está disponible, la invitación vuelve.
const CLAVE_APLAZADO = "vivaru-push-aplazado-hasta";
const DIAS_DE_SILENCIO = 14;

function aplazadoAhora(): boolean {
  try {
    const hasta = Number(window.localStorage.getItem(CLAVE_APLAZADO) ?? "0");
    return Date.now() < hasta;
  } catch {
    return false;
  }
}

function aplazar() {
  try {
    const hasta = Date.now() + DIAS_DE_SILENCIO * 24 * 60 * 60 * 1000;
    window.localStorage.setItem(CLAVE_APLAZADO, String(hasta));
  } catch {
    // Sin almacenamiento no hay silencio que guardar; se convive con ello.
  }
}

export function PushOptInBanner() {
  const { user } = useAuth();
  const encendida = useFeatureFlag("producto-notificaciones-push");
  const [soporte, setSoporte] = useState<SoportePush | null>(null);
  const [oculto, setOculto] = useState(false);
  const [registrando, setRegistrando] = useState(false);

  useEffect(() => {
    // El soporte se decide en cliente; en SSR no existe window.
    if (!encendida) return;
    if (aplazadoAhora()) return;
    const estado = estadoDeSoportePush();
    // Con el permiso YA concedido no se invita: se re-registra en silencio,
    // que es lo que cura la rotación del token sin molestar a nadie.
    if (estado === "soportado" && Notification.permission === "granted") {
      if (user?.uid && user?.tenantId) {
        void registrarDispositivo({ uid: user.uid, tenantId: user.tenantId });
      }
      return;
    }
    setSoporte(estado);
  }, [encendida, user?.uid, user?.tenantId]);

  if (!encendida || oculto || !user?.uid || !user?.tenantId) return null;
  if (soporte === null || soporte === "denegado" || soporte === "sin-soporte") return null;

  const activar = async () => {
    if (!user.tenantId) return;
    setRegistrando(true);
    try {
      await registrarDispositivo({ uid: user.uid, tenantId: user.tenantId });
    } catch (e) {
      console.error("[push] registro", e);
    } finally {
      setRegistrando(false);
      setOculto(true);
    }
  };

  const ahoraNo = () => {
    aplazar();
    setOculto(true);
  };

  return (
    <div className="mb-4 flex flex-col gap-3 rounded-lg border border-[var(--brand-200)] bg-[var(--brand-50)] p-4 sm:flex-row sm:items-center sm:justify-between">
      {soporte === "ios-sin-instalar" ? (
        <>
          <p className="text-sm text-[var(--brand-800)]">
            <span className="font-semibold">Recibe los avisos en tu iPhone.</span> Añade Vivaru a
            tu pantalla de inicio: toca <span className="font-semibold">Compartir</span> y luego{" "}
            <span className="font-semibold">Añadir a pantalla de inicio</span>. Al abrirla desde
            ahí podrás activar las notificaciones.
          </p>
          <Button variant="ghost" size="sm" onClick={ahoraNo}>
            Entendido
          </Button>
        </>
      ) : (
        <>
          <p className="text-sm text-[var(--brand-800)]">
            <span className="font-semibold">Activa los avisos en este dispositivo</span> y entérate
            de cobros, paquetes y respuestas sin tener que entrar a mirar.
          </p>
          <div className="flex shrink-0 gap-2">
            <Button size="sm" onClick={activar} disabled={registrando}>
              {registrando ? "Activando…" : "Activar"}
            </Button>
            <Button variant="ghost" size="sm" onClick={ahoraNo} disabled={registrando}>
              Ahora no
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
