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
  combineDateAndTime,
  isDateTimeValid,
  toDateInputValue,
} from "@/utils/datetimeValidation";

const invitationFormSchema = z
  .object({
    firstName: z.string().min(2, "Ingresa el nombre."),
    lastName: z.string().min(2, "Ingresa el apellido."),
    visitorIdentification: z.string().min(3, "La identificacion es obligatoria."),
    plate: z.string().optional(),
    visitReason: z.string().min(3, "Describe la razon de visita."),
    adultsCount: z.number().int().min(0, "No puede ser negativo."),
    childrenCount: z.number().int().min(0, "No puede ser negativo."),
    allowedUses: z.number().int().min(1, "Debe permitir al menos un uso."),
    startDate: z.string().min(1, "Selecciona fecha de inicio."),
    startTime: z.string().min(1, "Selecciona hora de inicio."),
    endDate: z.string().min(1, "Selecciona fecha de fin."),
    endTime: z.string().min(1, "Selecciona hora de fin."),
  })
  .superRefine((value, ctx) => {
    const startAt = combineDateAndTime(value.startDate, value.startTime);
    const endAt = combineDateAndTime(value.endDate, value.endTime);
    if (!startAt || !endAt || Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "La fecha/hora no es válida.",
        path: ["endDate"],
      });
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
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "La fecha/hora de fin debe ser posterior al inicio.",
        path: ["endDate"],
      });
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
    formState: { errors },
  } = useForm<InvitationFormInput, undefined, InvitationFormValues>({
    resolver: zodResolver(invitationFormSchema),
    defaultValues: {
      adultsCount: 1,
      childrenCount: 0,
      allowedUses: 1,
    },
  });

  const startDate = watch("startDate");
  const startTime = watch("startTime");
  const nowDateTime = new Date();
  const minDateValue = toDateInputValue(nowDateTime);

  const liveDateTimeError = useMemo(() => {
    if (!startDate || !startTime) return null;
    const startAt = combineDateAndTime(startDate, startTime);
    if (!startAt || !isDateTimeValid(startAt, "visitor", nowDateTime)) {
      return "La invitación debe registrarse con al menos 15 minutos de anticipación.";
    }
    return null;
  }, [startDate, startTime, nowDateTime]);

  async function onSubmit(values: InvitationFormValues) {
    if (!user?.tenantId || !user.unitId) {
      toast.error("No se pudo resolver el tenant o la unidad del residente.");
      return;
    }

    const selectedDateTime = combineDateAndTime(values.startDate, values.startTime);
    if (!selectedDateTime || !isDateTimeValid(selectedDateTime, "visitor")) {
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
        allowedUses: values.allowedUses,
        startAt: new Date(`${values.startDate}T${values.startTime}`),
        endAt: new Date(`${values.endDate}T${values.endTime}`),
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

          <div className="grid gap-3 md:grid-cols-3">
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
            <Input
              type="number"
              min={1}
              label="Usos permitidos"
              {...register("allowedUses", { valueAsNumber: true })}
              error={errors.allowedUses?.message}
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Input type="date" min={minDateValue} label="Fecha inicio" {...register("startDate")} error={errors.startDate?.message} />
            <TimeSelect label="Hora inicio" {...register("startTime")} error={errors.startTime?.message} />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Input type="date" min={startDate || minDateValue} label="Fecha fin" {...register("endDate")} error={errors.endDate?.message} />
            <TimeSelect label="Hora fin" {...register("endTime")} error={errors.endTime?.message} />
          </div>
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