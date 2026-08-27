"use client";

import * as React from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Button } from "@/components/marketing/ui/button";
import { Label } from "@/components/marketing/ui/label";
import { cn } from "@/lib/utils/cn";
import { diagnosticSchema, type DiagnosticAnswers } from "@/lib/marketing/diagnostic-schema";

const inputClass =
  "h-11 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-base text-navy placeholder:text-muted-foreground outline-none transition-colors focus-visible:border-brand-blue focus-visible:ring-3 focus-visible:ring-brand-blue/30 aria-[invalid=true]:border-brand-red aria-[invalid=true]:ring-3 aria-[invalid=true]:ring-brand-red/20 md:text-sm";

const contactSchema = diagnosticSchema.shape.q9_contacto;
type ContactValues = z.infer<typeof contactSchema>;

type Props = {
  defaultValues?: Partial<DiagnosticAnswers["q9_contacto"]>;
  onSubmit: (values: ContactValues) => Promise<void> | void;
  isSubmitting: boolean;
  /** API-level error to show above the form (e.g. rate-limit / 500). */
  serverError?: string | null;
};

export function ViewContactForm({
  defaultValues,
  onSubmit,
  isSubmitting,
  serverError,
}: Props) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ContactValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      nombre: defaultValues?.nombre ?? "",
      email: defaultValues?.email ?? "",
      conjunto: defaultValues?.conjunto ?? "",
      whatsapp: defaultValues?.whatsapp ?? "",
      consent: defaultValues?.consent ?? false,
    },
    mode: "onBlur",
  });

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-lg"
      noValidate
    >
      <header className="flex flex-col gap-2">
        <h2 className="font-display text-h2 text-navy text-balance md:text-[40px] md:leading-[1.1]">
          ¿A dónde te enviamos el reporte?
        </h2>
        <p className="text-sm leading-relaxed text-slate-600">
          Tu reporte personalizado llega a tu correo en segundos. Sin spam,
          sin reventa de datos.
        </p>
      </header>

      <div className="grid gap-md sm:grid-cols-2">
        <Field
          label="Nombre"
          required
          error={errors.nombre?.message}
          name="nombre"
        >
          <input
            id="nombre"
            autoComplete="name"
            placeholder="Tu nombre"
            aria-invalid={!!errors.nombre}
            className={cn(inputClass)}
            {...register("nombre")}
          />
        </Field>

        <Field
          label="Correo de trabajo"
          required
          error={errors.email?.message}
          name="email"
        >
          <input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="tu@conjunto.com"
            aria-invalid={!!errors.email}
            className={cn(inputClass)}
            {...register("email")}
          />
        </Field>

        <Field
          label="Nombre del conjunto principal"
          required
          error={errors.conjunto?.message}
          name="conjunto"
        >
          <input
            id="conjunto"
            autoComplete="organization"
            placeholder="Ej. Conjunto Las Palmas"
            aria-invalid={!!errors.conjunto}
            className={cn(inputClass)}
            {...register("conjunto")}
          />
        </Field>

        <Field
          label="WhatsApp"
          hint="Opcional · solo para confirmar agenda de demo"
          error={errors.whatsapp?.message}
          name="whatsapp"
        >
          <input
            id="whatsapp"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="+57 300 000 0000"
            aria-invalid={!!errors.whatsapp}
            className={cn(inputClass)}
            {...register("whatsapp")}
          />
        </Field>
      </div>

      <label
        htmlFor="consent"
        className="flex items-start gap-3 rounded-xl border border-border bg-muted/30 p-md text-sm leading-relaxed text-slate-700"
      >
        <input
          id="consent"
          type="checkbox"
          className="mt-1 h-5 w-5 shrink-0 rounded-sm border-slate-300 text-brand-blue focus:ring-brand-blue/40"
          {...register("consent")}
        />
        <span>
          Acepto que Vivaru (operado por Qintilab S.A.S.) trate mis datos para
          enviarme el reporte y materiales comerciales relacionados, conforme a
          la{" "}
          <Link
            href="/legal/privacidad"
            className="font-semibold text-brand-blue underline-offset-2 hover:underline"
          >
            Política de Privacidad
          </Link>
          . Puedo retirar mi consentimiento en cualquier momento.
        </span>
      </label>
      {errors.consent ? (
        <p role="alert" className="-mt-3 text-xs font-medium text-brand-red">
          {errors.consent.message}
        </p>
      ) : null}

      {serverError ? (
        <p
          role="alert"
          className="rounded-lg border border-brand-red/30 bg-brand-red/5 p-3 text-sm font-medium text-brand-red"
        >
          {serverError}
        </p>
      ) : null}

      <Button
        type="submit"
        size="xl"
        className="w-full sm:w-auto sm:self-start"
        disabled={isSubmitting}
      >
        {isSubmitting ? "Generando reporte…" : "Generar mi reporte →"}
      </Button>
    </form>
  );
}

function Field({
  label,
  required,
  hint,
  error,
  name,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  name: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={name} className="text-sm font-semibold text-navy">
        {label}
        {required ? <span className="ml-1 text-brand-red">*</span> : null}
      </Label>
      {children}
      {error ? (
        <p role="alert" className="text-xs font-medium text-brand-red">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}
