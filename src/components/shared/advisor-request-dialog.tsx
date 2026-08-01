"use client";

import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Modal } from "@/components/shared/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/features/auth/auth-context";
import { requestAdvisorContactCallable } from "@/lib/firebase/callables";

/**
 * Solicitud de contacto comercial desde el portal.
 *
 * Reemplaza al `mailto:` anterior, que dependía de tener un cliente de correo
 * configurado y perdía por completo lo que el administrador quería decir. Aquí
 * el mensaje y los datos quedan registrados, el equipo recibe el contexto del
 * ambiente, y el lead pasa a **calificado** — el evento más valioso del funnel.
 *
 * OJO al modelo de negocio: Vivaru NO se activa por módulos sueltos ni tiene
 * planes que el usuario elija. La contratación es del servicio completo y se
 * cierra hablando con una persona. Este formulario **solo recoge la solicitud
 * de contacto**; nada de lo que se marque aquí activa nada por sí solo.
 */

const MOTIVOS = [
  { value: "contratar", label: "Quiero contratar Vivaru para mi conjunto" },
  { value: "info", label: "Necesito más información antes de decidir" },
  { value: "implementacion", label: "Tengo dudas sobre la implementación" },
  { value: "mas_tiempo", label: "Necesito más tiempo de prueba" },
  { value: "comite", label: "Debo presentarlo al comité o a la asamblea" },
];

const HORARIOS = ["Mañana (9–12)", "Mediodía (12–15)", "Tarde (15–18)", "Cualquier horario"];

export function AdvisorRequestDialog({
  open,
  onClose,
  motivoInicial = "contratar",
}: {
  open: boolean;
  onClose: () => void;
  motivoInicial?: string;
}) {
  const { user } = useAuth();
  const [motivo, setMotivo] = useState(motivoInicial);
  const [mensaje, setMensaje] = useState("");
  const [telefono, setTelefono] = useState("");
  const [horario, setHorario] = useState(HORARIOS[3]);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSend() {
    if (!user?.tenantId) return;
    setSending(true);
    try {
      await requestAdvisorContactCallable({
        tenantId: user.tenantId,
        motivo: MOTIVOS.find((m) => m.value === motivo)?.label ?? motivo,
        mensaje: mensaje.trim() || undefined,
        telefono: telefono.trim() || undefined,
        horarioPreferido: horario,
      });
      setSent(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No fue posible enviar tu solicitud.");
    } finally {
      setSending(false);
    }
  }

  function handleClose() {
    onClose();
    // Se reinicia después de cerrar para que no parpadee el formulario.
    setTimeout(() => {
      setSent(false);
      setMensaje("");
    }, 200);
  }

  return (
    <Modal open={open} title={sent ? "" : "Hablemos de tu conjunto"} onClose={sending ? () => undefined : handleClose}>
      {sent ? (
        <div className="py-2 text-center">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <h2 className="text-lg font-semibold text-[var(--slate-900)]">Recibimos tu solicitud</h2>
          <p className="mt-2 text-sm text-[var(--slate-600)]">
            Un asesor de Vivaru te contacta en menos de <strong>24 horas hábiles</strong> para
            definir contigo la contratación. Mientras tanto puedes seguir usando tu ambiente con
            normalidad.
          </p>
          <Button className="mt-5" onClick={handleClose}>
            Entendido
          </Button>
        </div>
      ) : (
        <div className="space-y-3 text-sm text-[var(--slate-700)]">
          <p className="text-[var(--slate-600)]">
            Déjanos tus datos y un asesor te contacta para acompañarte en la contratación y dejar
            tu conjunto operando por completo. Sin compromiso.
          </p>

          <label className="block">
            ¿En qué te ayudamos?
            <select
              className="mt-1 h-10 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            >
              {MOTIVOS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </label>

          <label className="block">
            Cuéntanos más <span className="text-[var(--slate-400)]">(opcional)</span>
            <Textarea
              className="mt-1"
              rows={3}
              value={mensaje}
              onChange={(e) => setMensaje(e.target.value)}
              placeholder="Ej: somos 3 torres con 180 unidades y queremos empezar con cartera y comunicados."
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              Teléfono de contacto
              <Input
                className="mt-1"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="+52 55 0000 0000"
              />
            </label>
            <label className="block">
              ¿Cuándo te llamamos?
              <select
                className="mt-1 h-10 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm"
                value={horario}
                onChange={(e) => setHorario(e.target.value)}
              >
                {HORARIOS.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </label>
          </div>

          <p className="rounded-xl bg-[var(--surface-soft)] p-3 text-xs text-[var(--slate-600)]">
            Escribimos a <strong>{user?.email ?? "tu correo"}</strong>. Tu asesor ya verá cómo
            configuraste tu conjunto, así que la conversación arranca con contexto — y define
            contigo el alcance y las condiciones del servicio.
          </p>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={handleClose} disabled={sending}>
              Ahora no
            </Button>
            <Button onClick={() => void handleSend()} disabled={sending}>
              {sending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando…
                </>
              ) : (
                "Solicitar contacto"
              )}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
