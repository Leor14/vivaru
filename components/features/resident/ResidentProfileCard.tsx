"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { SessionUser } from "@/features/auth/auth-context";
import { Modal } from "@/components/shared/modal";
import { ResidentAvatarPicker } from "./ResidentAvatarPicker";
import { useResidentUnitChangeRequest } from "../../../features/resident/hooks/useResidentUnitChangeRequest";
import { useAvailableUnits } from "../../../features/resident/hooks/useAvailableUnits";
import {
  residentEmailSchema,
  residentProfileSchema,
  type ResidentEmailForm,
  type ResidentProfileForm,
} from "../../../features/resident/schemas";
import { createUnitChangeRequest, updateResidentEmail } from "../../../features/resident/services";
import { updateUserProfile } from "@/features/users/profile-service";

interface Props {
  user: SessionUser & {
    phone?: string;
    documentNumber?: string;
    preferredContactMethod?: string;
    avatarId?: string;
  };
  onProfileUpdated?: () => Promise<void> | void;
}

export function ResidentProfileCard({ user, onProfileUpdated }: Props) {
  const tenantId = user.tenantId ?? "";
  const currentUnitId = user.unitId ?? "";
  const currentUnitDisplay = user.unitLabel ?? user.unitId ?? "-";

  const [editMode, setEditMode] = useState(false);
  const [editEmailMode, setEditEmailMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState<string | null>(null);
  const [unitModalOpen, setUnitModalOpen] = useState(false);
  const [unitRequestSendLoading, setUnitRequestSendLoading] = useState(false);
  const [unitRequestSendError, setUnitRequestSendError] = useState<string | null>(null);
  const [unitRequestSuccess, setUnitRequestSuccess] = useState(false);
  const { request: unitChangeRequest, loading: unitChangeRequestLoading, error: unitChangeRequestError } = useResidentUnitChangeRequest(user.uid);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isDirty, isValid },
  } = useForm<ResidentProfileForm>({
    resolver: zodResolver(residentProfileSchema),
    defaultValues: {
      fullName: user?.fullName || "",
      phone: user?.phone || "",
      documentNumber: user?.documentNumber || "",
      preferredContactMethod: user?.preferredContactMethod || "",
      avatarId: user?.avatarId || "",
    },
    mode: "onChange",
  });

  const {
    register: registerEmail,
    handleSubmit: handleSubmitEmail,
    reset: resetEmail,
    formState: { errors: emailErrors, isDirty: emailDirty, isValid: emailValid },
  } = useForm<ResidentEmailForm>({
    resolver: zodResolver(residentEmailSchema),
    defaultValues: {
      email: user?.email ?? "",
      currentPassword: "",
    },
    mode: "onChange",
  });

  const { units: availableUnits, loading: unitsLoading, error: unitsError } = useAvailableUnits(tenantId, currentUnitId);

  const {
    register: registerUnit,
    handleSubmit: handleSubmitUnit,
    reset: resetUnitForm,
    formState: { errors: unitErrors, isValid: unitFormValid },
  } = useForm<{ requestedUnitId: string; reason?: string }>({
    defaultValues: { requestedUnitId: "", reason: "" },
    mode: "onChange",
  });

  useEffect(() => {
    reset({
      fullName: user?.fullName || "",
      phone: user?.phone || "",
      documentNumber: user?.documentNumber || "",
      preferredContactMethod: user?.preferredContactMethod || "",
      avatarId: user?.avatarId || "",
    });
    resetEmail({
      email: user?.email || "",
      currentPassword: "",
    });
  }, [user, reset, resetEmail]);

  const onSubmit = async (data: ResidentProfileForm) => {
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      await updateUserProfile(user.uid, data);
      setSaveSuccess(true);
      setEditMode(false);
      if (onProfileUpdated) await onProfileUpdated();
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Error al guardar.";
      setSaveError(message);
    } finally {
      setSaving(false);
      setTimeout(() => setSaveSuccess(false), 2000);
    }
  };

  const onSubmitEmail = async (data: ResidentEmailForm) => {
    setSavingEmail(true);
    setEmailError(null);
    setEmailSuccess(null);
    try {
      await updateResidentEmail({
        uid: user.uid,
        email: data.email,
        currentPassword: data.currentPassword,
      });
      setEditEmailMode(false);
      setEmailSuccess("Correo actualizado correctamente.");
      resetEmail({ email: data.email, currentPassword: "" });
      if (onProfileUpdated) await onProfileUpdated();
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "No fue posible actualizar el correo.";
      setEmailError(message);
    } finally {
      setSavingEmail(false);
    }
  };

  const handleUnitRequest = async (data: { requestedUnitId: string; reason?: string }) => {
    setUnitRequestSendLoading(true);
    setUnitRequestSendError(null);
    setUnitRequestSuccess(false);
    try {
      const requestedUnit = availableUnits.find((unit) => unit.id === data.requestedUnitId);
      if (!requestedUnit) throw new Error("Unidad no valida.");
      await createUnitChangeRequest({
        tenantId,
        userId: user.uid,
        currentUnitId,
        requestedUnitId: requestedUnit.id,
        currentUnitDisplay,
        requestedUnitDisplay: requestedUnit.display,
        reason: data.reason,
      });
      setUnitRequestSuccess(true);
      resetUnitForm();
      if (onProfileUpdated) await onProfileUpdated();
      setTimeout(() => setUnitModalOpen(false), 1200);
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Error al solicitar cambio de unidad.";
      setUnitRequestSendError(message);
    } finally {
      setUnitRequestSendLoading(false);
    }
  };

  const hasPendingUnitRequest = unitChangeRequest?.status === "pending";

  return (
    <Card>
      <CardTitle>Perfil del residente</CardTitle>
      <CardDescription className="mt-2">Administra informacion personal, vivienda y seguridad de tu cuenta.</CardDescription>

      <section className="mt-6">
        <p className="text-sm font-semibold text-[var(--slate-900)]">Informacion personal</p>
        <form className="mt-3 grid gap-4 md:grid-cols-2" onSubmit={handleSubmit(onSubmit)}>
          <div className="md:col-span-2">
            <ResidentAvatarPicker
              value={editMode ? watch("avatarId") ?? "" : user?.avatarId || ""}
              onChange={(id) => {
                if (editMode) setValue("avatarId", id, { shouldDirty: true });
              }}
              disabled={!editMode || saving}
            />
          </div>

          <div>
            <label className="font-semibold block mb-1">Nombre</label>
            {editMode ? (
              <Input {...register("fullName")} disabled={saving} />
            ) : (
              <div className="text-sm text-[var(--slate-700)]">{user?.fullName ?? "-"}</div>
            )}
            {errors.fullName ? <div className="text-xs text-destructive">{errors.fullName.message}</div> : null}
          </div>

          <div>
            <label className="font-semibold block mb-1">Telefono</label>
            {editMode ? (
              <Input {...register("phone")} disabled={saving} />
            ) : (
              <div className="text-sm text-[var(--slate-700)]">{user?.phone ?? "-"}</div>
            )}
            {errors.phone ? <div className="text-xs text-destructive">{errors.phone.message}</div> : null}
          </div>

          <div>
            <label className="font-semibold block mb-1">Documento</label>
            {editMode ? (
              <Input {...register("documentNumber")} disabled={saving} />
            ) : (
              <div className="text-sm text-[var(--slate-700)]">{user?.documentNumber ?? "-"}</div>
            )}
          </div>

          <div>
            <label className="font-semibold block mb-1">Metodo de contacto preferido</label>
            {editMode ? (
              <Input {...register("preferredContactMethod")} disabled={saving} />
            ) : (
              <div className="text-sm text-[var(--slate-700)]">{user?.preferredContactMethod ?? "-"}</div>
            )}
          </div>

          <div className="md:col-span-2 flex justify-end gap-2">
            {editMode ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    reset();
                    setEditMode(false);
                  }}
                  disabled={saving}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={!isDirty || !isValid || saving}>
                  {saving ? "Guardando..." : "Guardar cambios"}
                </Button>
              </>
            ) : (
              <Button type="button" variant="outline" onClick={() => setEditMode(true)}>
                Editar informacion personal
              </Button>
            )}
          </div>

          {saveError ? <div className="md:col-span-2 text-xs text-destructive">{saveError}</div> : null}
          {saveSuccess ? <div className="md:col-span-2 text-xs text-success">Perfil actualizado correctamente.</div> : null}
        </form>
      </section>

      <section className="mt-6 border-t border-[var(--slate-200)] pt-6">
        <p className="text-sm font-semibold text-[var(--slate-900)]">Correo de acceso</p>
        <form className="mt-3 grid gap-4 md:max-w-xl" onSubmit={handleSubmitEmail(onSubmitEmail)}>
          <Input
            type="email"
            label="Correo"
            {...registerEmail("email")}
            error={emailErrors.email?.message}
            disabled={!editEmailMode || savingEmail}
          />

          {editEmailMode ? (
            <Input
              type="password"
              label="Contrasena actual"
              autoComplete="current-password"
              {...registerEmail("currentPassword")}
              error={emailErrors.currentPassword?.message}
              disabled={savingEmail}
            />
          ) : null}

          <div className="flex justify-end gap-2">
            {editEmailMode ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    resetEmail({ email: user?.email ?? "", currentPassword: "" });
                    setEditEmailMode(false);
                    setEmailError(null);
                  }}
                  disabled={savingEmail}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={!emailDirty || !emailValid || savingEmail}>
                  {savingEmail ? "Guardando..." : "Actualizar correo"}
                </Button>
              </>
            ) : (
              <Button type="button" variant="outline" onClick={() => setEditEmailMode(true)}>
                Editar correo
              </Button>
            )}
          </div>

          {emailError ? <p className="text-xs text-[var(--danger-700)]">{emailError}</p> : null}
          {emailSuccess ? <p className="text-xs text-[var(--brand-700)]">{emailSuccess}</p> : null}
        </form>
      </section>

      <section className="mt-6 border-t border-[var(--slate-200)] pt-6">
        <p className="text-sm font-semibold text-[var(--slate-900)]">Vivienda</p>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <div>
            <label className="font-semibold block mb-1">Unidad</label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-[var(--slate-700)]">{user?.unitLabel ?? "-"}</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setUnitModalOpen(true)}
                disabled={Boolean(hasPendingUnitRequest) || !tenantId || !currentUnitId}
              >
                Solicitar cambio de unidad
              </Button>
            </div>
            {hasPendingUnitRequest ? <div className="text-xs text-muted-foreground mt-1">Ya tienes una solicitud pendiente.</div> : null}
          </div>

          <div>
            <label className="font-semibold block mb-1">Tenant</label>
            <div className="text-sm text-[var(--slate-700)]">{user?.tenantName ?? user?.tenantId ?? "-"}</div>
          </div>
        </div>
      </section>

      <Modal open={unitModalOpen} title="Solicitar cambio de unidad" onClose={() => { setUnitModalOpen(false); resetUnitForm(); }}>
        <form className="space-y-4" onSubmit={handleSubmitUnit(handleUnitRequest)}>
          <div>
            <label className="block font-semibold mb-1">Unidad actual</label>
            <div className="text-sm text-[var(--slate-700)]">{user?.unitLabel ?? user?.unitId ?? "-"}</div>
          </div>

          <div>
            <label className="block font-semibold mb-1">Nueva unidad</label>
            {unitsLoading ? (
              <div className="text-muted-foreground text-sm">Cargando unidades...</div>
            ) : unitsError ? (
              <div className="text-destructive text-sm">{unitsError}</div>
            ) : (
              <select className="w-full border rounded px-2 py-1" {...registerUnit("requestedUnitId", { required: "Selecciona una unidad" })}>
                <option value="">Selecciona una unidad</option>
                {availableUnits.map((unit) => (
                  <option key={unit.id} value={unit.id}>{unit.display}</option>
                ))}
              </select>
            )}
            {unitErrors.requestedUnitId ? <div className="text-xs text-destructive">{unitErrors.requestedUnitId.message}</div> : null}
          </div>

          <div>
            <label className="block font-semibold mb-1">Motivo (opcional)</label>
            <textarea className="w-full border rounded px-2 py-1" rows={2} {...registerUnit("reason")}></textarea>
          </div>

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => { setUnitModalOpen(false); resetUnitForm(); }} disabled={unitRequestSendLoading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!unitFormValid || unitRequestSendLoading}>
              {unitRequestSendLoading ? "Enviando..." : "Enviar solicitud"}
            </Button>
          </div>

          {unitRequestSendError ? <div className="text-xs text-destructive">{unitRequestSendError}</div> : null}
          {unitRequestSuccess ? <div className="text-xs text-success">Solicitud enviada correctamente.</div> : null}
        </form>
      </Modal>

      {unitChangeRequestLoading ? (
        <div className="mt-4 text-muted-foreground text-sm">Cargando estado de solicitud de cambio de unidad...</div>
      ) : unitChangeRequest ? (
        <div className="mt-4 p-3 rounded border bg-slate-50">
          <div className="font-semibold mb-1">Solicitud de cambio de unidad</div>
          <div className="text-sm mb-1"><span className="font-medium">Unidad solicitada:</span> {unitChangeRequest.requestedUnitDisplay}</div>
          <div className="text-sm mb-1">
            <span className="font-medium">Estado:</span> {unitChangeRequest.status === "pending" ? "Pendiente" : unitChangeRequest.status === "approved" ? "Aprobada" : "Rechazada"}
          </div>
          {unitChangeRequest.reason ? <div className="text-xs text-muted-foreground"><span className="font-medium">Motivo:</span> {unitChangeRequest.reason}</div> : null}
        </div>
      ) : unitChangeRequestError ? (
        <div className="mt-4 text-xs text-destructive">{unitChangeRequestError}</div>
      ) : null}
    </Card>
  );
}
