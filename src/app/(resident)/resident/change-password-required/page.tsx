"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { toastFirebaseError } from "@/lib/utils/error-handler";
import { z } from "zod";

import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/auth-context";

const forcedChangeSchema = z
  .object({
    currentPassword: z.string().min(1, "Ingresa tu clave temporal"),
    newPassword: z.string().min(8, "La nueva contrasena debe tener minimo 8 caracteres"),
    confirmPassword: z.string().min(8, "Confirma la nueva contrasena"),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "La confirmacion no coincide con la nueva contrasena",
  })
  .refine((values) => values.newPassword !== values.currentPassword, {
    path: ["newPassword"],
    message: "La nueva contrasena debe ser diferente de la temporal",
  });

type ForcedChangeForm = z.infer<typeof forcedChangeSchema>;

export default function ResidentForcedPasswordChangePage() {
  const { user, completeForcedPasswordChange, logout } = useAuth();
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isValid, isDirty },
    reset,
  } = useForm<ForcedChangeForm>({
    resolver: zodResolver(forcedChangeSchema),
    mode: "onChange",
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (values: ForcedChangeForm) => {
    try {
      if (process.env.NODE_ENV !== "production") {
        console.info("[resident.force-change] submit", {
          uid: user?.uid,
          mustChangePassword: user?.mustChangePassword,
        });
      }
      await completeForcedPasswordChange(values);
      toast.success("Contrasena actualizada correctamente. Ya puedes usar el portal.");
      reset();
      if (process.env.NODE_ENV !== "production") {
        console.info("[resident.force-change] redirect", { target: "/resident" });
      }
      router.replace("/resident");
    } catch (error) {
      toastFirebaseError(error);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <section className="mx-auto w-full max-w-xl py-3">
      <Card className="border-[var(--slate-200)] bg-white p-5 md:p-6">
        <p className="inline-flex items-center gap-2 rounded-full border border-[var(--brand-200)] bg-[var(--brand-50)] px-3 py-1 text-xs font-semibold text-[var(--brand-800)] uppercase tracking-wide">
          <ShieldCheck className="h-3.5 w-3.5" /> Primer ingreso seguro
        </p>
        <CardTitle className="mt-3 text-xl">Debes actualizar tu contrasena para continuar</CardTitle>
        <CardDescription className="mt-2">
          Por seguridad, tu cuenta fue activada con una clave temporal. Ingresa esa clave y define una nueva contrasena personal.
        </CardDescription>

        <div className="mt-3 rounded-xl border border-[var(--slate-200)] bg-[var(--slate-50)] p-3 text-sm text-[var(--slate-700)]">
          Si tu acceso fue restablecido por administración, la clave temporal corresponde a tu numero de documento.
        </div>

        <form className="mt-4 grid gap-3" onSubmit={handleSubmit(onSubmit)}>
          <Input
            type="password"
            label="Clave temporal actual"
            autoComplete="current-password"
            {...register("currentPassword")}
            error={errors.currentPassword?.message}
            disabled={isSubmitting}
          />
          <Input
            type="password"
            label="Nueva contrasena"
            autoComplete="new-password"
            {...register("newPassword")}
            error={errors.newPassword?.message}
            disabled={isSubmitting}
          />
          <Input
            type="password"
            label="Confirmar nueva contrasena"
            autoComplete="new-password"
            {...register("confirmPassword")}
            error={errors.confirmPassword?.message}
            disabled={isSubmitting}
          />

          <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <Button type="button" variant="outline" onClick={() => void logout()} disabled={isSubmitting}>
              Cerrar sesion
            </Button>
            <Button type="submit" disabled={!isDirty || !isValid || isSubmitting}>
              {isSubmitting ? "Actualizando..." : "Guardar nueva contrasena"}
            </Button>
          </div>
        </form>
      </Card>
    </section>
  );
}
