import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { toastFirebaseError } from "@/lib/utils/error-handler";

import { tenantBrandingSchema, type TenantBrandingInput } from "@/features/admin/schemas";
import {
  deleteTenantLogoByPath,
  saveTenantSettings,
  uploadTenantLogo,
  validateTenantLogoFile,
  watchTenantSettings,
} from "@/features/admin/services";
import { getBrandingContrastReport, normalizeHexColor } from "@/features/admin/utils/branding-contrast";

const DEFAULT_BRAND_COLOR = "#0f172a";

export const SUGGESTED_BRAND_COLORS = [
  "#0f172a",
  "#3b4fd0",
  "#3d7f79",
  "#356f3c",
  "#8a3f1c",
  "#8f2a20",
  "#4a4a54",
  "#24314d",
] as const;

type PersistedBrandingSnapshot = {
  tenantName: string;
  tenantDisplayName: string;
  brandColor: string;
  logoUrl: string;
  logoPath: string;
};

function toSnapshot(input: {
  tenantName?: string;
  tenantDisplayName?: string;
  brandColor?: string;
  logoUrl?: string;
  logoPath?: string;
}) {
  return {
    tenantName: input.tenantName ?? "",
    tenantDisplayName: input.tenantDisplayName ?? "",
    brandColor: input.brandColor ?? DEFAULT_BRAND_COLOR,
    logoUrl: input.logoUrl ?? "",
    logoPath: input.logoPath ?? "",
  };
}

export function useTenantBrandingForm(input: {
  tenantId?: string;
  userId?: string;
  fallbackTenantName?: string;
  onPersisted?: () => Promise<void>;
}) {
  const { tenantId, userId, fallbackTenantName, onPersisted } = input;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saved">("idle");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [removeLogoRequested, setRemoveLogoRequested] = useState(false);

  const form = useForm<TenantBrandingInput>({
    resolver: zodResolver(tenantBrandingSchema),
    defaultValues: {
      tenantName: fallbackTenantName ?? "",
      tenantDisplayName: "",
      brandColor: DEFAULT_BRAND_COLOR,
      logoUrl: "",
      logoPath: "",
    },
  });

  const persistedRef = useRef<PersistedBrandingSnapshot>(
    toSnapshot({ tenantName: fallbackTenantName ?? "", brandColor: DEFAULT_BRAND_COLOR }),
  );

  const watchedColor = form.watch("brandColor");
  const watchedLogoUrl = form.watch("logoUrl");
  const normalizedColor = normalizeHexColor(watchedColor ?? "") ?? DEFAULT_BRAND_COLOR;
  const contrast = useMemo(() => getBrandingContrastReport(normalizedColor), [normalizedColor]);

  const hasFormFieldChanges = form.formState.isDirty;
  const hasChanges = hasFormFieldChanges || Boolean(logoFile) || removeLogoRequested;

  const effectiveLogoPreview = useMemo(() => {
    if (removeLogoRequested) {
      return null;
    }
    if (logoPreviewUrl) {
      return logoPreviewUrl;
    }
    return watchedLogoUrl || null;
  }, [logoPreviewUrl, removeLogoRequested, watchedLogoUrl]);

  useEffect(() => {
    return () => {
      if (logoPreviewUrl) {
        URL.revokeObjectURL(logoPreviewUrl);
      }
    };
  }, [logoPreviewUrl]);

  useEffect(() => {
    if (!tenantId) {
      setLoading(false);
      return;
    }

    const unsubscribe = watchTenantSettings(
      tenantId,
      (settings) => {
        const snapshot = toSnapshot({
          tenantName: settings?.tenantName ?? fallbackTenantName ?? "",
          tenantDisplayName: settings?.tenantDisplayName ?? "",
          brandColor: normalizeHexColor(settings?.brandColor ?? DEFAULT_BRAND_COLOR) ?? DEFAULT_BRAND_COLOR,
          logoUrl: settings?.logoUrl ?? "",
          logoPath: settings?.logoPath ?? "",
        });

        persistedRef.current = snapshot;
        form.reset({
          tenantName: snapshot.tenantName,
          tenantDisplayName: snapshot.tenantDisplayName,
          brandColor: snapshot.brandColor,
          logoUrl: snapshot.logoUrl,
          logoPath: snapshot.logoPath,
        });

        setLoadError(null);
        setRemoveLogoRequested(false);
        setLogoFile(null);
        setLogoPreviewUrl((current) => {
          if (current) {
            URL.revokeObjectURL(current);
          }
          return null;
        });
        setSaveState("idle");
        setLoading(false);
      },
      (message) => {
        setLoadError(message);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [fallbackTenantName, form, tenantId]);

  function setColorFromPalette(color: string) {
    form.setValue("brandColor", color, { shouldDirty: true, shouldValidate: true });
    setSaveState("idle");
  }

  function handleLogoSelection(file: File | null) {
    if (!file) {
      return;
    }

    const validationError = validateTenantLogoFile(file);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    if (logoPreviewUrl) {
      URL.revokeObjectURL(logoPreviewUrl);
    }

    setLogoFile(file);
    setLogoPreviewUrl(URL.createObjectURL(file));
    setRemoveLogoRequested(false);
    setSaveState("idle");
  }

  function removeLogo() {
    if (logoPreviewUrl) {
      URL.revokeObjectURL(logoPreviewUrl);
    }
    setLogoPreviewUrl(null);
    setLogoFile(null);
    setRemoveLogoRequested(true);
    form.setValue("logoUrl", "", { shouldDirty: true });
    form.setValue("logoPath", "", { shouldDirty: true });
    setSaveState("idle");
  }

  function cancelChanges() {
    const snapshot = persistedRef.current;

    if (logoPreviewUrl) {
      URL.revokeObjectURL(logoPreviewUrl);
    }

    setLogoPreviewUrl(null);
    setLogoFile(null);
    setRemoveLogoRequested(false);
    setSaveState("idle");

    form.reset({
      tenantName: snapshot.tenantName,
      tenantDisplayName: snapshot.tenantDisplayName,
      brandColor: snapshot.brandColor,
      logoUrl: snapshot.logoUrl,
      logoPath: snapshot.logoPath,
    });
  }

  async function submitBranding(values: TenantBrandingInput) {
    if (!tenantId || !userId) {
      return;
    }

    setSaving(true);
    setSaveState("idle");

    const normalizedBrandColor = normalizeHexColor(values.brandColor);
    if (!normalizedBrandColor) {
      toast.error("Color invalido. Usa formato #RRGGBB.");
      setSaving(false);
      return;
    }

    const previous = persistedRef.current;
    let nextLogoUrl: string | null = previous.logoUrl || null;
    let nextLogoPath: string | null = previous.logoPath || null;

    try {
      if (removeLogoRequested) {
        nextLogoUrl = null;
        nextLogoPath = null;
      }

      if (logoFile) {
        const uploaded = await uploadTenantLogo({ tenantId, file: logoFile });
        nextLogoUrl = uploaded.fileUrl;
        nextLogoPath = uploaded.storagePath;
      }

      await saveTenantSettings(tenantId, userId, {
        tenantName: values.tenantName,
        tenantDisplayName: values.tenantDisplayName?.trim() || "",
        brandColor: normalizedBrandColor,
        logoUrl: nextLogoUrl,
        logoPath: nextLogoPath,
      });

      const shouldDeletePreviousLogo = Boolean(previous.logoPath) && (
        removeLogoRequested || (logoFile && previous.logoPath !== nextLogoPath)
      );

      if (shouldDeletePreviousLogo && previous.logoPath) {
        await deleteTenantLogoByPath(previous.logoPath);
      }

      if (logoPreviewUrl) {
        URL.revokeObjectURL(logoPreviewUrl);
      }

      const snapshot = toSnapshot({
        tenantName: values.tenantName,
        tenantDisplayName: values.tenantDisplayName?.trim() || "",
        brandColor: normalizedBrandColor,
        logoUrl: nextLogoUrl ?? "",
        logoPath: nextLogoPath ?? "",
      });

      persistedRef.current = snapshot;
      form.reset({
        tenantName: snapshot.tenantName,
        tenantDisplayName: snapshot.tenantDisplayName,
        brandColor: snapshot.brandColor,
        logoUrl: snapshot.logoUrl,
        logoPath: snapshot.logoPath,
      });

      setLogoPreviewUrl(null);
      setLogoFile(null);
      setRemoveLogoRequested(false);
      setSaveState("saved");

      if (onPersisted) {
        await onPersisted();
      }

      toast.success("Branding del edificio actualizado.");
    } catch (error) {
      console.error("[tenant-branding] save failed", error);
      toastFirebaseError(error);
    } finally {
      setSaving(false);
    }
  }

  const primaryActionLabel = saving ? "Guardando..." : hasChanges ? "Guardar cambios" : "Sin cambios";

  return {
    form,
    loading,
    loadError,
    saving,
    saveState,
    hasChanges,
    logoFile,
    effectiveLogoPreview,
    suggestedColors: SUGGESTED_BRAND_COLORS,
    normalizedColor,
    contrast,
    primaryActionLabel,
    setColorFromPalette,
    handleLogoSelection,
    removeLogo,
    cancelChanges,
    submitBranding,
  };
}
