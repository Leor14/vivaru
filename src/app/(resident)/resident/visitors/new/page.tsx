"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { toastFirebaseError } from "@/lib/utils/error-handler";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { TimeSelect } from "@/components/ui/TimeSelect";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/features/auth/auth-context";
import { createResidentInvitation } from "@/features/visitors/invitations";
import { useVisitorsVariant } from "@/features/visitors/use-visitors-variant";
import {
  CATEGORIAS_DE_UNIDAD,
  DIAS_DE_LA_SEMANA,
  MESES_MAXIMOS_DEL_FRECUENTE_DEL_RESIDENTE,
  normalizarHorario,
  ultimoDiaPermitidoDelResidente,
  ventanaDelFrecuente,
  type DiaDeLaSemana,
} from "@/features/visitors/frecuente";
import {
  combineDateAndTime,
  isDateTimeValid,
  toDateInputValue,
} from "@/utils/datetimeValidation";

/**
 * `L-08b` (18 sep 2026): **dos formas de invitar.** Una *visita* es de un solo día —la de varios
 * días creaba un pase que la portería veía solo el primero—; un *visitante frecuente* vale de una
 * fecha a otra (hasta 12 meses), con días de la semana y franja opcionales.
 */
const invitationFormSchema = z
  .object({
    tipo: z.enum(["visita", "frecuente"]),
    firstName: z.string().min(2, "Ingresa el nombre."),
    lastName: z.string().min(2, "Ingresa el apellido."),
    visitorIdentification: z.string().min(3, "La identificacion es obligatoria."),
    plate: z.string().optional(),
    visitReason: z.string().min(3, "Describe la razon de visita."),
    adultsCount: z.number().int().min(0, "No puede ser negativo."),
    childrenCount: z.number().int().min(0, "No puede ser negativo."),
    allowedUses: z.number().int().min(1, "Debe permitir al menos un uso."),
    // Visita
    visitDate: z.string().optional(),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    // Frecuente
    categoria: z.enum(["familiar", "servicio", "otro"]),
    validFrom: z.string().optional(),
    validUntil: z.string().optional(),
    dias: z.array(z.number().int().min(0).max(6)),
    franjaDesde: z.string().optional(),
    franjaHasta: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.tipo === "visita") {
      if (!value.visitDate) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Selecciona la fecha.", path: ["visitDate"] });
        return;
      }
      if (!value.startTime) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Selecciona hora de inicio.", path: ["startTime"] });
        return;
      }
      if (!value.endTime) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Selecciona hora de fin.", path: ["endTime"] });
        return;
      }
      const startAt = combineDateAndTime(value.visitDate, value.startTime);
      const endAt = combineDateAndTime(value.visitDate, value.endTime);
      if (!startAt || !endAt || Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "La fecha/hora no es válida.", path: ["visitDate"] });
        return;
      }
      if (!isDateTimeValid(startAt, "visitor")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "La invitación debe registrarse con al menos 15 minutos de anticipación.",
          path: ["startTime"],
        });
      }
      if (endAt <= startAt) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "La hora de fin debe ser posterior al inicio.", path: ["endTime"] });
      }
      return;
    }

    if (!value.validFrom) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Selecciona desde cuándo.", path: ["validFrom"] });
      return;
    }
    if (!value.validUntil) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Selecciona hasta cuándo.", path: ["validUntil"] });
      return;
    }
    if (value.validUntil < value.validFrom) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "La fecha final debe ser posterior a la inicial.", path: ["validUntil"] });
    }
    if (value.validUntil > ultimoDiaPermitidoDelResidente(value.validFrom)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Puedes autorizarlo hasta por ${MESES_MAXIMOS_DEL_FRECUENTE_DEL_RESIDENTE} meses.`,
        path: ["validUntil"],
      });
    }
    if (Boolean(value.franjaDesde) !== Boolean(value.franjaHasta)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Indica la hora de entrada y la de salida, o ninguna.", path: ["franjaHasta"] });
    } else if (value.franjaDesde && value.franjaHasta && value.franjaHasta <= value.franjaDesde) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "La hora de salida debe ser posterior a la de entrada.", path: ["franjaHasta"] });
    }
  });

type InvitationFormInput = z.input<typeof invitationFormSchema>;
type InvitationFormValues = z.output<typeof invitationFormSchema>;

export default function ResidentVisitorsNewPage() {
  const router = useRouter();
  const { user } = useAuth();
  const visitorsVariant = useVisitorsVariant(user?.tenantId);
  const [saving, setSaving] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<InvitationFormInput, undefined, InvitationFormValues>({
    resolver: zodResolver(invitationFormSchema),
    defaultValues: {
      tipo: "visita",
      adultsCount: 1,
      childrenCount: 0,
      allowedUses: 1,
      categoria: "servicio",
      dias: [],
    },
  });

  const tipo = watch("tipo");
  const visitDate = watch("visitDate");
  const startTime = watch("startTime");
  const validFrom = watch("validFrom");
  const dias = watch("dias") ?? [];
  const nowDateTime = new Date();
  const minDateValue = toDateInputValue(nowDateTime);

  const liveDateTimeError = useMemo(() => {
    if (tipo !== "visita" || !visitDate || !startTime) return null;
    const startAt = combineDateAndTime(visitDate, startTime);
    if (!startAt || !isDateTimeValid(startAt, "visitor", nowDateTime)) {
      return "La invitación debe registrarse con al menos 15 minutos de anticipación.";
    }
    return null;
  }, [tipo, visitDate, startTime, nowDateTime]);

  function alternarDia(dia: DiaDeLaSemana) {
    const actuales = getValues("dias") ?? [];
    setValue(
      "dias",
      actuales.includes(dia) ? actuales.filter((d) => d !== dia) : [...actuales, dia],
      { shouldDirty: true },
    );
  }

  async function onSubmit(values: InvitationFormValues) {
    if (!user?.tenantId || !user.unitId) {
      toast.error("No se pudo resolver el tenant o la unidad del residente.");
      return;
    }

    const horario =
      values.tipo === "frecuente"
        ? normalizarHorario({ dias: values.dias, desde: values.franjaDesde, hasta: values.franjaHasta })
        : undefined;
    const ventana =
      values.tipo === "frecuente"
        ? ventanaDelFrecuente(values.validFrom ?? "", values.validUntil ?? "", horario)
        : {
            startAt: new Date(`${values.visitDate}T${values.startTime}`),
            endAt: new Date(`${values.visitDate}T${values.endTime}`),
          };

    if (values.tipo === "visita" && !isDateTimeValid(ventana.startAt, "visitor")) {
      toast.error("La invitación debe registrarse con al menos 15 minutos de anticipación.");
      return;
    }

    setSaving(true);
    try {
      const id = await createResidentInvitation({
        tenantId: user.tenantId,
        unitId: user.unitId,
        unitLabel: user.unitLabel,
        residentUserId: user.uid,
        authorizedByName: user.fullName,
        visitorName: `${values.firstName.trim()} ${values.lastName.trim()}`,
        visitorIdentification: values.visitorIdentification.trim(),
        plate: values.plate?.trim(),
        visitReason: values.visitReason.trim(),
        adultsCount: values.adultsCount,
        childrenCount: values.childrenCount,
        allowedUses: values.tipo === "frecuente" ? 1 : values.allowedUses,
        startAt: ventana.startAt,
        endAt: ventana.endAt,
        ...(values.tipo === "frecuente" ? { frecuente: { categoria: values.categoria, horario } } : {}),
      });

      toast.success("Invitación creada correctamente.");
      router.push(`/resident/visitors/${id}`);
    } catch (error) {
      toastFirebaseError(error);
    } finally {
      setSaving(false);
    }
  }

  if (visitorsVariant === "registro_simple") {
    return (
      <section className="space-y-4">
        <Card>
          <CardTitle className="text-xl">Las invitaciones no están disponibles</CardTitle>
          <CardDescription className="mt-1">
            En este conjunto la portería registra las visitas al llegar y te notifica automáticamente.
            No necesitas crear invitaciones ni generar códigos QR.
          </CardDescription>
          <div className="mt-4">
            <Link href="/resident/visitors">
              <Button>Ver mis visitas</Button>
            </Link>
          </div>
        </Card>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <Card>
        <p className="text-xs font-medium tracking-wide text-[var(--slate-500)] uppercase">Visitantes / Paso 1 de 3</p>
        <CardTitle className="mt-1 text-xl">Crear invitación</CardTitle>
        <CardDescription className="mt-1">
          Registra los datos del visitante y define la vigencia para generar su acceso.
        </CardDescription>
      </Card>

      <Card>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-[var(--slate-700)]">Tipo de invitación</legend>
            <div className="grid gap-2 sm:grid-cols-2" role="radiogroup">
              {(
                [
                  { valor: "visita", titulo: "Visita", ayuda: "Un solo día, con hora de llegada y de salida." },
                  { valor: "frecuente", titulo: "Visitante frecuente", ayuda: "Entra varios días: empleada, niñera, familiar…" },
                ] as const
              ).map((opcion) => (
                <label
                  key={opcion.valor}
                  className={`cursor-pointer rounded-xl border p-3 text-sm ${
                    tipo === opcion.valor
                      ? "border-[var(--brand-600)] bg-[var(--brand-50)]"
                      : "border-[var(--slate-300)] bg-[var(--surface-strong)]"
                  }`}
                >
                  <input type="radio" value={opcion.valor} className="sr-only" {...register("tipo")} />
                  <span className="block font-medium text-[var(--slate-900)]">{opcion.titulo}</span>
                  <span className="mt-0.5 block text-xs text-[var(--slate-600)]">{opcion.ayuda}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-3 md:grid-cols-2">
            <Input label="Nombre" {...register("firstName")} error={errors.firstName?.message} />
            <Input label="Apellido" {...register("lastName")} error={errors.lastName?.message} />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Input
              label="Identificación"
              {...register("visitorIdentification")}
              error={errors.visitorIdentification?.message}
            />
            <Input label="Placa (opcional)" {...register("plate")} error={errors.plate?.message} />
          </div>

          <Textarea
            label="Razón de visita / observaciones"
            {...register("visitReason")}
            error={errors.visitReason?.message}
          />

          <div className={`grid gap-3 ${tipo === "visita" ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
            <Input
              type="number"
              min={0}
              label="Adultos"
              {...register("adultsCount", { valueAsNumber: true })}
              error={errors.adultsCount?.message}
            />
            <Input
              type="number"
              min={0}
              label="Niños"
              {...register("childrenCount", { valueAsNumber: true })}
              error={errors.childrenCount?.message}
            />
            {tipo === "visita" ? (
              <Input
                type="number"
                min={1}
                label="Usos permitidos"
                {...register("allowedUses", { valueAsNumber: true })}
                error={errors.allowedUses?.message}
              />
            ) : null}
          </div>

          {tipo === "visita" ? (
            <div className="grid gap-3 md:grid-cols-3">
              <Input type="date" min={minDateValue} label="Fecha" {...register("visitDate")} error={errors.visitDate?.message} />
              <TimeSelect label="Hora de llegada" {...register("startTime")} error={errors.startTime?.message} />
              <TimeSelect label="Hora de salida" {...register("endTime")} error={errors.endTime?.message} />
            </div>
          ) : (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-[var(--slate-700)]">
                Categoría
                <select
                  className="mt-1 h-10 w-full rounded-xl border border-[var(--slate-300)] bg-[var(--surface-strong)] px-3 text-sm"
                  {...register("categoria")}
                >
                  {CATEGORIAS_DE_UNIDAD.map((c) => (
                    <option key={c.valor} value={c.valor}>{c.etiqueta}</option>
                  ))}
                </select>
              </label>
              <div className="grid gap-3 md:grid-cols-2">
                <Input type="date" min={minDateValue} label="Desde" {...register("validFrom")} error={errors.validFrom?.message} />
                <Input
                  type="date"
                  min={validFrom || minDateValue}
                  max={validFrom ? ultimoDiaPermitidoDelResidente(validFrom) : undefined}
                  label="Hasta"
                  {...register("validUntil")}
                  error={errors.validUntil?.message}
                />
              </div>
              <fieldset>
                <legend className="mb-1 text-sm font-medium text-[var(--slate-700)]">Días que viene</legend>
                <p className="mb-2 text-xs text-[var(--slate-500)]">Si no marcas ninguno, puede entrar todos los días.</p>
                <div className="flex flex-wrap gap-2">
                  {DIAS_DE_LA_SEMANA.map((dia) => {
                    const marcado = dias.includes(dia.valor);
                    return (
                      <button
                        key={dia.valor}
                        type="button"
                        aria-pressed={marcado}
                        onClick={() => alternarDia(dia.valor)}
                        className={`h-9 min-w-12 rounded-full border px-3 text-sm ${
                          marcado
                            ? "border-[var(--brand-600)] bg-[var(--brand-50)] font-medium text-[var(--brand-900)]"
                            : "border-[var(--slate-300)] bg-[var(--surface-strong)] text-[var(--slate-700)]"
                        }`}
                      >
                        {dia.corto}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
              <div className="grid gap-3 md:grid-cols-2">
                <TimeSelect label="Entra desde (opcional)" {...register("franjaDesde")} error={errors.franjaDesde?.message} />
                <TimeSelect label="Hasta (opcional)" {...register("franjaHasta")} error={errors.franjaHasta?.message} />
              </div>
              <p className="text-xs text-[var(--slate-500)]">
                La portería verá los días y el horario, y un aviso si llega fuera de ellos. Puedes cancelarlo cuando quieras.
              </p>
            </div>
          )}
          {liveDateTimeError ? <p className="text-xs text-[var(--danger-700)]">{liveDateTimeError}</p> : null}

          <div className="flex flex-wrap gap-2 pt-2">
            <Link href="/resident/visitors">
              <Button type="button" variant="outline">Cancelar</Button>
            </Link>
            <Button type="submit" disabled={saving || Boolean(liveDateTimeError)}>{saving ? "Guardando..." : "Crear invitación"}</Button>
          </div>
        </form>
      </Card>
    </section>
  );
}