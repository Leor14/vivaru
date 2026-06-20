"use client";

import { useEffect, useMemo, useState } from "react";
import { deleteField, doc, onSnapshot, updateDoc } from "firebase/firestore";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/firebase/client";
import { toastFirebaseError } from "@/lib/utils/error-handler";
import {
  FIELD_LIMITS,
  NOTIFICATION_CATALOG,
  interpolatePreview,
  validateField,
  type NotificationTemplateDef,
} from "@/features/notifications/catalog";
import type { NotificationTemplateOverride, NotificationTemplates } from "@/types/domain";

const RELEVANCE_PILL: Record<NotificationTemplateDef["relevance"], string> = {
  alta: "bg-rose-100 text-rose-700",
  media: "bg-amber-100 text-amber-700",
  baja: "bg-slate-100 text-slate-600",
};

const INPUT_CLASS =
  "w-full rounded-lg border border-[var(--slate-200)] bg-white px-3 py-2 text-sm text-[var(--slate-900)] placeholder:text-[var(--slate-400)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-700)]";

type FieldKey = "title" | "body" | "emailSubject" | "emailBody";

function FieldError({ message }: { message: string | null }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-[var(--danger-700)]">{message}</p>;
}

function NotificationEditorRow({
  def,
  stored,
  tenantId,
}: {
  def: NotificationTemplateDef;
  stored: NotificationTemplateOverride;
  tenantId: string;
}) {
  const [title, setTitle] = useState(stored.title ?? "");
  const [body, setBody] = useState(stored.body ?? "");
  const [emailEnabled, setEmailEnabled] = useState(stored.emailEnabled ?? false);
  const [emailSubject, setEmailSubject] = useState(stored.emailSubject ?? "");
  const [emailBody, setEmailBody] = useState(stored.emailBody ?? "");
  const [focused, setFocused] = useState<FieldKey>("body");
  const [saving, setSaving] = useState(false);

  const errTitle = validateField(def, title, FIELD_LIMITS.title);
  const errBody = validateField(def, body, FIELD_LIMITS.body);
  const errSubject = emailEnabled ? validateField(def, emailSubject, FIELD_LIMITS.emailSubject) : null;
  const errEmailBody = emailEnabled ? validateField(def, emailBody, FIELD_LIMITS.emailBody) : null;
  const hasError = Boolean(errTitle || errBody || errSubject || errEmailBody);

  const dirty =
    title !== (stored.title ?? "") ||
    body !== (stored.body ?? "") ||
    emailEnabled !== (stored.emailEnabled ?? false) ||
    emailSubject !== (stored.emailSubject ?? "") ||
    emailBody !== (stored.emailBody ?? "");

  const hasOverride = Boolean(
    stored.title || stored.body || stored.emailSubject || stored.emailBody || stored.emailEnabled,
  );

  function insertToken(tokenName: string) {
    const token = `{${tokenName}}`;
    if (focused === "title") setTitle((v) => `${v}${token}`);
    else if (focused === "emailSubject") setEmailSubject((v) => `${v}${token}`);
    else if (focused === "emailBody") setEmailBody((v) => `${v}${token}`);
    else setBody((v) => `${v}${token}`);
  }

  async function handleSave() {
    if (!db || hasError || saving) return;
    setSaving(true);
    try {
      const override: NotificationTemplateOverride = { emailEnabled };
      if (title.trim()) override.title = title.trim();
      if (body.trim()) override.body = body.trim();
      if (emailSubject.trim()) override.emailSubject = emailSubject.trim();
      if (emailBody.trim()) override.emailBody = emailBody.trim();
      await updateDoc(doc(db, "tenantSettings", tenantId), { [`notificationTemplates.${def.key}`]: override });
      toast.success(`"${def.label}" guardado.`);
    } catch (error) {
      toastFirebaseError(error);
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    if (!db || saving) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "tenantSettings", tenantId), { [`notificationTemplates.${def.key}`]: deleteField() });
      toast.success(`"${def.label}" restablecido al texto por defecto.`);
    } catch (error) {
      toastFirebaseError(error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-[var(--slate-200)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-[var(--slate-900)]">{def.label}</span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${RELEVANCE_PILL[def.relevance]}`}>
            {def.relevance}
          </span>
          {hasOverride ? (
            <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-indigo-700">
              Personalizado
            </span>
          ) : null}
        </div>

        {/* Toggle email */}
        <button
          type="button"
          role="switch"
          aria-checked={emailEnabled}
          onClick={() => setEmailEnabled((v) => !v)}
          className="flex items-center gap-2 text-xs font-medium text-[var(--slate-600)]"
        >
          <span
            className="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border-2 border-transparent transition-colors"
            style={{ backgroundColor: emailEnabled ? "var(--brand-700)" : "var(--slate-200)" }}
          >
            <span
              className="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform"
              style={{ transform: emailEnabled ? "translateX(16px)" : "translateX(0px)" }}
            />
          </span>
          También por correo
        </button>
      </div>

      <div className="mt-3 space-y-3">
        <div>
          <label className="text-xs font-medium text-[var(--slate-500)]">Título</label>
          <input
            className={INPUT_CLASS}
            value={title}
            placeholder={def.title}
            onFocus={() => setFocused("title")}
            onChange={(e) => setTitle(e.target.value)}
          />
          <FieldError message={errTitle} />
        </div>

        <div>
          <label className="text-xs font-medium text-[var(--slate-500)]">Mensaje</label>
          <textarea
            className={`${INPUT_CLASS} min-h-[64px] resize-y`}
            value={body}
            placeholder={def.body}
            onFocus={() => setFocused("body")}
            onChange={(e) => setBody(e.target.value)}
          />
          <FieldError message={errBody} />
        </div>

        {emailEnabled ? (
          <>
            <div>
              <label className="text-xs font-medium text-[var(--slate-500)]">Asunto del correo</label>
              <input
                className={INPUT_CLASS}
                value={emailSubject}
                placeholder={def.emailSubject}
                onFocus={() => setFocused("emailSubject")}
                onChange={(e) => setEmailSubject(e.target.value)}
              />
              <FieldError message={errSubject} />
            </div>
            <div>
              <label className="text-xs font-medium text-[var(--slate-500)]">Cuerpo del correo</label>
              <textarea
                className={`${INPUT_CLASS} min-h-[64px] resize-y`}
                value={emailBody}
                placeholder={def.emailBody}
                onFocus={() => setFocused("emailBody")}
                onChange={(e) => setEmailBody(e.target.value)}
              />
              <FieldError message={errEmailBody} />
            </div>
          </>
        ) : null}

        {/* Variables insertables */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-[var(--slate-400)]">Variables:</span>
          {def.variables.map((v) => (
            <button
              key={v.name}
              type="button"
              title={`Ejemplo: ${v.example}`}
              onClick={() => insertToken(v.name)}
              className="rounded-md bg-[var(--slate-100)] px-2 py-0.5 text-xs font-mono text-[var(--slate-600)] hover:bg-[var(--slate-200)]"
            >
              {`{${v.name}}`}
            </button>
          ))}
        </div>

        {/* Vista previa (con valores de ejemplo) */}
        <div className="rounded-lg bg-[var(--slate-50)] p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--slate-400)]">Vista previa</p>
          <p className="mt-1 text-sm font-medium text-[var(--slate-900)]">{interpolatePreview(def, title.trim() || def.title)}</p>
          <p className="text-sm text-[var(--slate-600)]">{interpolatePreview(def, body.trim() || def.body)}</p>
        </div>

        <div className="flex items-center justify-end gap-2">
          {hasOverride ? (
            <Button variant="outline" size="sm" onClick={() => void handleReset()} disabled={saving}>
              Restablecer
            </Button>
          ) : null}
          <Button size="sm" onClick={() => void handleSave()} disabled={!dirty || hasError || saving}>
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function NotificationTemplatesCard({ tenantId }: { tenantId?: string }) {
  const [overrides, setOverrides] = useState<NotificationTemplates>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!tenantId || !db) return;
    const unsub = onSnapshot(doc(db, "tenantSettings", tenantId), (snap) => {
      const data = snap.exists() ? (snap.data() as Record<string, unknown>) : {};
      const raw = data.notificationTemplates;
      setOverrides(typeof raw === "object" && raw ? (raw as NotificationTemplates) : {});
      setLoaded(true);
    });
    return unsub;
  }, [tenantId]);

  const groups = useMemo(() => {
    const map = new Map<string, NotificationTemplateDef[]>();
    for (const def of NOTIFICATION_CATALOG) {
      const list = map.get(def.group) ?? [];
      list.push(def);
      map.set(def.group, list);
    }
    return Array.from(map.entries());
  }, []);

  return (
    <Card>
      <CardTitle help="Personaliza el texto de las notificaciones que reciben los residentes. Si dejas un campo vacío, se usa el texto por defecto que aparece en gris como guía. El correo está desactivado por defecto: actívalo solo en las notificaciones donde lo necesites.">
        Notificaciones a residentes
      </CardTitle>
      <CardDescription className="mt-1">
        Ajusta el copy de cada notificación. El texto en gris es el predeterminado y se usa si dejas el campo vacío.
        Las variables entre llaves se reemplazan automáticamente al enviar.
      </CardDescription>

      {!tenantId || !loaded ? (
        <p className="mt-4 text-sm text-[var(--slate-500)]">Cargando…</p>
      ) : (
        <div className="mt-4 space-y-6">
          {groups.map(([group, defs]) => (
            <div key={group} className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--slate-500)]">{group}</h3>
              {defs.map((def) => (
                <NotificationEditorRow
                  key={`${def.key}:${JSON.stringify(overrides[def.key] ?? {})}`}
                  def={def}
                  stored={overrides[def.key] ?? {}}
                  tenantId={tenantId}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
