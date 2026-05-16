"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ExternalLink, FilterX, FolderOpen, Trash2, Upload } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { toastFirebaseError } from "@/lib/utils/error-handler";

import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { MobileFiltersPanel } from "@/components/shared/mobile-filters-panel";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { IconBadge } from "@/components/ui/icon-badge";
import { Input } from "@/components/ui/input";
import { documentSchema, type DocumentInput } from "@/features/admin/schemas";
import {
  deleteDocumentItem,
  uploadDocumentForTenant,
  watchDocuments,
  type DocumentItem,
} from "@/features/admin/services";
import { useAuth } from "@/features/auth/auth-context";

export default function AdminDocumentsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");

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
    setUploading(true);
    try {
      await uploadDocumentForTenant({
        tenantId: user.tenantId,
        userId: user.uid,
        file,
        description: values.description,
      });
      setFile(null);
      form.reset();
      toast.success("Documento subido y registrado.");
    } catch (error) {
      toastFirebaseError(error);
    } finally {
      setUploading(false);
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
      if (query.length === 0) return true;
      return `${item.fileName} ${item.description}`.toLowerCase().includes(query);
    });
  }, [items, searchFilter]);

  const columns: DataTableColumn<DocumentItem>[] = [
    {
      key: "fileName",
      header: "Archivo",
      render: (item) => <span className="font-medium text-[var(--slate-900)]">{item.fileName}</span>,
    },
    {
      key: "description",
      header: "Descripcion",
      render: (item) => item.description,
    },
    {
      key: "createdAt",
      header: "Fecha",
      render: (item) => (item.createdAt ? new Date(item.createdAt).toLocaleString() : "-"),
    },
  ];

  return (
    <Card>
      <CardTitle help="Centraliza los archivos clave del conjunto: actas de asamblea, contratos, planos y memorias. Tener los documentos organizados y accesibles evita pérdidas de información crítica y facilita cualquier auditoría o revisión legal.">Repositorio documental</CardTitle>
      <CardDescription className="mt-1">Sube y organiza los documentos oficiales del conjunto.</CardDescription>

      <form className="mt-4 grid gap-3 md:grid-cols-[1fr_2fr_auto]" onSubmit={form.handleSubmit((values) => void handleUpload(values))}>
        <div className="text-sm text-[var(--slate-700)]">
          <p className="mb-1">Seleccionar archivo</p>
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--slate-300)] bg-white p-2">
            <Button type="button" variant="outline" onClick={() => document.getElementById("tenant-document-file")?.click()}>
              <IconBadge tone="sky" className="mr-2">
                <FolderOpen className="h-4 w-4" />
              </IconBadge>
              Elegir archivo
            </Button>
            <span className="text-xs text-[var(--slate-600)]">{file?.name ?? "Ningun archivo seleccionado"}</span>
          </div>
          <input
            id="tenant-document-file"
            className="sr-only"
            type="file"
            accept="application/pdf"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </div>
        <label className="text-sm text-[var(--slate-700)]">
          Descripcion
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

      <div className="mt-4 space-y-3">
        <MobileFiltersPanel
          title="Filtros de documentos"
          footer={
            <Button className="w-full md:w-auto" type="button" variant="outline" onClick={() => setSearchFilter("")}>
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
              placeholder="Nombre de archivo o descripcion"
              value={searchFilter}
              onChange={(event) => setSearchFilter(event.target.value)}
            />
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
          tableMinWidthClassName="min-w-[720px] sm:min-w-[920px]"
          renderActions={(item) => (
            <div className="flex flex-wrap gap-2">
              <a href={item.fileUrl} target="_blank" rel="noreferrer">
                <Button className="w-full sm:w-auto" size="sm" variant="outline" type="button">
                  <IconBadge tone="sky" className="mr-2">
                    <ExternalLink className="h-4 w-4" />
                  </IconBadge>
                  Abrir
                </Button>
              </a>
              <Button className="w-full sm:w-auto" size="sm" variant="danger" type="button" onClick={() => void handleDelete(item)}>
                <IconBadge tone="peach" className="mr-2">
                  <Trash2 className="h-4 w-4" />
                </IconBadge>
                Eliminar
              </Button>
            </div>
          )}
        />
      </div>
    </Card>
  );
}
