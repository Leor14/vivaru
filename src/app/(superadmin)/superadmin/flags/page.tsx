"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Power, ShieldOff } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/features/auth/auth-context";
import {
  setFeatureFlagEnabled,
  setFeatureFlagKillSwitch,
  setMasterKillSwitch,
  setTenantFeatureFlagOverride,
  watchFeatureFlagOverrides,
  watchFeatureFlags,
  type TenantOverridesRow,
} from "@/features/superadmin/feature-flags-service";
import { watchTenants, type TenantWorkspaceItem } from "@/features/superadmin/services";
import {
  FEATURE_FLAG_AREA_LABEL,
  FEATURE_FLAG_CATALOG,
  featureFlagKeysByArea,
  isKnownFeatureFlag,
  type FeatureFlagKey,
} from "@/lib/feature-flags/catalog";
import {
  FEATURE_FLAG_SOURCE_LABEL,
  resolveFeatureFlag,
  type FeatureFlagDoc,
  type GlobalFeatureFlagDoc,
} from "@/lib/feature-flags/resolve";
import { toastFirebaseError } from "@/lib/utils/error-handler";

const SELECT_CLASS =
  "h-10 rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm text-[var(--slate-900)] outline-none focus:border-[var(--brand-700)] focus:ring-2 focus:ring-[var(--brand-200)]";

/**
 * Consola de banderas (Paso 1.1 de `docs/hoja-de-ruta-ia.md`).
 *
 * Existe porque «apagar tiene que ser gratis». Editar el documento a mano en la
 * consola de Firestore también funciona y sigue siendo el camino documentado;
 * esto es lo que hace que apagar a las tres de la mañana no dependa de recordar
 * en qué colección estaba y qué campo mandaba sobre cuál.
 */
export default function SuperadminFlagsPage() {
  const { user } = useAuth();
  const actorUid = user?.uid ?? "desconocido";

  const [flagDocs, setFlagDocs] = useState<Record<string, FeatureFlagDoc>>({});
  const [globalDoc, setGlobalDoc] = useState<GlobalFeatureFlagDoc | null>(null);
  const [overrides, setOverrides] = useState<TenantOverridesRow[]>([]);
  const [tenants, setTenants] = useState<TenantWorkspaceItem[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [killReason, setKillReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    try {
      const unsubFlags = watchFeatureFlags(
        ({ flags, global }) => {
          setFlagDocs(flags);
          setGlobalDoc(global);
        },
        (message) => setLoadError(message),
      );
      const unsubOverrides = watchFeatureFlagOverrides(setOverrides, (message) => setLoadError(message));
      const unsubTenants = watchTenants(setTenants, (message) => setLoadError(message));

      return () => {
        unsubFlags();
        unsubOverrides();
        unsubTenants();
      };
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "No fue posible leer las banderas.");
      return undefined;
    }
  }, []);

  const masterKillActive = globalDoc?.killSwitch === true;
  const tenantNameById = useMemo(
    () => new Map(tenants.map((tenant) => [tenant.id, tenant.name])),
    [tenants],
  );

  /** Documentos en Firestore que no están en el catálogo: casi siempre un typo. */
  const unknownFlagIds = useMemo(
    () => Object.keys(flagDocs).filter((id) => !isKnownFeatureFlag(id)).sort(),
    [flagDocs],
  );

  const overridesByFlag = useMemo(() => {
    const map = new Map<string, Array<{ tenantId: string; value: boolean }>>();
    for (const row of overrides) {
      for (const [key, value] of Object.entries(row.flags)) {
        const list = map.get(key) ?? [];
        list.push({ tenantId: row.tenantId, value });
        map.set(key, list);
      }
    }
    return map;
  }, [overrides]);

  async function run(action: () => Promise<void>, okMessage: string) {
    setSaving(true);
    try {
      await action();
      toast.success(okMessage);
    } catch (error) {
      toastFirebaseError(error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-[var(--slate-900)]">Banderas de funcionalidad</h1>
        <p className="mt-1 max-w-3xl text-sm text-[var(--slate-600)]">
          Enciende y apaga cualquier capacidad del producto sin desplegar — no solo las de IA. La
          precedencia va de arriba abajo: kill switch maestro, kill switch de la bandera, override
          del conjunto, valor global y default del catálogo. Los dos kill switches mandan sobre los
          overrides — esa es toda su razón de ser.
        </p>
      </div>

      {loadError ? (
        <Card className="border-[var(--danger-600)]">
          <CardTitle>No se pudieron leer las banderas</CardTitle>
          <CardDescription>{loadError}</CardDescription>
          <p className="mt-2 text-sm text-[var(--slate-600)]">
            Mientras tanto todo queda apagado: el lector falla cerrado y el flujo manual sigue.
          </p>
        </Card>
      ) : null}

      <Card className={masterKillActive ? "border-2 border-[var(--danger-600)]" : undefined}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-2xl">
            <CardTitle>
              <span className="inline-flex items-center gap-2">
                <ShieldOff className="h-4 w-4" />
                Kill switch maestro
              </span>
            </CardTitle>
            <CardDescription>
              Apaga todas las banderas de golpe, en todos los conjuntos, sin desplegar. Es lo que se
              baja ante sospecha de fuga entre conjuntos, costo disparado o salidas sistemáticamente
              falsas.
            </CardDescription>
          </div>
          <Badge
            className={
              masterKillActive
                ? "bg-[var(--danger-600)] text-white"
                : "bg-[var(--slate-100)] text-[var(--slate-700)]"
            }
          >
            {masterKillActive ? "PALANCA ABAJO — todo apagado" : "Normal"}
          </Badge>
        </div>

        {masterKillActive ? (
          <div className="mt-3 space-y-2">
            {typeof globalDoc?.reason === "string" && globalDoc.reason ? (
              <p className="text-sm text-[var(--slate-700)]">
                Motivo registrado: <span className="font-medium">{globalDoc.reason}</span>
              </p>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              disabled={saving}
              onClick={() =>
                run(() => setMasterKillSwitch(false, "", actorUid), "Kill switch maestro restablecido.")
              }
            >
              Restablecer
            </Button>
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <div className="w-full max-w-sm">
              <Input
                label="Motivo (queda registrado)"
                placeholder="Ej: costo disparado en el conjunto Las Playas"
                value={killReason}
                onChange={(event) => setKillReason(event.target.value)}
              />
            </div>
            <Button
              variant="danger"
              disabled={saving || killReason.trim().length === 0}
              onClick={() =>
                run(
                  () => setMasterKillSwitch(true, killReason.trim(), actorUid),
                  "Kill switch maestro activado. Todas las banderas quedaron apagadas.",
                )
              }
            >
              Bajar la palanca
            </Button>
          </div>
        )}
      </Card>

      {featureFlagKeysByArea().map((group) => (
        <section key={group.area} className="space-y-3">
          <h2 className="pt-2 text-xs font-semibold uppercase tracking-wide text-[var(--slate-500)]">
            {FEATURE_FLAG_AREA_LABEL[group.area]}
          </h2>
          {group.keys.map((key) => (
            <FlagCard
              key={key}
              flagKey={key}
              doc={flagDocs[key] ?? null}
              globalDoc={globalDoc}
              overrides={overridesByFlag.get(key) ?? []}
              tenants={tenants}
              tenantNameById={tenantNameById}
              saving={saving}
              onSetEnabled={(value) =>
                run(
                  () => setFeatureFlagEnabled(key, value, actorUid),
                  value ? "Bandera encendida globalmente." : "Bandera apagada globalmente.",
                )
              }
              onSetKillSwitch={(value) =>
                run(
                  () => setFeatureFlagKillSwitch(key, value, actorUid),
                  value ? "Kill switch de la bandera activado." : "Kill switch de la bandera retirado.",
                )
              }
              onSetOverride={(tenantId, value) =>
                run(
                  () => setTenantFeatureFlagOverride(tenantId, key, value, actorUid),
                  value === null ? "Override retirado." : "Override guardado.",
                )
              }
            />
          ))}
        </section>
      ))}

      {unknownFlagIds.length > 0 ? (
        <Card className="border-amber-300">
          <CardTitle>
            <span className="inline-flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Documentos fuera del catálogo
            </span>
          </CardTitle>
          <CardDescription>
            Estos documentos existen en <code>featureFlags</code> pero ninguna parte del código los
            lee. Casi siempre es una clave mal escrita: bórralos o corrige el nombre.
          </CardDescription>
          <ul className="mt-2 list-disc pl-5 text-sm text-[var(--slate-700)]">
            {unknownFlagIds.map((id) => (
              <li key={id}>
                <code>{id}</code>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}

function FlagCard({
  flagKey,
  doc,
  globalDoc,
  overrides,
  tenants,
  tenantNameById,
  saving,
  onSetEnabled,
  onSetKillSwitch,
  onSetOverride,
}: {
  flagKey: FeatureFlagKey;
  doc: FeatureFlagDoc | null;
  globalDoc: GlobalFeatureFlagDoc | null;
  overrides: Array<{ tenantId: string; value: boolean }>;
  tenants: TenantWorkspaceItem[];
  tenantNameById: Map<string, string>;
  saving: boolean;
  onSetEnabled: (value: boolean) => void;
  onSetKillSwitch: (value: boolean) => void;
  onSetOverride: (tenantId: string, value: boolean | null) => void;
}) {
  const definition = FEATURE_FLAG_CATALOG[flagKey];
  const [pendingTenant, setPendingTenant] = useState("");

  // Estado sin override: lo que ve un conjunto que no está en la lista de abajo.
  const baseline = resolveFeatureFlag(flagKey, { flag: doc, global: globalDoc, overrides: null });
  const flagKillActive = doc?.killSwitch === true;
  // Sin documento vale el default del catálogo, que no siempre es `false`: una
  // bandera puesta sobre una función que ya está viva nace encendida.
  const globalValue = typeof doc?.enabled === "boolean" ? doc.enabled : definition.defaultEnabled;
  const overriddenIds = new Set(overrides.map((item) => item.tenantId));
  const selectableTenants = tenants.filter((tenant) => !overriddenIds.has(tenant.id));

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <CardTitle>{definition.label}</CardTitle>
          <CardDescription>{definition.description}</CardDescription>
          <p className="mt-1 text-xs text-[var(--slate-500)]">
            <code>{flagKey}</code> · {definition.origen}
          </p>
        </div>
        <div className="text-right">
          <Badge
            className={
              baseline.enabled
                ? "bg-emerald-100 text-emerald-700"
                : "bg-[var(--slate-100)] text-[var(--slate-700)]"
            }
          >
            {baseline.enabled ? "Encendida" : "Apagada"}
          </Badge>
          <p className="mt-1 text-xs text-[var(--slate-500)]">
            {FEATURE_FLAG_SOURCE_LABEL[baseline.source]}
          </p>
        </div>
      </div>

      <p className="mt-3 rounded-xl bg-[var(--slate-50)] px-3 py-2 text-sm text-[var(--slate-700)]">
        <span className="font-medium">Al apagar:</span> {definition.alApagar}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={saving}
          onClick={() => onSetEnabled(!globalValue)}
        >
          <Power className="mr-1.5 h-3.5 w-3.5" />
          {globalValue ? "Apagar globalmente" : "Encender globalmente"}
        </Button>
        <Button
          variant={flagKillActive ? "outline" : "danger"}
          size="sm"
          disabled={saving}
          onClick={() => onSetKillSwitch(!flagKillActive)}
        >
          {flagKillActive ? "Retirar kill switch" : "Kill switch de esta bandera"}
        </Button>
      </div>

      <div className="mt-4 border-t border-[var(--slate-200)] pt-3">
        <p className="text-sm font-medium text-[var(--slate-800)]">Overrides por conjunto</p>
        {overrides.length === 0 ? (
          <p className="mt-1 text-sm text-[var(--slate-500)]">
            Ningún conjunto se aparta del valor global.
          </p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {overrides
              .slice()
              .sort((a, b) => a.tenantId.localeCompare(b.tenantId))
              .map((item) => (
                <li key={item.tenantId} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="min-w-40 text-[var(--slate-800)]">
                    {tenantNameById.get(item.tenantId) ?? item.tenantId}
                  </span>
                  <Badge
                    className={
                      item.value
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-[var(--slate-100)] text-[var(--slate-700)]"
                    }
                  >
                    {item.value ? "encendida" : "apagada"}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="xs"
                    disabled={saving}
                    onClick={() => onSetOverride(item.tenantId, !item.value)}
                  >
                    Invertir
                  </Button>
                  <Button
                    variant="ghost"
                    size="xs"
                    disabled={saving}
                    onClick={() => onSetOverride(item.tenantId, null)}
                  >
                    Quitar override
                  </Button>
                  {flagKillActive || globalDoc?.killSwitch === true ? (
                    <span className="text-xs text-[var(--slate-500)]">
                      (sin efecto: hay un kill switch por encima)
                    </span>
                  ) : null}
                </li>
              ))}
          </ul>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            className={SELECT_CLASS}
            value={pendingTenant}
            onChange={(event) => setPendingTenant(event.target.value)}
            aria-label={`Añadir override de ${definition.label}`}
          >
            <option value="">Añadir conjunto…</option>
            {selectableTenants.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>
                {tenant.name}
              </option>
            ))}
          </select>
          <Button
            variant="outline"
            size="sm"
            disabled={saving || !pendingTenant}
            onClick={() => {
              onSetOverride(pendingTenant, true);
              setPendingTenant("");
            }}
          >
            Encender aquí
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={saving || !pendingTenant}
            onClick={() => {
              onSetOverride(pendingTenant, false);
              setPendingTenant("");
            }}
          >
            Apagar aquí
          </Button>
        </div>
      </div>
    </Card>
  );
}
