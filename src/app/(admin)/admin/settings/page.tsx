"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { toastFirebaseError } from "@/lib/utils/error-handler";
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "firebase/auth";
import { doc, updateDoc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  adminProfileSchema,
  type AdminProfileInput,
} from "@/features/admin/schemas";
import { useAuth } from "@/features/auth/auth-context";
import { auth } from "@/lib/firebase/client";
import { TenantBrandingCard } from "@/features/admin/components/tenant-branding-card";
import { TowersCard } from "@/features/admin/components/towers-card";
import { ResidentModulesCard } from "@/features/admin/components/resident-modules-card";
import { ModuleVariantsCard } from "@/features/admin/components/module-variants-card";
import { NotificationTemplatesCard } from "@/features/admin/components/notification-templates-card";
import { FiscalProfileCard } from "@/components/features/finanzas/FiscalProfileCard";
import { SectionIntro } from "@/components/shared/section-intro";
import { useTenantBrandingForm } from "@/features/admin/hooks/use-tenant-branding-form";
import { UserAvatar } from "@/components/shared/user-avatar";
import { updateUserProfile } from "@/features/users/profile-service";

const passwordSchema = z
  .object({
    currentPassword: z.string().min(8, "Ingresa tu contraseña actual"),
    newPassword: z
      .string()
      .min(8, "La nueva contraseña debe tener mínimo 8 caracteres")
      .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).+$/, "Incluye mayúscula, minúscula, número y símbolo"),
    confirmPassword: z.string().min(8, "Confirma la nueva contraseña"),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: "La confirmación no coincide con la nueva contraseña",
    path: ["confirmPassword"],
  });

type PasswordForm = z.infer<typeof passwordSchema>;

export default function AdminSettingsPage() {
  const { user, refreshSessionProfile } = useAuth();
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [blockOnDebt, setBlockOnDebt] = useState(false);
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [tab, setTab] = useState<"conjunto" | "modulos" | "residente" | "cuenta">("conjunto");

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

  useEffect(() => {
    if (!user?.tenantId || !db) return;
    const unsub = onSnapshot(doc(db, "tenantSettings", user.tenantId), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data() as Record<string, unknown>;
      const policy = data.reservationPolicy as { blockOnDebt?: boolean } | undefined;
      setBlockOnDebt(policy?.blockOnDebt ?? false);
    });
    return unsub;
  }, [user?.tenantId]);

  async function handleToggleBlockOnDebt(value: boolean) {
    if (!user?.tenantId || !db) return;
    setSavingPolicy(true);
    try {
      await updateDoc(doc(db, "tenantSettings", user.tenantId), {
        "reservationPolicy.blockOnDebt": value,
      });
      toast.success("Política de reservas actualizada.");
    } catch (error) {
      toastFirebaseError(error);
    } finally {
      setSavingPolicy(false);
    }
  }

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
        throw new Error("Sesión no válida para actualizar contraseña.");
      }
      setSavingPassword(true);
      const credential = EmailAuthProvider.credential(auth.currentUser.email, values.currentPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, values.newPassword);
      passwordForm.reset();
      toast.success("Contraseña actualizada correctamente.");
    } catch (error) {
      toastFirebaseError(error);
    } finally {
      setSavingPassword(false);
    }
  }

  if (branding.loading) {
    return (
      <section className="space-y-4">
        {/* Branding card skeleton */}
        <div>
          <Skeleton className="h-7 w-52 rounded-xl" />
          <Skeleton className="mt-2 h-4 w-72 rounded-xl" />
        </div>
        <Card className="space-y-5 p-5">
          <div className="space-y-1">
            <Skeleton className="h-5 w-40 rounded-lg" />
            <Skeleton className="h-4 w-64 rounded-lg" />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-10 rounded-xl" />
            <Skeleton className="h-10 rounded-xl" />
          </div>
          <Skeleton className="h-[130px] max-w-[260px] rounded-2xl" />
          <div className="flex items-center gap-2">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-7 w-7 rounded-full" />)}
            <Skeleton className="h-10 w-[110px] rounded-xl" />
          </div>
          <Skeleton className="h-[108px] rounded-2xl" />
          <div className="flex justify-end gap-2 border-t border-[var(--slate-200)] pt-4">
            <Skeleton className="h-10 w-24 rounded-xl" />
            <Skeleton className="h-10 w-28 rounded-xl" />
          </div>
        </Card>
        {/* Profile card skeleton */}
        <Card className="space-y-4">
          <Skeleton className="h-5 w-36 rounded-lg" />
          <Skeleton className="h-10 rounded-xl" />
          <div className="flex gap-2">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-12 rounded-full" />)}
          </div>
          <div className="flex justify-end">
            <Skeleton className="h-10 w-32 rounded-xl" />
          </div>
        </Card>
        {/* Security card skeleton */}
        <Card className="space-y-3">
          <Skeleton className="h-5 w-24 rounded-lg" />
          <Skeleton className="h-10 rounded-xl" />
          <Skeleton className="h-10 rounded-xl" />
          <Skeleton className="h-10 rounded-xl" />
        </Card>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 border-b border-[var(--slate-200)]">
        {([
          ["conjunto", "Conjunto"],
          ["modulos", "Módulos"],
          ["residente", "Portal del residente"],
          ["cuenta", "Mi cuenta"],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === key
                ? "border-[var(--brand-700)] text-[var(--brand-700)]"
                : "border-transparent text-[var(--slate-500)] hover:text-[var(--slate-700)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "conjunto" ? (
        <>
          <SectionIntro
            storageKey="settings-conjunto"
            title="Conjunto"
            purpose="La identidad visual y los datos fiscales de tu conjunto."
            how="El logo y los colores se reflejan en el portal del residente y en los correos; los datos fiscales alimentan los comprobantes de pago."
          />
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
          <TowersCard />
          <FiscalProfileCard />
        </>
      ) : null}

      {tab === "cuenta" ? (
        <>
          <SectionIntro
            storageKey="settings-cuenta"
            title="Mi cuenta"
            purpose="Tus datos personales de acceso al panel."
            how="Actualiza tu nombre visible, tu avatar y tu contraseña. Solo afectan tu cuenta, no la configuración del conjunto."
          />
      <Card>
        <CardTitle help="Tu identidad operativa en Vivaru: el nombre que los residentes verán en comunicaciones y respuestas. Mantenlo actualizado para que la administración tenga una cara reconocible y confiable.">Perfil del usuario</CardTitle>
        <CardDescription className="mt-1">Actualiza tu nombre visible y tu avatar.</CardDescription>

        <form className="mt-4 space-y-3" onSubmit={profileForm.handleSubmit((values) => void handleSaveProfile(values))}>
          <label className="text-sm text-[var(--slate-700)]">
            Nombre visible
            <Input {...profileForm.register("fullName")} />
          </label>
          {profileForm.formState.errors.fullName ? (
            <p className="text-xs text-[var(--danger-700)]">{profileForm.formState.errors.fullName.message}</p>
          ) : null}
          {/* Avatar profesional (VIV-1802): iniciales con color procedural en vez
              del selector de emojis — cómo te ven residentes y registros. */}
          <div className="flex items-center gap-3 rounded-xl border border-[var(--slate-200)] bg-[var(--surface-soft)] p-3">
            <UserAvatar
              role={user?.role ?? "tenant_admin"}
              fullName={profileForm.watch("fullName") || user?.fullName || ""}
              size={40}
            />
            <p className="text-xs text-[var(--slate-600)]">
              Tu avatar usa tus iniciales con un color asignado automáticamente. Así apareces en la
              operación y las notificaciones del conjunto.
            </p>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={savingProfile || !profileForm.formState.isDirty || !profileForm.formState.isValid}>
              {savingProfile ? "Guardando..." : "Guardar perfil"}
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <CardTitle help="Renueva tu contraseña de acceso al panel. Te recomendamos actualizarla periódicamente y usar una combinación que no repitas en otros servicios, especialmente si gestionas datos sensibles de la comunidad.">Seguridad</CardTitle>
        <CardDescription className="mt-1">Actualiza tu contraseña sin salir de tu perfil.</CardDescription>
        <form className="mt-4 grid gap-3 md:max-w-xl" onSubmit={passwordForm.handleSubmit((values) => void handlePasswordChange(values))}>
          <div>
            <Input type="password" label="Contraseña actual" autoComplete="current-password" {...passwordForm.register("currentPassword")} />
            {passwordForm.formState.errors.currentPassword ? <p className="mt-1 text-xs text-[var(--danger-700)]">{passwordForm.formState.errors.currentPassword.message}</p> : null}
          </div>
          <div>
            <Input type="password" label="Nueva contraseña" autoComplete="new-password" {...passwordForm.register("newPassword")} />
            {passwordForm.formState.errors.newPassword ? <p className="mt-1 text-xs text-[var(--danger-700)]">{passwordForm.formState.errors.newPassword.message}</p> : null}
          </div>
          <div>
            <Input type="password" label="Confirmar nueva contraseña" autoComplete="new-password" {...passwordForm.register("confirmPassword")} />
            {passwordForm.formState.errors.confirmPassword ? <p className="mt-1 text-xs text-[var(--danger-700)]">{passwordForm.formState.errors.confirmPassword.message}</p> : null}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-[var(--slate-600)]">Usuario autenticado: {user?.email ?? "-"}</p>
            <Button type="submit" disabled={savingPassword || !passwordForm.formState.isValid} className="w-full sm:w-auto">
              {savingPassword ? "Actualizando..." : "Actualizar contraseña"}
            </Button>
          </div>
        </form>
      </Card>
        </>
      ) : null}

      {tab === "residente" ? (
        <>
          <SectionIntro
            storageKey="settings-residente"
            title="Portal del residente"
            purpose="Lo que tus residentes ven y reciben en su portal."
            how="Personaliza el texto de las notificaciones y define las reglas de reserva del conjunto."
          />
      <Card>
        <CardTitle help="Define los parámetros globales que aplican a todas las reservas del conjunto. Cuando requieres pago al día, los residentes con saldo pendiente verán el bloqueo de forma automática en su app, sin intervención manual tuya.">Políticas de reservas</CardTitle>
        <CardDescription className="mt-1">Controla el acceso a reservas según el estado de pago de cada unidad.</CardDescription>
        <div className="mt-4">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-[var(--slate-300)] accent-[var(--brand-700)]"
              checked={blockOnDebt}
              disabled={savingPolicy}
              onChange={(e) => void handleToggleBlockOnDebt(e.target.checked)}
            />
            <div>
              <p className="text-sm font-medium text-[var(--slate-900)]">Bloquear reservas a unidades con saldo vencido</p>
              <p className="mt-0.5 text-xs text-[var(--slate-600)]">Las unidades con cuotas vencidas no podrán hacer nuevas reservas hasta regularizar su pago.</p>
            </div>
          </label>
        </div>
      </Card>

      <NotificationTemplatesCard tenantId={user?.tenantId} />
        </>
      ) : null}

      {tab === "modulos" ? (
        <>
          <SectionIntro
            storageKey="settings-modulos"
            title="Módulos"
            purpose="Qué módulos están disponibles y cómo operan en este conjunto."
            how="Activa o desactiva los módulos del portal del residente, y elige el modo de operación de cada módulo (por ejemplo, Visitas con QR o registro simple)."
          />

          <ResidentModulesCard tenantId={user?.tenantId} />

          <ModuleVariantsCard tenantId={user?.tenantId} />
        </>
      ) : null}
    </section>
  );
}
