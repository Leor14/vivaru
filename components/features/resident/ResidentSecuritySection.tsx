"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { residentPasswordSchema, type ResidentPasswordForm } from "../../../features/resident/schemas";
import { updateResidentPassword } from "../../../features/resident/services";

type Props = {
  uid: string;
  onPasswordUpdated?: () => Promise<void> | void;
};

export function ResidentSecuritySection({ uid, onPasswordUpdated }: Props) {
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isValid },
  } = useForm<ResidentPasswordForm>({
    resolver: zodResolver(residentPasswordSchema),
    mode: "onChange",
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (values: ResidentPasswordForm) => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await updateResidentPassword({
        uid,
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      setSuccess("Contrasena actualizada correctamente.");
      reset();
      if (onPasswordUpdated) await onPasswordUpdated();
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "No fue posible actualizar la contrasena.";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardTitle>Seguridad</CardTitle>
      <CardDescription className="mt-1">Actualiza tu contrasena con reautenticacion segura.</CardDescription>

      <form className="mt-4 grid gap-3 md:max-w-xl" onSubmit={handleSubmit(onSubmit)}>
        <Input
          type="password"
          label="Contrasena actual"
          autoComplete="current-password"
          {...register("currentPassword")}
          error={errors.currentPassword?.message}
          disabled={saving}
        />
        <Input
          type="password"
          label="Nueva contrasena"
          autoComplete="new-password"
          {...register("newPassword")}
          error={errors.newPassword?.message}
          disabled={saving}
        />
        <Input
          type="password"
          label="Confirmar nueva contrasena"
          autoComplete="new-password"
          {...register("confirmPassword")}
          error={errors.confirmPassword?.message}
          disabled={saving}
        />

        <div className="mt-1 flex justify-end">
          <Button type="submit" disabled={!isDirty || !isValid || saving}>
            {saving ? "Guardando..." : "Actualizar contrasena"}
          </Button>
        </div>

        {error ? <p className="text-xs text-[var(--danger-700)]">{error}</p> : null}
        {success ? <p className="text-xs text-[var(--brand-700)]">{success}</p> : null}
      </form>
    </Card>
  );
}
