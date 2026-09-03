"use client";

import { ChevronLeft, ChevronRight, Truck } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { toastFirebaseError } from "@/lib/utils/error-handler";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils/cn";
import { createMudanzaReservation } from "@/features/reservations/use-reservations";
import { combineDateAndTime, getMinAllowedDateTime, isDateTimeValid } from "@/utils/datetimeValidation";

type MudanzaWizardProps = {
  tenantId: string;
  userId: string;
  createdByName?: string;
  unitId: string;
  unitLabel: string;
  onSuccess?: () => void;
};

type Step = 1 | 2 | 3;

function StepIndicator({ current }: { current: Step }) {
  const steps = [
    { id: 1 as Step, label: "Fecha y horario" },
    { id: 2 as Step, label: "Pago de deposito" },
    { id: 3 as Step, label: "Confirmacion" },
  ];
  return (
    <ol className="flex items-center gap-2" aria-label="Progreso del wizard">
      {steps.map((step, index) => {
        const isActive = step.id === current;
        const isDone = step.id < current;
        return (
          <li key={step.id} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                isActive
                  ? "bg-[var(--brand-700)] text-[var(--on-fill)]"
                  : isDone
                    ? "bg-[var(--brand-200)] text-[var(--brand-900)]"
                    : "bg-[var(--slate-200)] text-[var(--slate-700)]",
              )}
              aria-current={isActive ? "step" : undefined}
            >
              {step.id}
            </span>
            <span
              className={cn(
                "hidden text-xs sm:block",
                isActive ? "font-semibold text-[var(--slate-900)]" : "text-[var(--slate-600)]",
              )}
            >
              {step.label}
            </span>
            {index < steps.length - 1 ? (
              <span
                className={cn(
                  "h-px flex-1",
                  isDone ? "bg-[var(--brand-700)]" : "bg-[var(--slate-200)]",
                )}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

export function MudanzaWizard({
  tenantId,
  userId,
  createdByName,
  unitId,
  unitLabel,
  onSuccess,
}: MudanzaWizardProps) {
  const [step, setStep] = useState<Step>(1);
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("12:00");
  const [requiresElevator, setRequiresElevator] = useState(true);
  const [depositPaid, setDepositPaid] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const minDateAttribute = useMemo(() => {
    const minDateTime = getMinAllowedDateTime("reservation");
    return minDateTime.toISOString().slice(0, 10);
  }, []);

  function validateStep1(): string | null {
    if (!date) return "Selecciona la fecha de la mudanza.";
    if (!startTime || !endTime) return "Selecciona el rango horario.";
    if (endTime <= startTime) return "La hora de fin debe ser posterior a la de inicio.";
    const startDateTime = combineDateAndTime(date, startTime);
    if (!startDateTime) return "Fecha u hora invalida.";
    if (!isDateTimeValid(startDateTime, "reservation")) {
      return "Selecciona una hora con al menos 30 minutos de anticipacion.";
    }
    return null;
  }

  function validateStep2(): string | null {
    if (depositPaid) {
      const amount = Number(depositAmount);
      if (!Number.isFinite(amount) || amount <= 0) {
        return "Ingresa un monto valido para el deposito.";
      }
    }
    return null;
  }

  function handleNext() {
    if (step === 1) {
      const err = validateStep1();
      if (err) {
        toast.error(err);
        return;
      }
      setStep(2);
    } else if (step === 2) {
      const err = validateStep2();
      if (err) {
        toast.error(err);
        return;
      }
      setStep(3);
    }
  }

  function handlePrev() {
    if (step === 2) setStep(1);
    else if (step === 3) setStep(2);
  }

  async function handleSubmit() {
    if (!confirmed) {
      toast.error("Confirma los datos antes de enviar la solicitud.");
      return;
    }
    setSubmitting(true);
    try {
      await createMudanzaReservation({
        tenantId,
        userId,
        createdByName,
        unitId,
        unitLabel,
        date,
        startTime,
        endTime,
        requiresElevator,
        depositPaid,
        depositAmount: depositPaid ? Number(depositAmount) : undefined,
        additionalNotes: additionalNotes.trim() || undefined,
      });
      toast.success("Solicitud de mudanza enviada. La administracion la revisara.");
      // Reset state
      setStep(1);
      setDate("");
      setStartTime("08:00");
      setEndTime("12:00");
      setRequiresElevator(true);
      setDepositPaid(false);
      setDepositAmount("");
      setAdditionalNotes("");
      setConfirmed(false);
      onSuccess?.();
    } catch (error) {
      toastFirebaseError(error);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <div className="flex items-center gap-2">
        <Truck className="h-4 w-4 text-[var(--brand-700)]" />
        <CardTitle>Solicitud de mudanza</CardTitle>
      </div>
      <CardDescription className="mt-1">
        Completa los tres pasos para enviar tu solicitud. La administracion validara la disponibilidad.
      </CardDescription>

      <div className="mt-4">
        <StepIndicator current={step} />
      </div>

      <div className="mt-5 space-y-4">
        {step === 1 ? (
          <div className="space-y-3">
            <label className="block text-sm text-[var(--slate-700)]">
              Fecha
              <Input
                type="date"
                value={date}
                min={minDateAttribute}
                onChange={(event) => setDate(event.target.value)}
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm text-[var(--slate-700)]">
                Hora de inicio
                <Input
                  type="time"
                  value={startTime}
                  onChange={(event) => setStartTime(event.target.value)}
                />
              </label>
              <label className="block text-sm text-[var(--slate-700)]">
                Hora de fin
                <Input
                  type="time"
                  value={endTime}
                  onChange={(event) => setEndTime(event.target.value)}
                />
              </label>
            </div>
            <label className="flex items-start gap-2 text-sm text-[var(--slate-700)]">
              <input
                type="checkbox"
                className="mt-1"
                checked={requiresElevator}
                onChange={(event) => setRequiresElevator(event.target.checked)}
              />
              <span>Requiero uso exclusivo del ascensor de carga</span>
            </label>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-3">
            <p className="text-sm text-[var(--slate-700)]">
              Algunas administraciones requieren un deposito reembolsable. Indica si ya realizaste el pago.
            </p>
            <label className="flex items-start gap-2 text-sm text-[var(--slate-700)]">
              <input
                type="checkbox"
                className="mt-1"
                checked={depositPaid}
                onChange={(event) => setDepositPaid(event.target.checked)}
              />
              <span>Ya pague el deposito de mudanza</span>
            </label>
            {depositPaid ? (
              <label className="block text-sm text-[var(--slate-700)]">
                Monto del deposito (COP)
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={depositAmount}
                  onChange={(event) => setDepositAmount(event.target.value)}
                  placeholder="200000"
                />
              </label>
            ) : null}
            <label className="block text-sm text-[var(--slate-700)]">
              Notas adicionales
              <Textarea
                value={additionalNotes}
                onChange={(event) => setAdditionalNotes(event.target.value)}
                placeholder="Empresa de mudanzas, vehiculo, contacto..."
                rows={3}
              />
            </label>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-3">
            <p className="text-sm text-[var(--slate-700)]">Revisa los datos antes de enviar:</p>
            <dl className="grid grid-cols-2 gap-3 rounded-xl border border-[var(--slate-200)] bg-[var(--surface-soft)] p-3 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wide text-[var(--slate-500)]">Fecha</dt>
                <dd className="mt-0.5 text-[var(--slate-900)]">{date || "-"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-[var(--slate-500)]">Horario</dt>
                <dd className="mt-0.5 text-[var(--slate-900)]">{startTime} - {endTime}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-[var(--slate-500)]">Ascensor de carga</dt>
                <dd className="mt-0.5 text-[var(--slate-900)]">{requiresElevator ? "Si" : "No"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-[var(--slate-500)]">Deposito</dt>
                <dd className="mt-0.5 text-[var(--slate-900)]">
                  {depositPaid ? `Pagado (${depositAmount || "monto sin definir"})` : "Pendiente"}
                </dd>
              </div>
              {additionalNotes.trim() ? (
                <div className="col-span-2">
                  <dt className="text-xs uppercase tracking-wide text-[var(--slate-500)]">Notas</dt>
                  <dd className="mt-0.5 whitespace-pre-wrap text-[var(--slate-900)]">{additionalNotes.trim()}</dd>
                </div>
              ) : null}
            </dl>
            <label className="flex items-start gap-2 text-sm text-[var(--slate-700)]">
              <input
                type="checkbox"
                className="mt-1"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
              />
              <span>Confirmo que los datos son correctos y acepto las condiciones de mudanza del edificio.</span>
            </label>
          </div>
        ) : null}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={handlePrev}
          disabled={step === 1 || submitting}
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Atras
        </Button>
        {step < 3 ? (
          <Button type="button" onClick={handleNext}>
            Siguiente
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        ) : (
          <Button type="button" onClick={() => void handleSubmit()} disabled={!confirmed || submitting}>
            {submitting ? "Enviando..." : "Enviar solicitud"}
          </Button>
        )}
      </div>
    </Card>
  );
}
