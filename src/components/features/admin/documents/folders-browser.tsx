"use client";

import { ChevronRight, ExternalLink, FileText, FolderInput, FolderOpen, FolderPlus, Home } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Modal } from "@/components/shared/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createDocumentFolderCallable } from "@/lib/firebase/callables";
import { toastFirebaseError } from "@/lib/utils/error-handler";
import {
  setDocumentFolder,
  watchDocumentFolders,
  type DocumentFolder,
  type DocumentItem,
} from "@/features/admin/services";

const MAX_DEPTH = 4; // carpeta madre = depth 0; máximo depth 4 (madre + 4 niveles).

export function DocumentFoldersBrowser({ tenantId, documents }: { tenantId?: string; documents: DocumentItem[] }) {
  const [folders, setFolders] = useState<DocumentFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);

  const [moveTarget, setMoveTarget] = useState<DocumentItem | null>(null);
  const [moving, setMoving] = useState(false);

  useEffect(() => {
    if (!tenantId) {
      setLoading(false);
      return;
    }
    const unsub = watchDocumentFolders(
      tenantId,
      (data) => {
        setFolders(data);
        setLoading(false);
      },
      (message) => {
        toast.error(message);
        setLoading(false);
      },
    );
    return () => unsub();
  }, [tenantId]);

  const foldersById = useMemo(() => {
    const map = new Map<string, DocumentFolder>();
    for (const f of folders) map.set(f.id, f);
    return map;
  }, [folders]);

  const currentFolder = currentFolderId ? foldersById.get(currentFolderId) ?? null : null;

  const breadcrumb = useMemo(() => {
    const chain: DocumentFolder[] = [];
    let id: string | null = currentFolderId;
    let guard = 0;
    while (id && guard < 12) {
      const f = foldersById.get(id);
      if (!f) break;
      chain.unshift(f);
      id = f.parentId;
      guard += 1;
    }
    return chain;
  }, [currentFolderId, foldersById]);

  const subfolders = useMemo(
    () => folders.filter((f) => (f.parentId ?? null) === currentFolderId),
    [folders, currentFolderId],
  );
  const folderDocs = useMemo(
    () => documents.filter((d) => (d.folderId ?? null) === currentFolderId && (d.category as string) !== "reglamento"),
    [documents, currentFolderId],
  );

  const canCreateHere = !currentFolder || currentFolder.depth < MAX_DEPTH;

  function folderPathLabel(folder: DocumentFolder): string {
    const names: string[] = [];
    let id: string | null = folder.id;
    let guard = 0;
    while (id && guard < 12) {
      const f = foldersById.get(id);
      if (!f) break;
      names.unshift(f.name);
      id = f.parentId;
      guard += 1;
    }
    return names.join(" / ");
  }

  function childCount(folderId: string): number {
    const subs = folders.filter((f) => f.parentId === folderId).length;
    const docs = documents.filter((d) => d.folderId === folderId).length;
    return subs + docs;
  }

  async function handleCreate() {
    if (!tenantId) return;
    const name = newName.trim();
    if (!name) {
      toast.error("Escribe un nombre para la carpeta.");
      return;
    }
    setCreating(true);
    try {
      await createDocumentFolderCallable({
        tenantId,
        name,
        parentId: currentFolderId,
        description: newDesc.trim() || undefined,
      });
      toast.success("Carpeta creada.");
      setCreateOpen(false);
      setNewName("");
      setNewDesc("");
    } catch (error) {
      toastFirebaseError(error);
    } finally {
      setCreating(false);
    }
  }

  async function handleMove(folderId: string | null) {
    if (!moveTarget) return;
    setMoving(true);
    try {
      await setDocumentFolder({ documentId: moveTarget.id, folderId });
      toast.success("Documento movido.");
      setMoveTarget(null);
    } catch (error) {
      toastFirebaseError(error);
    } finally {
      setMoving(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Breadcrumb + acción */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="flex flex-wrap items-center gap-1 text-sm">
          <button
            type="button"
            onClick={() => setCurrentFolderId(null)}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[var(--slate-600)] hover:bg-[var(--slate-100)]"
          >
            <Home className="h-4 w-4" />
            Inicio
          </button>
          {breadcrumb.map((f) => (
            <span key={f.id} className="flex items-center gap-1">
              <ChevronRight className="h-4 w-4 text-[var(--slate-400)]" />
              <button
                type="button"
                onClick={() => setCurrentFolderId(f.id)}
                className="rounded-md px-2 py-1 text-[var(--slate-700)] hover:bg-[var(--slate-100)]"
              >
                {f.name}
              </button>
            </span>
          ))}
        </nav>

        <Button
          size="sm"
          onClick={() => setCreateOpen(true)}
          disabled={!canCreateHere}
          title={canCreateHere ? undefined : "Máximo 4 niveles de subcarpetas bajo la carpeta madre."}
        >
          <FolderPlus className="mr-2 h-4 w-4" />
          Nueva carpeta
        </Button>
      </div>

      {currentFolder?.description ? (
        <p className="rounded-lg bg-[var(--slate-50)] px-3 py-2 text-sm text-[var(--slate-600)]">{currentFolder.description}</p>
      ) : null}

      {loading ? (
        <p className="py-8 text-center text-sm text-[var(--slate-500)]">Cargando carpetas…</p>
      ) : subfolders.length === 0 && folderDocs.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--slate-300)] py-12 text-center">
          <FolderOpen className="h-8 w-8 text-[var(--slate-400)]" />
          <p className="text-sm text-[var(--slate-500)]">
            {currentFolderId ? "Esta carpeta está vacía." : "Aún no hay carpetas. Crea tu primera carpeta madre."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Subcarpetas */}
          {subfolders.length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {subfolders.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setCurrentFolderId(f.id)}
                  className="flex items-center gap-3 rounded-xl border border-[var(--slate-200)] bg-white p-3 text-left hover:border-[var(--brand-700)] hover:bg-[var(--slate-50)]"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50">
                    <FolderOpen className="h-5 w-5 text-amber-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[var(--slate-900)]">{f.name}</p>
                    <p className="text-xs text-[var(--slate-500)]">{childCount(f.id)} elemento(s)</p>
                  </div>
                </button>
              ))}
            </div>
          ) : null}

          {/* Documentos de la carpeta */}
          {folderDocs.length > 0 ? (
            <div className="divide-y divide-[var(--slate-100)] rounded-xl border border-[var(--slate-200)]">
              {folderDocs.map((d) => (
                <div key={d.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <FileText className="h-4 w-4 shrink-0 text-[var(--slate-500)]" />
                    <span className="truncate text-sm text-[var(--slate-800)]">{d.fileName}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <a href={d.fileUrl} target="_blank" rel="noreferrer">
                      <Button size="sm" variant="ghost" type="button">
                        <ExternalLink className="mr-1 h-3.5 w-3.5" />
                        Abrir
                      </Button>
                    </a>
                    <Button size="sm" variant="ghost" type="button" onClick={() => setMoveTarget(d)}>
                      <FolderInput className="mr-1 h-3.5 w-3.5" />
                      Mover
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}

      {/* Modal: crear carpeta */}
      <Modal open={createOpen} title="Nueva carpeta" onClose={() => setCreateOpen(false)}>
        <div className="space-y-3">
          <p className="text-xs text-[var(--slate-500)]">
            {currentFolder ? `Se creará dentro de "${currentFolder.name}".` : "Se creará como carpeta madre (raíz)."}
          </p>
          <label className="text-sm text-[var(--slate-700)]">
            Nombre
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Actas de asamblea" />
          </label>
          <label className="text-sm text-[var(--slate-700)]">
            Descripción (opcional)
            <Input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Qué contiene esta carpeta" />
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>
              Cancelar
            </Button>
            <Button onClick={() => void handleCreate()} disabled={creating || !newName.trim()}>
              {creating ? "Creando…" : "Crear"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal: mover documento */}
      <Modal open={moveTarget !== null} title="Mover documento" onClose={() => setMoveTarget(null)}>
        <div className="space-y-2">
          <p className="text-xs text-[var(--slate-500)]">Elige la carpeta destino para “{moveTarget?.fileName}”.</p>
          <div className="max-h-[50vh] space-y-1 overflow-y-auto">
            <button
              type="button"
              disabled={moving || (moveTarget?.folderId ?? null) === null}
              onClick={() => void handleMove(null)}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-[var(--slate-100)] disabled:opacity-40"
            >
              <Home className="h-4 w-4 text-[var(--slate-500)]" />
              Raíz (sin carpeta)
            </button>
            {folders.map((f) => (
              <button
                key={f.id}
                type="button"
                disabled={moving || moveTarget?.folderId === f.id}
                onClick={() => void handleMove(f.id)}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-[var(--slate-100)] disabled:opacity-40"
              >
                <FolderOpen className="h-4 w-4 text-amber-500" />
                {folderPathLabel(f)}
              </button>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
}
