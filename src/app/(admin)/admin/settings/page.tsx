"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { toastFirebaseError } from "@/lib/utils/error-handler";
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "firebase/auth";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  adminProfileSchema,
  type AdminProfileInput,
} from "@/features/admin/schemas";
import { useAuth } from "@/features/auth/auth-context";
import { auth } from "@/lib/firebase/client";
import { TenantBrandingCard } from "@/features/admin/components/tenant-branding-card";
import { useTenantBrandingForm } from "@/features/admin/hooks/use-tenant-branding-form";
import { ResidentAvatarPicker } from "../../../../../components/features/resident/ResidentAvatarPicker";
import { updateUserProfile } from "@/features/users/profile-service";

const passwordSchema = z
  .object({
    currentPassword: z.string().min(8, "Ingresa tu contrasena actual"),
    newPassword: z.string().min(8, "La nueva contrasena debe tener minimo 8 caracteres"),
    confirmPassword: z.string().min(8, "Confirma la nueva contrasena"),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: "La confirmacion no coincide con la nueva contrasena",
    path: ["confirmPassword"],
  });

type PasswordForm = z.infer<typeof passwordSchema>;

export default function AdminSettingsPage() {
  const { user, refreshSessionProfile } = useAuth();
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const branding = useTenantBrandingForm({
    tenantId: user?.tenantId,
    userId: user?.uid,
    fallbackTenantName: user?.tenantName,
    onPersisted: async () => {
      await refreshSessionProfile({ preferServerReads: true });
    },
  });

  const profileForm = useForm<AdminProfileInput>({
    resolver: zodResolver(adminProfileSchema),
    defaultValues: {
      fullName: user?.fullName ?? "",
      avatarId: user?.avatarId ?? "emoji1",
    },
    mode: "onChange",
  });

  const passwordForm = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
    mode: "onChange",
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    profileForm.reset({
      fullName: user?.fullName ?? "",
      avatarId: user?.avatarId ?? "emoji1",
    });
  }, [profileForm, user?.avatarId, user?.fullName]);

  async function handleSaveProfile(values: AdminProfileInput) {
    if (!user) return;
    setSavingProfile(true);
    try {
      await updateUserProfile(user.uid, {
        fullName: values.fullName,
        avatarId: values.avatarId,
      });

      await refreshSessionProfile({ preferServerReads: true });

      toast.success("Perfil del administrador actualizado.");
    } catch (error) {
      toastFirebaseError(error);
    } finally {
      setSavingProfile(false);
    }
  }

  async function handlePasswordChange(values: PasswordForm) {
    try {
      if (!auth?.currentUser || !auth.currentUser.email) {
        throw new Error("Sesion no valida para actualizar contrasena.");
      }
      setSavingPassword(true);
      const credential = EmailAuthProvider.credential(auth.currentUser.email, values.currentPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, values.newPassword);
      passwordForm.reset();
      toast.success("Contrasena actualizada correctamente.");
    } catch (error) {
      toastFirebaseError(error);
    } finally {
      setSavingPassword(false);
    }
  }

  if (branding.loading) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-[var(--slate-900)]">Perfil del edificio</h2>
        <Card>
          <p className="text-sm text-[var(--slate-600)]">Cargando configuración...</p>
        </Card>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <TenantBrandingCard
        form={branding.form}
        loading={branding.loading}
        loadError={branding.loadError}
        saving={branding.saving}
        hasChanges={branding.hasChanges}
        saveState={branding.saveState}
        colorValue={branding.normalizedColor}
        suggestedColors={branding.suggestedColors}
        contrast={branding.contrast}
        logoPreviewUrl={branding.effectiveLogoPreview}
        logoFileName={branding.logoFile?.name ?? ""}
        primaryActionLabel={branding.primaryActionLabel}
        onColorPick={branding.setColorFromPalette}
        onLogoSelect={branding.handleLogoSelection}
        onRemoveLogo={branding.removeLogo}
        onCancel={branding.cancelChanges}
        onSubmit={branding.submitBranding}
      />

      <Card>
        <CardTitle>Perfil del usuario</CardTitle>
        <CardDescription className="mt-1">Gestióna tu nombre visible y avatar operativo en una sola vista.</CardDescription>

        <form className="mt-4 space-y-3" onSubmit={profileForm.handleSubmit((values) => void handleSaveProfile(values))}>
          <label className="text-sm text-[var(--slate-700)]">
            Nombre visible
            <Input {...profileForm.register("fullName")} />
          </label>
          {profileForm.formState.errors.fullName ? (
            <p className="text-xs text-[var(--danger-700)]">{profileForm.formState.errors.fullName.message}</p>
          ) : null}
          <div>
            <ResidentAvatarPicker
              value={profileForm.watch("avatarId") ?? "emoji1"}
              onChange={(id) => profileForm.setValue("avatarId", id, { shouldDirty: true, shouldValidate: true })}
              disabled={savingProfile}
            />
          </div>
          {profileForm.formState.errors.avatarId ? (
            <p className="text-xs text-[var(--danger-700)]">{profileForm.formState.errors.avatarId.message}</p>
          ) : null}
          <div className="flex justify-end">
            <Button type="submit" disabled={savingProfile || !profileForm.formState.isDirty || !profileForm.formState.isValid}>
              {savingProfile ? "Guardando..." : "Guardar perfil"}
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <CardTitle>Seguridad</CardTitle>
        <CardDescription className="mt-1">Actualiza tu contrasena sin salir de tu perfil.</CardDescription>
        <form className="mt-4 grid gap-3 md:max-w-xl" onSubmit={passwordForm.handleSubmit((values) => void handlePasswordChange(values))}>
          <div>
            <Input type="password" label="Contrasena actual" autoComplete="current-password" {...passwordForm.register("currentPassword")} />
            {passwordForm.formState.errors.currentPassword ? <p className="mt-1 text-xs text-[var(--danger-700)]">{passwordForm.formState.errors.currentPassword.message}</p> : null}
          </div>
          <div>
            <Input type="password" label="Nueva contrasena" autoComplete="new-password" {...passwordForm.register("newPassword")} />
            {passwordForm.formState.errors.newPassword ? <p className="mt-1 text-xs text-[var(--danger-700)]">{passwordForm.formState.errors.newPassword.message}</p> : null}
          </div>
          <div>
            <Input type="password" label="Confirmar nueva contrasena" autoComplete="new-password" {...passwordForm.register("confirmPassword")} />
            {passwordForm.formState.errors.confirmPassword ? <p className="mt-1 text-xs text-[var(--danger-700)]">{passwordForm.formState.errors.confirmPassword.message}</p> : null}
          </div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-[var(--slate-600)]">Usuario autenticado: {user?.email ?? "-"}</p>
            <Button type="submit" disabled={savingPassword || !passwordForm.formState.isValid}>
              {savingPassword ? "Actualizando..." : "Actualizar contrasena"}
            </Button>
          </div>
        </form>
      </Card>
    </section>
  );
}
