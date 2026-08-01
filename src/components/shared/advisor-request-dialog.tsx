"use client";

import { useState } from "react";
import { CheckCircle2, FileQuestion, HelpCircle, Loader2, Rocket, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Modal } from "@/components/shared/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/features/auth/auth-context";
import { requestAdvisorContactCallable } from "@/lib/firebase/callables";
import { cn } from "@/lib/utils/cn";

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
 * de contacto**; nada de lo que se marque aquí activa nada por sí solo. Por eso
 * el texto dice desde el principio que sigue una llamada: el botón que trae
 * aquí promete "Inicia tu suscripción", y llegar a un formulario sin avisar se
 * sentiría como un cambio de trato.
 */

const MOTIVOS = [
  {
    value: "contratar",
    label: "Quiero contratar Vivaru",
    hint: "Ya lo probé y quiero dejarlo operando.",
    icon: Rocket,
  },
  {
    value: "info",
    label: "Necesito más información",
    hint: "Tengo dudas antes de decidir.",
    icon: HelpCircle,
  },
  {
    value: "implementacion",
    label: "Dudas de implementación",
    hint: "Cómo migrar mis datos y arrancar.",
    icon: FileQuestion,
  },
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
    <Modal
      open={open}
      title=""
      header={
        sent ? undefined : (
          <div className="flex min-w-0 items-start gap-3">
            <span
              className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--brand-700)] text-white"
              aria-hidden
            >
              <Sparkles className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h3 className="text-lg font-semibold tracking-tight text-[var(--brand-900)]">
                Inicia tu suscripción
              </h3>
              <p className="mt-0.5 text-sm text-[var(--slate-600)]">
                Déjanos tus datos y un asesor te llama para definir el alcance y dejar tu conjunto
                operando por completo. Sin compromiso.
              </p>
            </div>
          </div>
        )
      }
      onClose={sending ? () => undefined : handleClose}
    >
      {sent ? (
        <div className="py-4 text-center">
          <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-3xl bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-semibold tracking-tight text-[var(--slate-900)]">
            Recibimos tu solicitud
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-[var(--slate-600)]">
            Un asesor de Vivaru te contacta en menos de <strong>24 horas hábiles</strong> para
            definir contigo la contratación. Mientras tanto puedes seguir usando tu ambiente con
            normalidad.
          </p>
          <Button className="mt-5" onClick={handleClose}>
            Entendido
          </Button>
        </div>
      ) : (
        <div className="space-y-4 text-sm text-[var(--slate-700)]">
          <fieldset>
            <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--brand-700)]">
              ¿En qué te ayudamos?
            </legend>
            {/* Tarjetas y no un desplegable: son tres opciones, caben a la vista,
                y cada una puede explicarse en una línea. Un select esconde las
                alternativas justo cuando el usuario está decidiendo. */}
            <div className="grid gap-2 sm:grid-cols-3">
              {MOTIVOS.map((option) => {
                const selected = motivo === option.value;
                const OptionIcon = option.icon;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setMotivo(option.value)}
                    aria-pressed={selected}
                    className={cn(
                      "flex h-full flex-col gap-1.5 rounded-2xl border p-3 text-left",
                      "[transition:border-color_180ms_var(--ease-out),background-color_180ms_var(--ease-out),box-shadow_180ms_var(--ease-out),transform_140ms_var(--ease-out)]",
                      "active:scale-[0.98] motion-reduce:transform-none",
                      selected
                        ? "border-[var(--brand-700)] bg-[var(--brand-50)] shadow-[0_0_0_1px_var(--brand-700)]"
                        : "border-[var(--slate-200)] bg-white hover:border-[var(--brand-200)] hover:bg-[var(--surface-soft)]",
                    )}
                  >
                    <OptionIcon
                      className={cn(
                        "h-4.5 w-4.5",
                        selected ? "text-[var(--brand-700)]" : "text-[var(--slate-500)]",
                      )}
                      aria-hidden
                    />
                    <span
                      className={cn(
                        "text-sm font-semibold leading-snug",
                        selected ? "text-[var(--brand-900)]" : "text-[var(--slate-900)]",
                      )}
                    >
                      {option.label}
                    </span>
                    <span className="text-xs leading-snug text-[var(--slate-600)]">{option.hint}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--brand-700)]">
              Cuéntanos más <span className="normal-case text-[var(--slate-500)]">(opcional)</span>
            </span>
            <Textarea
              className="mt-1.5"
              rows={3}
              value={mensaje}
              onChange={(e) => setMensaje(e.target.value)}
              placeholder="Ej: somos 3 torres con 180 unidades y queremos empezar con cartera y comunicados."
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-[var(--brand-700)]">
                Teléfono de contacto
              </span>
              <Input
                className="mt-1.5"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="+52 55 0000 0000"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-[var(--brand-700)]">
                ¿Cuándo te llamamos?
              </span>
              <select
                className="mt-1.5 h-10 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm"
                value={horario}
                onChange={(e) => setHorario(e.target.value)}
              >
                {HORARIOS.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </label>
          </div>

          <p className="rounded-xl bg-[var(--surface-soft)] p-3 text-xs leading-relaxed text-[var(--slate-600)]">
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
