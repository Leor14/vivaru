"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, FileQuestion, HelpCircle, Loader2, MapPin, Rocket, Sparkles } from "lucide-react";
import { doc, getDoc } from "firebase/firestore";
import { toast } from "sonner";

import { Modal } from "@/components/shared/modal";
import { Button } from "@/components/ui/button";
import { PhoneField, composePhone } from "@/components/ui/phone-field";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/features/auth/auth-context";
import { countryByCode } from "@/lib/countries";
import { requestAdvisorContactCallable } from "@/lib/firebase/callables";
import { db } from "@/lib/firebase/client";
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

/**
 * Lo ÚNICO que no sabemos ya. Nombre, correo, conjunto, ciudad, país,
 * teléfono y número de unidades vienen del registro y viajan solos en el
 * correo al asesor: volver a pedirlos sería fricción y, peor, invitaría a que
 * el prospecto escriba algo distinto de lo que ya tenemos guardado.
 *
 * El cargo sí importa y no lo tenemos: le dice al asesor si está hablando con
 * quien decide o con quien tendrá que convencer a un comité.
 */
const CARGOS = [
  "Administrador(a) del conjunto",
  "Miembro del comité o consejo",
  "Empresa administradora",
  "Propietario o residente",
  "Otro",
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
  // El indicativo arranca en el país del conjunto (se ajusta al leerlo abajo).
  // «MX» es el respaldo, no la suposición: si el tenant trae país válido, gana.
  const [paisTel, setPaisTel] = useState("MX");
  const [horario, setHorario] = useState(HORARIOS[3]);
  const [cargo, setCargo] = useState(CARGOS[0]);
  const [ubicacion, setUbicacion] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  // Se lee al abrir, no al montar: el diálogo vive en el shell y no vale una
  // consulta por cada carga de pantalla.
  useEffect(() => {
    if (!open || !user?.tenantId || !db) return;
    let vivo = true;
    void getDoc(doc(db, "tenants", user.tenantId)).then((snap) => {
      if (!vivo) return;
      const d = snap.data() as { city?: string; country?: string } | undefined;
      setUbicacion([d?.city, d?.country].filter(Boolean).join(", ") || null);
      // Solo se adopta si es un código que el catálogo reconoce: algunos
      // tenants guardan el país como nombre («México») y no como ISO, y un
      // indicativo equivocado es peor que el de por defecto.
      const iso = d?.country?.trim().toUpperCase();
      if (iso && countryByCode(iso)) setPaisTel(iso);
    }).catch(() => setUbicacion(null));
    return () => {
      vivo = false;
    };
  }, [open, user?.tenantId]);

  async function handleSend() {
    if (!user?.tenantId) return;
    setSending(true);
    try {
      await requestAdvisorContactCallable({
        tenantId: user.tenantId,
        motivo: MOTIVOS.find((m) => m.value === motivo)?.label ?? motivo,
        mensaje: mensaje.trim() || undefined,
        // Sale en E.164 («+525500000000»). Antes iba tal cual lo escribieran,
        // así que el asesor recibía números sin indicativo que no podía marcar.
        telefono: composePhone(paisTel, telefono),
        horarioPreferido: horario,
        cargo,
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
              className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--brand-700)] text-[var(--on-fill)]"
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
          <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-3xl bg-[var(--success-50)] text-[var(--success-600)]">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-semibold tracking-tight text-[var(--slate-900)]">
            Recibimos tu solicitud
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-[var(--slate-600)]">
            Un asesor de Vivaru <strong>te contactará</strong> para definir contigo la
            contratación. Mientras tanto puedes seguir usando tu ambiente con normalidad.
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
                        : "border-[var(--slate-200)] bg-[var(--surface-strong)] hover:border-[var(--brand-200)] hover:bg-[var(--surface-soft)]",
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

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--brand-700)]">
              Tu rol en el conjunto
            </span>
            <select
              className="mt-1.5 h-10 w-full rounded-xl border border-[var(--slate-300)] bg-[var(--surface-strong)] px-3 text-sm"
              value={cargo}
              onChange={(e) => setCargo(e.target.value)}
            >
              {CARGOS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>

          <div className="grid gap-3 sm:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
            <div>
              {/* La etiqueta apunta al número, no envuelve al grupo: un <label>
                  que contiene dos controles se asocia al primero —el botón del
                  indicativo, que ya trae su propio aria-label— y deja el campo
                  del número sin nombre accesible. */}
              <label
                htmlFor="advisor-tel"
                // leading-5 iguala la caja de línea de las etiquetas vecinas,
                // que son <span> en línea dentro de un <label> de 20px. Sin
                // esto la fila del teléfono queda 4px más alta que la de al lado.
                className="block text-xs font-semibold uppercase leading-5 tracking-wide text-[var(--brand-700)]"
              >
                Teléfono <span className="normal-case text-[var(--slate-500)]">(si prefieres otro)</span>
              </label>
              <PhoneField
                id="advisor-tel"
                country={paisTel}
                number={telefono}
                onCountryChange={setPaisTel}
                onNumberChange={setTelefono}
              />
            </div>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-[var(--brand-700)]">
                ¿Cuándo te llamamos?
              </span>
              <select
                className="mt-1.5 h-10 w-full rounded-xl border border-[var(--slate-300)] bg-[var(--surface-strong)] px-3 text-sm"
                value={horario}
                onChange={(e) => setHorario(e.target.value)}
              >
                {HORARIOS.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </label>
          </div>

          {/* Mostrar en vez de preguntar: estos datos ya se dieron al registrarse
              y viajan solos. Se enseñan para que nada vaya a espaldas del
              usuario y pueda detectar un error, no para que los reescriba. */}
          <div className="rounded-xl border border-[var(--slate-200)] bg-[var(--surface-soft)] p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--brand-700)]">
              Enviamos esto contigo
            </p>
            <dl className="mt-2 grid gap-x-4 gap-y-1.5 text-xs sm:grid-cols-2">
              <div className="flex gap-2">
                <dt className="shrink-0 text-[var(--slate-500)]">Nombre</dt>
                <dd className="truncate font-medium text-[var(--slate-800)]">
                  {user?.fullName ?? "—"}
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="shrink-0 text-[var(--slate-500)]">Correo</dt>
                <dd className="truncate font-medium text-[var(--slate-800)]">{user?.email ?? "—"}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="shrink-0 text-[var(--slate-500)]">Conjunto</dt>
                <dd className="truncate font-medium text-[var(--slate-800)]">
                  {user?.tenantName ?? "—"}
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="shrink-0 text-[var(--slate-500)]">
                  <MapPin className="mt-0.5 inline h-3 w-3" aria-hidden /> Ubicación
                </dt>
                <dd className="truncate font-medium text-[var(--slate-800)]">{ubicacion ?? "—"}</dd>
              </div>
            </dl>
            <p className="mt-2.5 text-xs leading-relaxed text-[var(--slate-600)]">
              Tu asesor también verá cómo configuraste tu conjunto, así que la conversación arranca
              con contexto. ¿Algo no cuadra? Corrígelo en Configuración → Conjunto.
            </p>
          </div>

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
