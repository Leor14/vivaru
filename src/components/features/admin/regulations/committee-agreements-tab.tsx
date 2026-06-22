"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, FileUp, FolderOpen, Plus, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { Modal } from "@/components/shared/modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  createCommitteeAgreement,
  deleteCommitteeAgreement,
  foldAgreementsIntoFolder,
  sendAgreementToSignature,
  uploadAgreementFile,
} from "@/features/committee-agreements/services";
import { ensureSystemFolderCallable } from "@/lib/firebase/callables";
import type {
  AgreementSignatureMode,
  AgreementSignerScope,
  CommitteeAgreement,
} from "@/features/committee-agreements/types";
import { useCommitteeAgreements } from "@/features/committee-agreements/use-committee-agreements";
import { formatDateSafe } from "@/utils/date";

import { CommitteeAgreementBoard, type BoardPerson, type BoardUnit } from "./committee-agreement-board";

const MODE_LABEL: Record<AgreementSignatureMode, string> = {
  obligatoria: "Firma obligatoria",
  parcial: "Firma parcial",
  informativo: "Informativo",
};

const STATUS_STYLE: Record<CommitteeAgreement["status"], { label: string; className: string }> = {
  borrador: { label: "Borrador", className: "bg-[var(--slate-100)] text-[var(--slate-600)]" },
  enviado: { label: "Enviado", className: "bg-amber-100 text-amber-700" },
  cerrado: { label: "Cerrado", className: "bg-emerald-100 text-emerald-700" },
};

const today = () => new Date().toISOString().slice(0, 10);

export function CommitteeAgreementsTab({
  tenantId,
  userId,
  units,
  peopleByUnitId,
}: {
  tenantId?: string;
  userId?: string;
  units: BoardUnit[];
  peopleByUnitId: ReadonlyMap<string, BoardPerson>;
}) {
  const { items, loading } = useCommitteeAgreements(tenantId);
  const router = useRouter();

  // Carpeta de sistema "Acuerdos de comité": se asegura y se backfillean los existentes.
  const [agreementsFolderId, setAgreementsFolderId] = useState<string | null>(null);
  useEffect(() => {
    if (!tenantId || !userId) return;
    let cancelled = false;
    (async () => {
      try {
        const { folderId } = await ensureSystemFolderCallable({ tenantId, systemKey: "committee_agreements" });
        if (cancelled) return;
        setAgreementsFolderId(folderId);
        await foldAgreementsIntoFolder(tenantId, folderId, userId);
      } catch {
        // best-effort.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tenantId, userId]);

  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [sessionDate, setSessionDate] = useState(today);
  const [mode, setMode] = useState<AgreementSignatureMode>("obligatoria");
  const [scope, setScope] = useState<AgreementSignerScope>("all");
  const [selectedUnits, setSelectedUnits] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const [pendingDelete, setPendingDelete] = useState<CommitteeAgreement | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [boardAgreement, setBoardAgreement] = useState<CommitteeAgreement | null>(null);

  const uploadTargetRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function resetForm() {
    setTitle("");
    setSessionDate(today());
    setMode("obligatoria");
    setScope("all");
    setSelectedUnits([]);
  }

  function toggleUnit(id: string) {
    setSelectedUnits((prev) => (prev.includes(id) ? prev.filter((u) => u !== id) : [...prev, id]));
  }

  async function handleCreate() {
    if (!tenantId || !userId) return;
    if (!title.trim()) {
      toast.error("Ponle un título al acuerdo.");
      return;
    }
    if (scope === "selected" && selectedUnits.length === 0) {
      toast.error("Selecciona al menos una unidad firmante.");
      return;
    }
    setSaving(true);
    try {
      await createCommitteeAgreement({
        tenantId,
        userId,
        title,
        sessionDate,
        signatureMode: mode,
        signerScope: scope,
        signerUnitIds: scope === "selected" ? selectedUnits : undefined,
      });
      toast.success("Acuerdo creado. Ahora puedes cargar el PDF.");
      setCreateOpen(false);
      resetForm();
    } catch {
      toast.error("No se pudo crear el acuerdo.");
    } finally {
      setSaving(false);
    }
  }

  function triggerUpload(agreementId: string) {
    uploadTargetRef.current = agreementId;
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const agreementId = uploadTargetRef.current;
    if (!file || !agreementId || !tenantId || !userId) return;
    if (file.type !== "application/pdf") {
      toast.error("Solo se permiten archivos PDF.");
      return;
    }
    try {
      const agreement = items.find((a) => a.id === agreementId);
      await uploadAgreementFile({ tenantId, userId, agreementId, file, folderId: agreementsFolderId, title: agreement?.title });
      toast.success("PDF cargado.");
    } catch {
      toast.error("No se pudo cargar el PDF.");
    } finally {
      uploadTargetRef.current = null;
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleSend(agreement: CommitteeAgreement) {
    try {
      await sendAgreementToSignature(agreement.id);
      toast.success(
        agreement.signatureMode === "informativo" ? "Acuerdo publicado." : "Acuerdo enviado a firma.",
      );
    } catch {
      toast.error("No se pudo enviar el acuerdo.");
    }
  }

  async function handleConfirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteCommitteeAgreement(pendingDelete.id);
      toast.success("Acuerdo eliminado.");
      setPendingDelete(null);
    } catch {
      toast.error("No se pudo eliminar el acuerdo.");
    } finally {
      setDeleting(false);
    }
  }

  const columns: DataTableColumn<CommitteeAgreement>[] = [
    {
      key: "title",
      header: "Acuerdo",
      render: (a) => (
        <div>
          <span className="font-medium text-[var(--slate-900)]">{a.title}</span>
          <span className="block text-xs text-[var(--slate-500)]">{MODE_LABEL[a.signatureMode]}</span>
        </div>
      ),
    },
    {
      key: "sessionDate",
      header: "Fecha de sesión",
      render: (a) => <span className="text-[var(--slate-700)]">{formatDateSafe(a.sessionDate)}</span>,
    },
    {
      key: "scope",
      header: "Firmantes",
      render: (a) =>
        a.signatureMode === "informativo" ? (
          <span className="text-[var(--slate-400)]">—</span>
        ) : (
          <span className="text-[var(--slate-700)]">
            {a.signerScope === "all" ? "Todas" : `${a.signerUnitIds?.length ?? 0} unidades`}
          </span>
        ),
    },
    {
      key: "status",
      header: "Estado",
      render: (a) => <Badge className={STATUS_STYLE[a.status].className}>{STATUS_STYLE[a.status].label}</Badge>,
    },
    {
      key: "file",
      header: "PDF",
      render: (a) =>
        a.fileUrl ? (
          <button
            type="button"
            onClick={() => window.open(a.fileUrl as string, "_blank")}
            className="inline-flex items-center gap-1 text-xs text-[var(--brand-700)] hover:underline"
          >
            Ver <ExternalLink className="h-3 w-3" />
          </button>
        ) : (
          <span className="text-[var(--slate-400)]">Sin archivo</span>
        ),
    },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle help="Acuerdos de las sesiones de comité. Créalos, carga el PDF y mándalos a firma. Los más recientes aparecen primero.">
              Acuerdos de comité
            </CardTitle>
            <CardDescription className="mt-1">
              {loading ? "Cargando acuerdos…" : `${items.length} acuerdo${items.length !== 1 ? "s" : ""} registrado${items.length !== 1 ? "s" : ""}.`}
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            {agreementsFolderId ? (
              <Button variant="outline" type="button" onClick={() => router.push(`/admin/documents?folder=${agreementsFolderId}`)}>
                <FolderOpen className="mr-2 h-4 w-4" />
                Carpeta de acuerdos
              </Button>
            ) : null}
            <Button onClick={() => setCreateOpen(true)} disabled={!tenantId}>
              <Plus className="mr-2 h-4 w-4" />
              Crear acuerdo
            </Button>
          </div>
        </div>

        <div className="mt-4">
          <DataTable
            columns={columns}
            rows={items}
            getRowKey={(a) => a.id}
            loading={loading}
            loadingText="Cargando acuerdos…"
            emptyText="Aún no hay acuerdos de comité. Crea el primero."
            actionsHeader="Acciones"
            tableMinWidthClassName="min-w-[720px]"
            renderActions={(a) => (
              <div className="flex flex-wrap justify-end gap-1">
                <Button type="button" size="xs" variant="outline" onClick={() => triggerUpload(a.id)}>
                  <FileUp className="mr-1 h-3.5 w-3.5" />
                  {a.fileUrl ? "Reemplazar" : "Cargar PDF"}
                </Button>
                {a.signatureMode !== "informativo" ? (
                  <Button type="button" size="xs" variant="outline" onClick={() => setBoardAgreement(a)}>
                    Firmas
                  </Button>
                ) : null}
                {a.status === "borrador" && a.fileUrl ? (
                  <Button type="button" size="xs" onClick={() => void handleSend(a)}>
                    <Send className="mr-1 h-3.5 w-3.5" />
                    {a.signatureMode === "informativo" ? "Publicar" : "Mandar a firma"}
                  </Button>
                ) : null}
                {a.status === "borrador" ? (
                  <Button
                    type="button"
                    size="xs"
                    variant="ghost"
                    aria-label={`Eliminar ${a.title}`}
                    onClick={() => setPendingDelete(a)}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-[var(--danger-700)]" />
                  </Button>
                ) : null}
              </div>
            )}
          />
        </div>
      </Card>

      <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden" onChange={handleFileChange} />

      <Modal open={createOpen} title="Crear acuerdo de comité" onClose={() => setCreateOpen(false)}>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm text-[var(--slate-700)]">Título</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Acta sesión de comité…" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-[var(--slate-700)]">Fecha de sesión</label>
              <Input type="date" value={sessionDate} onChange={(e) => setSessionDate(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm text-[var(--slate-700)]">Modalidad</label>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as AgreementSignatureMode)}
                className="h-10 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm"
              >
                <option value="obligatoria">Firma obligatoria</option>
                <option value="parcial">Firma parcial</option>
                <option value="informativo">Informativo (sin firma)</option>
              </select>
            </div>
          </div>

          {mode !== "informativo" ? (
            <div>
              <label className="mb-1 block text-sm text-[var(--slate-700)]">Firmantes</label>
              <select
                value={scope}
                onChange={(e) => setScope(e.target.value as AgreementSignerScope)}
                className="h-10 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm"
              >
                <option value="all">Todas las unidades</option>
                <option value="selected">Seleccionar unidades</option>
              </select>
              {scope === "selected" ? (
                <div className="mt-2 max-h-44 space-y-1 overflow-y-auto rounded-xl border border-[var(--slate-200)] p-2">
                  {units.length === 0 ? (
                    <p className="px-1 py-2 text-xs text-[var(--slate-500)]">No hay unidades.</p>
                  ) : (
                    units.map((u) => (
                      <label key={u.id} className="flex items-center gap-2 px-1 py-1 text-sm text-[var(--slate-700)]">
                        <input
                          type="checkbox"
                          checked={selectedUnits.includes(u.id)}
                          onChange={() => toggleUnit(u.id)}
                        />
                        {u.displayName ?? u.id}
                      </label>
                    ))
                  )}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="mobile-action-group">
            <Button className="w-full sm:w-auto" type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button className="w-full sm:w-auto" type="button" onClick={() => void handleCreate()} disabled={saving}>
              {saving ? "Creando…" : "Crear acuerdo"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(boardAgreement)}
        title={boardAgreement ? `Firmas · ${boardAgreement.title}` : "Firmas"}
        onClose={() => setBoardAgreement(null)}
      >
        {boardAgreement ? (
          <CommitteeAgreementBoard
            agreement={boardAgreement}
            tenantId={tenantId}
            units={units}
            peopleByUnitId={peopleByUnitId}
          />
        ) : null}
      </Modal>

      <ConfirmDeleteDialog
        open={Boolean(pendingDelete)}
        name={pendingDelete?.title ?? ""}
        description={pendingDelete ? "Esta acción eliminará el acuerdo en borrador. No se puede deshacer." : null}
        loading={deleting}
        onCancel={() => (deleting ? undefined : setPendingDelete(null))}
        onConfirm={() => void handleConfirmDelete()}
      />
    </div>
  );
}
