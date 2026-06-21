"use client";

import { ChevronRight, ExternalLink, FileText, FolderInput, FolderOpen, FolderPlus, Home, Pencil, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Modal } from "@/components/shared/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createDocumentFolderCallable,
  deleteDocumentFolderCallable,
  getDocumentDownloadUrlCallable,
  updateDocumentFolderCallable,
} from "@/lib/firebase/callables";
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

  const [renameTarget, setRenameTarget] = useState<DocumentFolder | null>(null);
  const [renameName, setRenameName] = useState("");
  const [renameDesc, setRenameDesc] = useState("");
  const [renameSaving, setRenameSaving] = useState(false);
  const [deletingFolder, setDeletingFolder] = useState(false);

  // Web: 1 clic = seleccionar (panel de detalle/preview), doble clic = entrar/abrir.
  // Mobile: 1 toque = entrar/abrir directo (sin panel).
  const [isMobile, setIsMobile] = useState(false);
  const [selected, setSelected] = useState<{ type: "folder" | "doc"; id: string } | null>(null);

  useEffect(() => {
    function check() {
      setIsMobile(window.innerWidth < 768);
    }
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

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
  // Metering: uso total del repositorio (todos los documentos del tenant).
  const usage = useMemo(() => {
    const bytes = documents.reduce((sum, d) => sum + (d.fileSize ?? 0), 0);
    return { count: documents.length, mb: bytes / 1024 / 1024 };
  }, [documents]);

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

  function enterFolder(id: string | null) {
    setSelected(null);
    setCurrentFolderId(id);
  }
  function handleFolderClick(id: string) {
    if (isMobile) enterFolder(id);
    else setSelected({ type: "folder", id });
  }
  async function openDoc(d: DocumentItem) {
    // Pre-abre la pestaña (gesto del usuario) y luego coloca la URL firmada para
    // evitar bloqueadores de pop-ups tras el await.
    const w = window.open("about:blank", "_blank");
    try {
      const { url } = await getDocumentDownloadUrlCallable({ documentId: d.id });
      if (w) w.location.href = url;
      else window.open(url, "_blank");
    } catch (error) {
      if (w) w.close();
      toastFirebaseError(error);
    }
  }
  function handleDocClick(d: DocumentItem) {
    if (isMobile) void openDoc(d);
    else setSelected({ type: "doc", id: d.id });
  }

  function startRename(folder: DocumentFolder) {
    setRenameTarget(folder);
    setRenameName(folder.name);
    setRenameDesc(folder.description ?? "");
  }
  async function handleRename() {
    if (!tenantId || !renameTarget) return;
    const name = renameName.trim();
    if (!name) {
      toast.error("Escribe un nombre.");
      return;
    }
    setRenameSaving(true);
    try {
      await updateDocumentFolderCallable({ tenantId, folderId: renameTarget.id, name, description: renameDesc.trim() });
      toast.success("Carpeta actualizada.");
      setRenameTarget(null);
    } catch (error) {
      toastFirebaseError(error);
    } finally {
      setRenameSaving(false);
    }
  }
  async function handleDeleteFolder(folder: DocumentFolder) {
    if (!tenantId) return;
    if (!window.confirm(`¿Eliminar la carpeta "${folder.name}"? Debe estar vacía (sin subcarpetas ni documentos).`)) return;
    setDeletingFolder(true);
    try {
      await deleteDocumentFolderCallable({ tenantId, folderId: folder.id });
      toast.success("Carpeta eliminada.");
      setSelected(null);
    } catch (error) {
      toastFirebaseError(error);
    } finally {
      setDeletingFolder(false);
    }
  }

  const selectedFolder = selected?.type === "folder" ? foldersById.get(selected.id) ?? null : null;
  const selectedDoc = selected?.type === "doc" ? documents.find((d) => d.id === selected.id) ?? null : null;

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
            onClick={() => enterFolder(null)}
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
                onClick={() => enterFolder(f.id)}
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

      <p className="text-xs text-[var(--slate-400)]">
        {usage.count} archivo(s) · {usage.mb.toFixed(1)} MB usados
        {!isMobile ? " · un clic para ver el detalle, doble clic para abrir" : ""}
      </p>

      <div className={selected && !isMobile ? "grid gap-4 lg:grid-cols-[1fr_340px]" : ""}>
        <div className="min-w-0 space-y-4">
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
                  onClick={() => handleFolderClick(f.id)}
                  onDoubleClick={() => enterFolder(f.id)}
                  className={`flex items-center gap-3 rounded-xl border bg-white p-3 text-left hover:border-[var(--brand-700)] hover:bg-[var(--slate-50)] ${
                    selected?.type === "folder" && selected.id === f.id
                      ? "border-[var(--brand-700)] ring-1 ring-[var(--brand-700)]"
                      : "border-[var(--slate-200)]"
                  }`}
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
                <div
                  key={d.id}
                  className={`flex items-center justify-between gap-3 px-3 py-2 ${
                    selected?.type === "doc" && selected.id === d.id ? "bg-[var(--slate-50)]" : ""
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => handleDocClick(d)}
                    onDoubleClick={() => void openDoc(d)}
                    className="flex min-w-0 items-center gap-2 text-left"
                  >
                    <FileText className="h-4 w-4 shrink-0 text-[var(--slate-500)]" />
                    <span className="truncate text-sm text-[var(--slate-800)]">{d.fileName}</span>
                  </button>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button size="sm" variant="ghost" type="button" onClick={() => void openDoc(d)}>
                      <ExternalLink className="mr-1 h-3.5 w-3.5" />
                      Abrir
                    </Button>
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
        </div>

        {selected && !isMobile ? (
          <aside className="space-y-3 self-start rounded-xl border border-[var(--slate-200)] p-4">
            {selectedFolder ? (
              <>
                <div className="flex items-center gap-2">
                  <FolderOpen className="h-5 w-5 text-amber-500" />
                  <p className="truncate font-medium text-[var(--slate-900)]">{selectedFolder.name}</p>
                </div>
                {selectedFolder.description ? (
                  <p className="text-sm text-[var(--slate-600)]">{selectedFolder.description}</p>
                ) : null}
                <dl className="space-y-1 text-xs text-[var(--slate-500)]">
                  <div className="flex justify-between"><dt>Elementos</dt><dd>{childCount(selectedFolder.id)}</dd></div>
                  <div className="flex justify-between"><dt>Nivel</dt><dd>{selectedFolder.depth + 1}</dd></div>
                  <div className="flex justify-between"><dt>Creada por</dt><dd>{selectedFolder.createdByName || "—"}</dd></div>
                  <div className="flex justify-between">
                    <dt>Fecha</dt>
                    <dd>{selectedFolder.createdAt ? new Date(selectedFolder.createdAt).toLocaleDateString() : "—"}</dd>
                  </div>
                </dl>
                <Button size="sm" className="w-full" onClick={() => enterFolder(selectedFolder.id)}>
                  <FolderOpen className="mr-2 h-4 w-4" />
                  Abrir carpeta
                </Button>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => startRename(selectedFolder)}>
                    <Pencil className="mr-1 h-3.5 w-3.5" />
                    Renombrar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 text-[var(--danger-700)]"
                    disabled={deletingFolder || childCount(selectedFolder.id) > 0}
                    title={childCount(selectedFolder.id) > 0 ? "La carpeta debe estar vacía para eliminarla." : undefined}
                    onClick={() => void handleDeleteFolder(selectedFolder)}
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" />
                    Eliminar
                  </Button>
                </div>
              </>
            ) : selectedDoc ? (
              <>
                <p className="truncate font-medium text-[var(--slate-900)]">{selectedDoc.fileName}</p>
                {selectedDoc.contentType?.startsWith("image/") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={selectedDoc.fileUrl}
                    alt={selectedDoc.fileName}
                    className="max-h-60 w-full rounded-lg bg-[var(--slate-50)] object-contain"
                  />
                ) : selectedDoc.contentType === "application/pdf" || selectedDoc.fileName.toLowerCase().endsWith(".pdf") ? (
                  <iframe
                    title="Vista previa"
                    src={selectedDoc.fileUrl}
                    className="h-64 w-full rounded-lg border border-[var(--slate-200)]"
                  />
                ) : (
                  <div className="flex h-32 items-center justify-center rounded-lg bg-[var(--slate-50)] px-3 text-center text-xs text-[var(--slate-500)]">
                    Sin vista previa. Abre el archivo para verlo.
                  </div>
                )}
                <dl className="space-y-1 text-xs text-[var(--slate-500)]">
                  <div className="flex justify-between"><dt>Categoría</dt><dd>{selectedDoc.category ?? "—"}</dd></div>
                  <div className="flex justify-between"><dt>Subido por</dt><dd>{selectedDoc.uploadedByName || "—"}</dd></div>
                  <div className="flex justify-between">
                    <dt>Fecha</dt>
                    <dd>{selectedDoc.createdAt ? new Date(selectedDoc.createdAt).toLocaleDateString() : "—"}</dd>
                  </div>
                  {selectedDoc.fileSize ? (
                    <div className="flex justify-between">
                      <dt>Tamaño</dt>
                      <dd>{(selectedDoc.fileSize / 1024 / 1024).toFixed(2)} MB</dd>
                    </div>
                  ) : null}
                </dl>
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1" onClick={() => void openDoc(selectedDoc)}>
                    <ExternalLink className="mr-1 h-3.5 w-3.5" />
                    Abrir
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => setMoveTarget(selectedDoc)}>
                    <FolderInput className="mr-1 h-3.5 w-3.5" />
                    Mover
                  </Button>
                </div>
              </>
            ) : null}
          </aside>
        ) : null}
      </div>

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

      {/* Modal: renombrar carpeta */}
      <Modal open={renameTarget !== null} title="Renombrar carpeta" onClose={() => setRenameTarget(null)}>
        <div className="space-y-3">
          <label className="text-sm text-[var(--slate-700)]">
            Nombre
            <Input value={renameName} onChange={(e) => setRenameName(e.target.value)} />
          </label>
          <label className="text-sm text-[var(--slate-700)]">
            Descripción (opcional)
            <Input value={renameDesc} onChange={(e) => setRenameDesc(e.target.value)} />
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRenameTarget(null)} disabled={renameSaving}>
              Cancelar
            </Button>
            <Button onClick={() => void handleRename()} disabled={renameSaving || !renameName.trim()}>
              {renameSaving ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
