"use client";

import {
  Check,
  ChevronRight,
  Database,
  Download,
  ExternalLink,
  FileText,
  FolderInput,
  FolderOpen,
  FolderPlus,
  Home,
  MoreVertical,
  Pencil,
  Star,
  Trash2,
} from "lucide-react";
import { type DragEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Modal } from "@/components/shared/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createDocumentFolderCallable,
  deleteDocumentFolderCallable,
  getDocumentDownloadUrlCallable,
  moveDocumentFolderCallable,
  updateDocumentFolderCallable,
} from "@/lib/firebase/callables";
import { toastFirebaseError } from "@/lib/utils/error-handler";
import {
  setDocumentFolder,
  setDocumentStarred,
  watchDocumentFolders,
  type DocumentFolder,
  type DocumentItem,
} from "@/features/admin/services";

const MAX_DEPTH = 4; // carpeta madre = depth 0; máximo depth 4 (madre + 4 niveles).

// Paleta para diferenciar carpetas (clave → fondo/ícono/anillo). Default: gris.
const FOLDER_COLORS: Record<string, { chipBg: string; chipFg: string; ring: string }> = {
  gray: { chipBg: "#F1EFE8", chipFg: "#444441", ring: "#888780" },
  blue: { chipBg: "#E6F1FB", chipFg: "#0C447C", ring: "#378ADD" },
  green: { chipBg: "#EAF3DE", chipFg: "#27500A", ring: "#639922" },
  amber: { chipBg: "#FAEEDA", chipFg: "#633806", ring: "#BA7517" },
  purple: { chipBg: "#EEEDFE", chipFg: "#3C3489", ring: "#7F77DD" },
  teal: { chipBg: "#E1F5EE", chipFg: "#085041", ring: "#1D9E75" },
  // Color reservado para carpetas del sistema (no seleccionable en el editor).
  system: { chipBg: "#E2E8F0", chipFg: "#334155", ring: "#475569" },
};
// Colores que el admin puede elegir (excluye el reservado "system").
const COLOR_KEYS = ["gray", "blue", "green", "amber", "purple", "teal"] as const;
function folderColor(key?: string) {
  return FOLDER_COLORS[key ?? "gray"] ?? FOLDER_COLORS.gray;
}

export function DocumentFoldersBrowser({
  tenantId,
  documents,
  initialFolderId,
}: {
  tenantId?: string;
  documents: DocumentItem[];
  initialFolderId?: string | null;
}) {
  const [folders, setFolders] = useState<DocumentFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);

  const [moveTarget, setMoveTarget] = useState<DocumentItem | null>(null);
  const [moving, setMoving] = useState(false);
  const [folderMoveTarget, setFolderMoveTarget] = useState<DocumentFolder | null>(null);
  const [movingFolder, setMovingFolder] = useState(false);

  // Drag & drop (solo web). Mantiene el item arrastrado y el destino resaltado.
  const [dragItem, setDragItem] = useState<{ kind: "doc" | "folder"; id: string } | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const [renameTarget, setRenameTarget] = useState<DocumentFolder | null>(null);
  const [renameName, setRenameName] = useState("");
  const [renameDesc, setRenameDesc] = useState("");
  const [renameColor, setRenameColor] = useState<string>("gray");
  const [renameSaving, setRenameSaving] = useState(false);
  const [deletingFolder, setDeletingFolder] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

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
    if (!menuOpenId) return;
    const close = () => setMenuOpenId(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [menuOpenId]);

  useEffect(() => {
    if (initialFolderId) setCurrentFolderId(initialFolderId);
  }, [initialFolderId]);

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
    () =>
      documents.filter((d) => {
        if ((d.folderId ?? null) !== currentFolderId) return false;
        // Reglamentos: solo dentro de su carpeta, nunca en la raíz.
        if ((d.category as string) === "reglamento" && currentFolderId === null) return false;
        return true;
      }),
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

  async function downloadDoc(d: DocumentItem) {
    try {
      const { url } = await getDocumentDownloadUrlCallable({ documentId: d.id });
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error("fetch failed");
        const blob = await res.blob();
        const objUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = objUrl;
        a.download = d.fileName || "documento";
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(objUrl);
      } catch {
        // Si el navegador bloquea el fetch (CORS), abre en pestaña como fallback.
        window.open(url, "_blank", "noopener");
      }
    } catch (error) {
      toastFirebaseError(error);
    }
  }

  function startRename(folder: DocumentFolder) {
    setMenuOpenId(null);
    setRenameTarget(folder);
    setRenameName(folder.name);
    setRenameDesc(folder.description ?? "");
    setRenameColor(folder.color ?? "gray");
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
      await updateDocumentFolderCallable({
        tenantId,
        folderId: renameTarget.id,
        name,
        description: renameDesc.trim(),
        color: renameColor as "gray" | "blue" | "green" | "amber" | "purple" | "teal",
      });
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

  async function handleMoveFolder(targetParentId: string | null) {
    if (!folderMoveTarget || !tenantId) return;
    setMovingFolder(true);
    try {
      await moveDocumentFolderCallable({ tenantId, folderId: folderMoveTarget.id, targetParentId });
      toast.success("Carpeta movida.");
      setFolderMoveTarget(null);
    } catch (error) {
      toastFirebaseError(error);
    } finally {
      setMovingFolder(false);
    }
  }

  function validFolderTargets(folder: DocumentFolder) {
    const prefix = `${folder.path || folder.id}/`;
    return folders.filter((f) => f.id !== folder.id && !(f.path || f.id).startsWith(prefix));
  }

  async function toggleStar(d: DocumentItem) {
    try {
      await setDocumentStarred({ documentId: d.id, starred: !d.starred });
    } catch (error) {
      toastFirebaseError(error);
    }
  }

  // ── Drag & drop (web) ────────────────────────────────────────────────────────
  function canDropOn(targetFolderId: string | null): boolean {
    if (!dragItem) return false;
    if (dragItem.kind === "doc") return true; // un documento puede ir a cualquier carpeta
    const folder = foldersById.get(dragItem.id);
    if (!folder) return false;
    if (targetFolderId === dragItem.id) return false; // no a sí misma
    if (targetFolderId) {
      const target = foldersById.get(targetFolderId);
      if (!target) return false;
      if ((target.path || target.id).startsWith(`${folder.path || folder.id}/`)) return false; // descendiente
    }
    return true;
  }

  async function handleDropOn(targetFolderId: string | null) {
    const item = dragItem;
    setDragItem(null);
    setDragOverId(null);
    if (!item || !tenantId || !canDropOn(targetFolderId)) return;
    try {
      if (item.kind === "doc") {
        await setDocumentFolder({ documentId: item.id, folderId: targetFolderId });
        toast.success("Documento movido.");
      } else {
        await moveDocumentFolderCallable({ tenantId, folderId: item.id, targetParentId: targetFolderId });
        toast.success("Carpeta movida.");
      }
    } catch (error) {
      toastFirebaseError(error);
    }
  }

  // Props de zona-soltable reutilizables (carpetas y breadcrumb).
  function dropTargetProps(targetFolderId: string | null) {
    if (isMobile) return {};
    return {
      onDragOver: (e: DragEvent) => {
        if (canDropOn(targetFolderId)) {
          e.preventDefault();
          setDragOverId(targetFolderId ?? "__root__");
        }
      },
      onDragLeave: () => setDragOverId(null),
      onDrop: (e: DragEvent) => {
        e.preventDefault();
        void handleDropOn(targetFolderId);
      },
    };
  }

  return (
    <div className="space-y-4">
      {/* Breadcrumb + acción */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="flex flex-wrap items-center gap-1 text-sm">
          <button
            type="button"
            onClick={() => enterFolder(null)}
            {...dropTargetProps(null)}
            className={`flex items-center gap-1 rounded-md px-2 py-1 hover:bg-[var(--slate-100)] ${
              dragOverId === "__root__" ? "bg-[var(--brand-100)] text-[var(--brand-700)]" : "text-[var(--slate-600)]"
            }`}
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
                {...dropTargetProps(f.id)}
                className={`rounded-md px-2 py-1 hover:bg-[var(--slate-100)] ${
                  dragOverId === f.id ? "bg-[var(--brand-100)] text-[var(--brand-700)]" : "text-[var(--slate-700)]"
                }`}
              >
                {f.name}
              </button>
            </span>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-1 rounded-md px-2 py-1 text-xs text-[var(--slate-500)] sm:inline-flex">
            <Database className="h-3.5 w-3.5" />
            {usage.count} archivo(s) · {usage.mb.toFixed(1)} MB
          </span>
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
      </div>

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
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--slate-500)]">
                Carpetas · {subfolders.length}
              </p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {subfolders.map((f) => {
                  const c = folderColor(f.color);
                  const isSel = selected?.type === "folder" && selected.id === f.id;
                  const isDropTarget = dragOverId === f.id;
                  return (
                    <div
                      key={f.id}
                      role="button"
                      tabIndex={0}
                      draggable={!isMobile}
                      onDragStart={(e) => {
                        e.stopPropagation();
                        setDragItem({ kind: "folder", id: f.id });
                      }}
                      onDragEnd={() => {
                        setDragItem(null);
                        setDragOverId(null);
                      }}
                      {...dropTargetProps(f.id)}
                      onClick={() => handleFolderClick(f.id)}
                      onDoubleClick={() => enterFolder(f.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") enterFolder(f.id);
                      }}
                      className={`relative flex cursor-pointer items-start gap-3 rounded-xl border bg-white p-3 hover:bg-[var(--slate-50)] ${
                        isDropTarget
                          ? "border-[var(--brand-700)] ring-2 ring-[var(--brand-700)]"
                          : isSel
                            ? ""
                            : "border-[var(--slate-200)]"
                      }`}
                      style={!isDropTarget && isSel ? { borderColor: c.ring, boxShadow: `0 0 0 1px ${c.ring}` } : undefined}
                    >
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                        style={{ backgroundColor: c.chipBg }}
                      >
                        <FolderOpen className="h-5 w-5" style={{ color: c.chipFg }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate pr-5 text-sm font-medium text-[var(--slate-900)]">{f.name}</p>
                        <p className="text-xs text-[var(--slate-500)]">{childCount(f.id)} elemento(s)</p>
                      </div>
                      {f.system ? (
                        <span className="absolute right-2 top-2 rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                          Sistema
                        </span>
                      ) : (
                        <>
                      <button
                        type="button"
                        aria-label="Acciones de carpeta"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpenId(menuOpenId === f.id ? null : f.id);
                        }}
                        className="absolute right-2 top-2 rounded-md p-1 text-[var(--slate-400)] hover:bg-[var(--slate-100)] hover:text-[var(--slate-700)]"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                      {menuOpenId === f.id ? (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="absolute right-2 top-9 z-10 w-36 overflow-hidden rounded-lg border border-[var(--slate-200)] bg-white py-1 shadow-lg"
                        >
                          <button
                            type="button"
                            onClick={() => startRename(f)}
                            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-[var(--slate-100)]"
                          >
                            <Pencil className="h-3.5 w-3.5" /> Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setMenuOpenId(null);
                              setFolderMoveTarget(f);
                            }}
                            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-[var(--slate-100)]"
                          >
                            <FolderInput className="h-3.5 w-3.5" /> Mover
                          </button>
                          <button
                            type="button"
                            disabled={childCount(f.id) > 0}
                            title={childCount(f.id) > 0 ? "La carpeta debe estar vacía." : undefined}
                            onClick={() => {
                              setMenuOpenId(null);
                              void handleDeleteFolder(f);
                            }}
                            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-[var(--danger-700)] hover:bg-[var(--slate-100)] disabled:opacity-40"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Eliminar
                          </button>
                        </div>
                      ) : null}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {/* Documentos de la carpeta */}
          {folderDocs.length > 0 ? (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--slate-500)]">
                Archivos · {folderDocs.length}
              </p>
              <div className="divide-y divide-[var(--slate-100)] rounded-xl border border-[var(--slate-200)]">
                {folderDocs.map((d) => (
                <div
                  key={d.id}
                  draggable={!isMobile}
                  onDragStart={() => setDragItem({ kind: "doc", id: d.id })}
                  onDragEnd={() => {
                    setDragItem(null);
                    setDragOverId(null);
                  }}
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
                    <button
                      type="button"
                      aria-label={d.starred ? "Quitar de destacados" : "Destacar"}
                      onClick={() => void toggleStar(d)}
                      className="rounded-md p-1.5 text-[var(--slate-400)] hover:bg-[var(--slate-100)]"
                    >
                      <Star className="h-4 w-4" style={d.starred ? { fill: "#EF9F27", color: "#EF9F27" } : undefined} />
                    </button>
                    <Button size="sm" variant="ghost" type="button" onClick={() => void openDoc(d)}>
                      <ExternalLink className="mr-1 h-3.5 w-3.5" />
                      Abrir
                    </Button>
                    <Button size="sm" variant="ghost" type="button" onClick={() => void downloadDoc(d)}>
                      <Download className="mr-1 h-3.5 w-3.5" />
                      Descargar
                    </Button>
                    <Button size="sm" variant="ghost" type="button" onClick={() => setMoveTarget(d)}>
                      <FolderInput className="mr-1 h-3.5 w-3.5" />
                      Mover
                    </Button>
                  </div>
                </div>
                ))}
              </div>
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
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                    style={{ backgroundColor: folderColor(selectedFolder.color).chipBg }}
                  >
                    <FolderOpen className="h-4 w-4" style={{ color: folderColor(selectedFolder.color).chipFg }} />
                  </span>
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
                {selectedFolder.system ? (
                  <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
                    Carpeta del sistema: no se puede renombrar, mover ni eliminar.
                  </p>
                ) : (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => startRename(selectedFolder)}>
                    <Pencil className="mr-1 h-3.5 w-3.5" />
                    Editar
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
                )}
              </>
            ) : selectedDoc ? (
              <>
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate font-medium text-[var(--slate-900)]">{selectedDoc.fileName}</p>
                  <button
                    type="button"
                    aria-label={selectedDoc.starred ? "Quitar de destacados" : "Destacar"}
                    onClick={() => void toggleStar(selectedDoc)}
                    className="shrink-0 rounded-md p-1 text-[var(--slate-400)] hover:bg-[var(--slate-100)]"
                  >
                    <Star className="h-4 w-4" style={selectedDoc.starred ? { fill: "#EF9F27", color: "#EF9F27" } : undefined} />
                  </button>
                </div>
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
                <Button size="sm" className="w-full" onClick={() => void openDoc(selectedDoc)}>
                  <ExternalLink className="mr-1 h-3.5 w-3.5" />
                  Abrir
                </Button>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => void downloadDoc(selectedDoc)}>
                    <Download className="mr-1 h-3.5 w-3.5" />
                    Descargar
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

      {/* Modal: editar carpeta */}
      <Modal open={renameTarget !== null} title="Editar carpeta" onClose={() => setRenameTarget(null)}>
        <div className="space-y-3">
          <label className="text-sm text-[var(--slate-700)]">
            Nombre
            <Input value={renameName} onChange={(e) => setRenameName(e.target.value)} />
          </label>
          <label className="text-sm text-[var(--slate-700)]">
            Descripción (opcional)
            <Input value={renameDesc} onChange={(e) => setRenameDesc(e.target.value)} />
          </label>
          <div>
            <p className="text-sm text-[var(--slate-700)]">Color</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {COLOR_KEYS.map((key) => {
                const c = FOLDER_COLORS[key];
                const active = renameColor === key;
                return (
                  <button
                    key={key}
                    type="button"
                    aria-label={`Color ${key}`}
                    onClick={() => setRenameColor(key)}
                    className="flex h-8 w-8 items-center justify-center rounded-full"
                    style={{ backgroundColor: c.ring, outline: active ? "2px solid var(--slate-900)" : "none", outlineOffset: "2px" }}
                  >
                    {active ? <Check className="h-4 w-4 text-white" /> : null}
                  </button>
                );
              })}
            </div>
          </div>
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

      {/* Modal: mover carpeta */}
      <Modal open={folderMoveTarget !== null} title="Mover carpeta" onClose={() => setFolderMoveTarget(null)}>
        <div className="space-y-2">
          <p className="text-xs text-[var(--slate-500)]">Elige la carpeta destino para “{folderMoveTarget?.name}”.</p>
          <div className="max-h-[50vh] space-y-1 overflow-y-auto">
            <button
              type="button"
              disabled={movingFolder || (folderMoveTarget?.parentId ?? null) === null}
              onClick={() => void handleMoveFolder(null)}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-[var(--slate-100)] disabled:opacity-40"
            >
              <Home className="h-4 w-4 text-[var(--slate-500)]" />
              Raíz (sin carpeta madre)
            </button>
            {folderMoveTarget
              ? validFolderTargets(folderMoveTarget).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    disabled={movingFolder || folderMoveTarget.parentId === f.id}
                    onClick={() => void handleMoveFolder(f.id)}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-[var(--slate-100)] disabled:opacity-40"
                  >
                    <FolderOpen className="h-4 w-4 text-amber-500" />
                    {folderPathLabel(f)}
                  </button>
                ))
              : null}
          </div>
        </div>
      </Modal>
    </div>
  );
}
