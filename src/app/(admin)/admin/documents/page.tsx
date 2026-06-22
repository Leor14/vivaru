"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Download, ExternalLink, FilterX, FolderOpen, Star, Trash2, Upload } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { toastFirebaseError } from "@/lib/utils/error-handler";

import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { DocumentFoldersBrowser } from "@/components/features/admin/documents/folders-browser";
import { HelpTip } from "@/components/shared/help-tip";
import { MobileFiltersPanel } from "@/components/shared/mobile-filters-panel";
import { SectionIntro } from "@/components/shared/section-intro";
import { getDocumentDownloadUrlCallable } from "@/lib/firebase/callables";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { IconBadge } from "@/components/ui/icon-badge";
import { Input } from "@/components/ui/input";
import { documentSchema, type DocumentInput } from "@/features/admin/schemas";
import {
  deleteDocumentItem,
  setDocumentStarred,
  uploadDocumentForTenant,
  watchDocuments,
  type DocumentCategory,
  type DocumentItem,
} from "@/features/admin/services";
import { useAuth } from "@/features/auth/auth-context";

const CATEGORY_OPTIONS: { value: DocumentCategory; label: string }[] = [
  { value: "asamblea", label: "Asamblea" },
  { value: "contrato", label: "Contrato" },
  { value: "plano", label: "Plano" },
  { value: "memoria", label: "Memoria" },
  { value: "financiero", label: "Financiero" },
  { value: "legal", label: "Legal" },
  { value: "comunicado", label: "Comunicados" },
  { value: "acuerdo", label: "Acuerdos" },
  { value: "comprobante", label: "Comprobantes de pago" },
  { value: "otro", label: "Otro" },
];
const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(CATEGORY_OPTIONS.map((c) => [c.value, c.label]));
const ACCEPTED_TYPES =
  "application/pdf,image/jpeg,image/png,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const MAX_FILE_SIZE = 25 * 1024 * 1024;

export default function AdminDocumentsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState<DocumentCategory>("otro");
  const [uploading, setUploading] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");
  const [starredOnly, setStarredOnly] = useState(false);
  const [tab, setTab] = useState<"carpetas" | "todos">("todos");
  const [folderParam, setFolderParam] = useState<string | null>(null);

  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get("folder");
    if (param) {
      setFolderParam(param);
      setTab("carpetas");
    }
  }, []);

  const form = useForm<DocumentInput>({
    resolver: zodResolver(documentSchema),
    defaultValues: {
      description: "",
    },
  });

  useEffect(() => {
    if (!user?.tenantId) {
      setLoading(false);
      return;
    }

    const unsub = watchDocuments(
      user.tenantId,
      (data) => {
        setItems(data);
        setLoading(false);
      },
      (message) => {
        toast.error(message);
        setLoading(false);
      },
    );

    return () => unsub();
  }, [user?.tenantId]);

  async function handleUpload(values: DocumentInput) {
    if (!user?.tenantId || !file) {
      toast.error("Selecciona un archivo antes de subir.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error("El archivo supera el límite de 25 MB.");
      return;
    }
    setUploading(true);
    try {
      await uploadDocumentForTenant({
        tenantId: user.tenantId,
        userId: user.uid,
        userName: user.fullName,
        file,
        description: values.description,
        category,
      });
      setFile(null);
      setCategory("otro");
      form.reset();
      toast.success("Documento subido y registrado.");
    } catch (error) {
      toastFirebaseError(error);
    } finally {
      setUploading(false);
    }
  }

  async function toggleStar(item: DocumentItem) {
    try {
      await setDocumentStarred({ documentId: item.id, starred: !item.starred });
    } catch (error) {
      toastFirebaseError(error);
    }
  }

  async function openDocument(item: DocumentItem) {
    const w = window.open("about:blank", "_blank");
    try {
      const { url } = await getDocumentDownloadUrlCallable({ documentId: item.id });
      if (w) w.location.href = url;
      else window.open(url, "_blank");
    } catch (error) {
      if (w) w.close();
      toastFirebaseError(error);
    }
  }

  async function downloadDocument(item: DocumentItem) {
    try {
      const { url } = await getDocumentDownloadUrlCallable({ documentId: item.id });
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error("fetch failed");
        const blob = await res.blob();
        const objUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = objUrl;
        a.download = item.fileName || "documento";
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(objUrl);
      } catch {
        window.open(url, "_blank", "noopener");
      }
    } catch (error) {
      toastFirebaseError(error);
    }
  }

  async function handleDelete(item: DocumentItem) {
    if (!window.confirm(`Eliminar documento ${item.fileName}?`)) return;
    try {
      await deleteDocumentItem({
        documentId: item.id,
        storagePath: item.storagePath,
      });
      toast.success("Documento eliminado.");
    } catch (error) {
      toastFirebaseError(error);
    }
  }

  const filteredItems = useMemo(() => {
    const query = searchFilter.trim().toLowerCase();
    return items.filter((item) => {
      // El reglamento tiene su propio módulo; no se mezcla en este repositorio.
      if ((item.category as string) === "reglamento") return false;
      if (starredOnly && !item.starred) return false;
      if (query.length === 0) return true;
      return `${item.fileName} ${item.description}`.toLowerCase().includes(query);
    });
  }, [items, searchFilter, starredOnly]);

  const columns: DataTableColumn<DocumentItem>[] = [
    {
      key: "fileName",
      header: "Archivo",
      render: (item) => <span className="font-medium text-[var(--slate-900)]">{item.fileName}</span>,
    },
    {
      key: "category",
      header: "Categoría",
      render: (item) =>
        item.category ? (
          <span className="rounded-full bg-[var(--slate-100)] px-2 py-0.5 text-xs font-medium text-[var(--slate-700)]">
            {CATEGORY_LABEL[item.category] ?? item.category}
          </span>
        ) : (
          <span className="text-[var(--slate-400)]">—</span>
        ),
    },
    {
      key: "description",
      header: "Descripción",
      render: (item) => item.description,
    },
    {
      key: "uploadedByName",
      header: "Subido por",
      render: (item) => item.uploadedByName || <span className="text-[var(--slate-400)]">—</span>,
    },
    {
      key: "createdAt",
      header: "Fecha",
      render: (item) => (item.createdAt ? new Date(item.createdAt).toLocaleString() : "-"),
    },
  ];

  return (
    <section className="space-y-4">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--slate-100)]">
          <FolderOpen className="h-5 w-5 text-[var(--slate-600)]" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-[var(--slate-900)]">Documentos</h1>
            <HelpTip text="Centraliza los archivos oficiales del conjunto: actas, contratos, planos y memorias. Tenerlos organizados evita pérdidas de información crítica y facilita cualquier auditoría o revisión legal." />
          </div>
          <p className="text-sm text-[var(--slate-500)]">Repositorio de archivos oficiales del conjunto, solo para la administración.</p>
        </div>
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 border-b border-[var(--slate-200)]">
        {([
          ["carpetas", "Carpetas"],
          ["todos", "Todos los documentos"],
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

      {tab === "carpetas" ? (
        <>
          <SectionIntro
            storageKey="documentos-carpetas"
            title="Carpetas"
            purpose="Organiza los documentos del conjunto en carpetas para encontrarlos fácil."
            how="Crea carpetas, agrupa los documentos dentro y muévelos entre ellas cuando lo necesites."
          />
          <Card>
            <DocumentFoldersBrowser tenantId={user?.tenantId} documents={items} initialFolderId={folderParam} />
          </Card>
        </>
      ) : null}

      {tab === "todos" ? (
        <>
          <SectionIntro
            storageKey="documentos-todos"
            title="Todos los documentos"
            purpose="Todos los archivos oficiales del conjunto, reunidos en un solo lugar."
            how="Sube un archivo, asígnale una categoría y una descripción, y luego búscalo o ábrelo desde el listado."
          />
          <Card>
            <div className="rounded-xl border border-[var(--slate-200)] bg-[var(--slate-50)] p-4">
              <p className="text-sm font-semibold text-[var(--slate-800)]">Subir documento</p>
              <form className="mt-3 grid gap-3 md:grid-cols-[1.2fr_1fr_1.4fr_auto] md:items-end" onSubmit={form.handleSubmit((values) => void handleUpload(values))}>
        <div className="text-sm text-[var(--slate-700)]">
          <p className="mb-1 flex items-center gap-1">
            Seleccionar archivo
            <HelpTip text="Sube documentos oficiales del conjunto (PDF, imágenes JPG/PNG u Office) de hasta 25 MB. El archivo se guarda aislado por conjunto y solo la administración puede verlo. Asígnale una categoría para mantener el repositorio ordenado y evitar un listado abultado." />
          </p>
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--slate-300)] bg-white p-2">
            <Button type="button" variant="outline" onClick={() => document.getElementById("tenant-document-file")?.click()}>
              <IconBadge tone="sky" className="mr-2">
                <FolderOpen className="h-4 w-4" />
              </IconBadge>
              Elegir archivo
            </Button>
            <span className="text-xs text-[var(--slate-600)]">{file?.name ?? "Ningún archivo seleccionado"}</span>
          </div>
          <input
            id="tenant-document-file"
            className="sr-only"
            type="file"
            accept={ACCEPTED_TYPES}
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </div>
        <label className="text-sm text-[var(--slate-700)]">
          Categoría
          <select
            className="mt-1 block h-10 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm"
            value={category}
            onChange={(event) => setCategory(event.target.value as DocumentCategory)}
          >
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </label>
        <label className="text-sm text-[var(--slate-700)]">
          Descripción
          <Input {...form.register("description")} placeholder="Acta consejo marzo 2026" />
          {form.formState.errors.description ? <p className="mt-1 text-xs text-[var(--danger-700)]">{form.formState.errors.description.message}</p> : null}
        </label>
        <div className="flex items-end">
          <Button className="w-full md:w-auto" type="submit" disabled={uploading || !file}>
            <IconBadge tone="mint" className="mr-2">
              <Upload className="h-4 w-4" />
            </IconBadge>
            {uploading ? "Subiendo..." : "Subir"}
          </Button>
        </div>
              </form>
            </div>

            <div className="mt-6 space-y-3">
        <MobileFiltersPanel
          title="Filtros de documentos"
          footer={
            <Button className="w-full md:w-auto" type="button" variant="outline" onClick={() => { setSearchFilter(""); setStarredOnly(false); }}>
              <IconBadge tone="sand" className="mr-2">
                <FilterX className="h-4 w-4" />
              </IconBadge>
              Limpiar filtros
            </Button>
          }
        >
          <label className="text-sm text-[var(--slate-700)]">
            Buscar
            <Input
              className="mt-1"
              placeholder="Nombre de archivo o descripción"
              value={searchFilter}
              onChange={(event) => setSearchFilter(event.target.value)}
            />
          </label>
          <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm text-[var(--slate-700)]">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-[var(--slate-300)] accent-[var(--brand-700)]"
              checked={starredOnly}
              onChange={(event) => setStarredOnly(event.target.checked)}
            />
            <Star className="h-4 w-4" style={{ fill: "#EF9F27", color: "#EF9F27" }} />
            Solo destacados
          </label>
        </MobileFiltersPanel>

        <DataTable
          columns={columns}
          rows={filteredItems}
          getRowKey={(item) => item.id}
          loading={loading}
          loadingText="Cargando documentos..."
          emptyText="No hay documentos con los filtros actuales."
          actionsHeader="Acciones"
          tableMinWidthClassName="min-w-[1040px] sm:min-w-[1240px]"
          renderActions={(item) => (
            <div className="flex items-center justify-end gap-2 whitespace-nowrap">
              <button
                type="button"
                aria-label={item.starred ? "Quitar de destacados" : "Destacar"}
                onClick={() => void toggleStar(item)}
                className="rounded-md p-1.5 text-[var(--slate-400)] hover:bg-[var(--slate-100)]"
              >
                <Star className="h-4 w-4" style={item.starred ? { fill: "#EF9F27", color: "#EF9F27" } : undefined} />
              </button>
              <Button size="sm" variant="outline" type="button" onClick={() => void openDocument(item)}>
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                Abrir
              </Button>
              <Button size="sm" variant="outline" type="button" onClick={() => void downloadDocument(item)}>
                <Download className="mr-1.5 h-3.5 w-3.5" />
                Descargar
              </Button>
              <Button size="sm" variant="danger" type="button" onClick={() => void handleDelete(item)}>
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Eliminar
              </Button>
            </div>
          )}
        />
            </div>
          </Card>
        </>
      ) : null}
    </section>
  );
}
