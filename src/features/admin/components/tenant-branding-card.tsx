import { useEffect, useMemo, useRef, useState } from "react";
import type { UseFormReturn } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { TenantBrandingInput } from "@/features/admin/schemas";

type ContrastReport = {
  whiteContrast: number;
  darkContrast: number;
  recommendedText: "claro" | "oscuro";
  isReadable: boolean;
  readabilityText: string;
};

type TenantBrandingCardProps = {
  form: UseFormReturn<TenantBrandingInput>;
  loading: boolean;
  loadError: string | null;
  saving: boolean;
  hasChanges: boolean;
  saveState: "idle" | "saved";
  colorValue: string;
  suggestedColors: readonly string[];
  contrast: ContrastReport;
  logoPreviewUrl: string | null;
  logoFileName: string;
  primaryActionLabel: string;
  onColorPick: (color: string) => void;
  onLogoSelect: (file: File | null) => void;
  onRemoveLogo: () => void;
  onCancel: () => void;
  onSubmit: (values: TenantBrandingInput) => Promise<void>;
};

const HEX_REGEX = /^#?[0-9a-fA-F]{6}$/;

function normalizeHex(value: string): string | null {
  if (!HEX_REGEX.test(value.trim())) return null;
  const trimmed = value.trim();
  return (trimmed.startsWith("#") ? trimmed : `#${trimmed}`).toLowerCase();
}

function darkenHex(hex: string, amount = 0.15): string {
  const match = /^#?([0-9a-fA-F]{6})$/.exec(hex);
  if (!match) return hex;
  const num = Number.parseInt(match[1], 16);
  const r = Math.max(0, Math.round(((num >> 16) & 0xff) * (1 - amount)));
  const g = Math.max(0, Math.round(((num >> 8) & 0xff) * (1 - amount)));
  const b = Math.max(0, Math.round((num & 0xff) * (1 - amount)));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

export function TenantBrandingCard(props: TenantBrandingCardProps) {
  const {
    form,
    loading,
    loadError,
    saving,
    hasChanges,
    saveState,
    colorValue,
    suggestedColors,
    contrast,
    logoPreviewUrl,
    logoFileName,
    primaryActionLabel,
    onColorPick,
    onLogoSelect,
    onRemoveLogo,
    onCancel,
    onSubmit,
  } = props;

  const normalizedColor = useMemo(() => normalizeHex(colorValue) ?? "#0f172a", [colorValue]);
  const sidebarBodyColor = useMemo(() => darkenHex(normalizedColor, 0.18), [normalizedColor]);
  const showLowContrastWarning = contrast.whiteContrast < 4.5;

  const [hexDraft, setHexDraft] = useState<string>(normalizedColor);
  const [hexError, setHexError] = useState(false);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setHexDraft(normalizedColor);
  }, [normalizedColor]);

  useEffect(() => {
    return () => {
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    };
  }, []);

  function commitHex(raw: string) {
    const next = normalizeHex(raw);
    if (!next) {
      setHexError(true);
      setHexDraft(normalizedColor);
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
      errorTimerRef.current = setTimeout(() => setHexError(false), 1500);
      return;
    }
    setHexError(false);
    setHexDraft(next);
    if (next !== normalizedColor) onColorPick(next);
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-[var(--slate-900)] sm:text-2xl">Branding del edificio</h2>
        <p className="mt-1 text-sm text-[var(--slate-600)]">Configuración visual e identidad del edificio.</p>
      </div>

      <Card className="space-y-4 p-5 md:p-6">
        <div>
          <CardTitle>Configuración visual</CardTitle>
          <CardDescription className="mt-1">Define color del sidebar y logo institucional del edificio.</CardDescription>
        </div>

        {loadError ? (
          <p className="rounded-xl border border-[var(--amber-300)] bg-[var(--amber-50)] px-3 py-2 text-xs text-[var(--amber-900)]">
            {loadError}
          </p>
        ) : null}

        <form className="space-y-5" onSubmit={form.handleSubmit((values) => void onSubmit(values))}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm text-[var(--slate-700)]">
              Nombre del edificio
              <Input {...form.register("tenantName")} placeholder="Conjunto Portal Norte" />
              {form.formState.errors.tenantName ? (
                <p className="mt-1 text-xs text-[var(--danger-700)]">{form.formState.errors.tenantName.message}</p>
              ) : null}
            </label>
            <label className="text-sm text-[var(--slate-700)]">
              Nombre visible (opcional)
              <Input {...form.register("tenantDisplayName")} placeholder="Portal Norte" />
              {form.formState.errors.tenantDisplayName ? (
                <p className="mt-1 text-xs text-[var(--danger-700)]">{form.formState.errors.tenantDisplayName.message}</p>
              ) : null}
            </label>
          </div>

          <div className="space-y-4 rounded-2xl border border-[var(--slate-200)] bg-[var(--slate-50)]/60 p-4">
            <p className="text-sm font-medium text-[var(--slate-900)]">Color del sidebar</p>

            {/* Live preview */}
            <div
              aria-hidden="true"
              className="overflow-hidden rounded-[10px] border border-[var(--slate-200)]"
              style={{ width: "100%", maxWidth: 260, height: 130 }}
            >
              <div
                className="flex h-7 items-center px-3"
                style={{ backgroundColor: normalizedColor }}
              >
                <span style={{ color: "#ffffff", fontWeight: 600, fontSize: 13, letterSpacing: "0.02em" }}>
                  VIVARU
                </span>
              </div>
              <div className="h-[102px] py-2" style={{ backgroundColor: sidebarBodyColor }}>
                <p
                  style={{
                    fontSize: 10,
                    color: "rgba(255,255,255,0.45)",
                    marginLeft: 12,
                    marginBottom: 6,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                  }}
                >
                  CONFIGURACIÓN
                </p>
                {[
                  { label: "Usuarios", active: false },
                  { label: "Documentos", active: false },
                  { label: "Perfil del edificio", active: true },
                ].map((item) => (
                  <div
                    key={item.label}
                    style={{
                      padding: "6px 12px",
                      fontSize: 12,
                      color: "#ffffff",
                      opacity: item.active ? 1 : 0.75,
                      backgroundColor: item.active ? "rgba(255,255,255,0.12)" : "transparent",
                    }}
                  >
                    {item.label}
                  </div>
                ))}
              </div>
            </div>

            {/* Swatches + hex */}
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                {suggestedColors.map((color) => {
                  const isActive = color.toLowerCase() === normalizedColor;
                  return (
                    <button
                      key={color}
                      type="button"
                      onClick={() => onColorPick(color)}
                      aria-label={`Seleccionar color ${color}`}
                      className="vivaru-color-swatch"
                      style={{
                        backgroundColor: color,
                        outline: isActive ? `2.5px solid ${color}` : "none",
                        outlineOffset: 3,
                      }}
                    />
                  );
                })}
              </div>
              <Input
                value={hexDraft}
                onChange={(event) => {
                  const v = event.target.value;
                  setHexDraft(v);
                  const next = normalizeHex(v);
                  if (next) {
                    setHexError(false);
                    if (next !== normalizedColor) onColorPick(next);
                  }
                }}
                onBlur={(event) => commitHex(event.target.value)}
                placeholder="#000000"
                aria-label="Color en formato hexadecimal"
                className="w-[110px]"
                style={{
                  borderColor: hexError ? "var(--danger-500, #dc2626)" : undefined,
                  transition: "border-color 200ms ease",
                }}
              />
            </div>

            {showLowContrastWarning ? (
              <p
                role="status"
                className="flex items-center gap-1.5 text-xs"
                style={{ color: "var(--amber-700, #b45309)" }}
              >
                <span aria-hidden="true">⚠</span>
                El texto blanco puede ser difícil de leer con este color
              </p>
            ) : null}

            {form.formState.errors.brandColor ? (
              <p className="text-xs text-[var(--danger-700)]">{form.formState.errors.brandColor.message}</p>
            ) : null}
          </div>

          <div className="space-y-3 rounded-2xl border border-[var(--slate-200)] p-4">
            <p className="text-sm font-medium text-[var(--slate-900)]">Logo compania</p>
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex cursor-pointer items-center rounded-xl border border-[var(--slate-300)] bg-white px-4 py-2 text-sm font-medium text-[var(--slate-800)] hover:bg-[var(--slate-100)]">
                Elegir archivo
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  className="sr-only"
                  onChange={(event) => onLogoSelect(event.target.files?.[0] ?? null)}
                />
              </label>
              <span className="text-sm text-[var(--slate-600)]">{logoFileName || "Ningun archivo seleccionado"}</span>
              <Button type="button" variant="outline" onClick={onRemoveLogo} disabled={saving}>
                Quitar logo
              </Button>
            </div>
            <p className="text-xs text-[var(--slate-500)]">PNG, JPG o WEBP. Max 1.2MB. Proporcion horizontal recomendada.</p>

            <div className="rounded-xl border border-dashed border-[var(--slate-300)] bg-[var(--slate-50)] p-4">
              {logoPreviewUrl ? (
                <img src={logoPreviewUrl} alt="Preview logo edificio" className="h-20 max-w-full rounded-lg bg-white object-contain p-2" />
              ) : (
                <p className="text-sm text-[var(--slate-500)]">Sin logo configurado.</p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--slate-200)] pt-4">
            <p className="text-xs text-[var(--slate-500)]">
              {saveState === "saved" ? "Guardado correctamente." : loading ? "Cargando configuración..." : "Edita y guarda para aplicar cambios."}
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onCancel} disabled={saving || !hasChanges}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving || !hasChanges}>
                {primaryActionLabel}
              </Button>
            </div>
          </div>
        </form>
      </Card>
    </section>
  );
}
