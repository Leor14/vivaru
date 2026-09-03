"use client";

import { ChevronDown, ChevronUp, ImageIcon, Loader2, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  deleteAmenityPhoto,
  reorderAmenityPhotos,
  uploadAmenityPhoto,
  type AmenityPhoto,
} from "@/features/admin/services";

interface AmenityPhotoManagerProps {
  amenityId: string;
  tenantId: string;
  photos: AmenityPhoto[];
  onChange: (photos: AmenityPhoto[]) => void;
}

export function AmenityPhotoManager({
  amenityId,
  tenantId,
  photos,
  onChange,
}: AmenityPhotoManagerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      toast.error("Solo se permiten imágenes JPG, PNG o WEBP.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("La imagen no puede superar 5 MB.");
      return;
    }
    if (photos.length >= 8) {
      toast.error("Máximo 8 fotos por amenidad.");
      return;
    }

    setUploading(true);
    try {
      const newPhoto = await uploadAmenityPhoto(tenantId, amenityId, file);
      const updated = [...photos, { ...newPhoto, order: photos.length }];
      await reorderAmenityPhotos(amenityId, updated);
      onChange(updated);
      toast.success("Foto subida correctamente.");
    } catch {
      toast.error("No fue posible subir la foto. Intenta de nuevo.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDelete(photo: AmenityPhoto) {
    setDeletingId(photo.id);
    try {
      const remaining = photos
        .filter((p) => p.id !== photo.id)
        .map((p, i) => ({ ...p, order: i }));
      await deleteAmenityPhoto(amenityId, photo, remaining);
      onChange(remaining);
      toast.success("Foto eliminada.");
    } catch {
      toast.error("No fue posible eliminar la foto.");
    } finally {
      setDeletingId(null);
    }
  }

  async function move(index: number, direction: -1 | 1) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= photos.length) return;
    const reordered = [...photos];
    [reordered[index], reordered[newIndex]] = [reordered[newIndex], reordered[index]];
    const updated = reordered.map((p, i) => ({ ...p, order: i }));
    try {
      await reorderAmenityPhotos(amenityId, updated);
      onChange(updated);
    } catch {
      toast.error("No fue posible reordenar las fotos.");
    }
  }

  const sorted = [...photos].sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-[var(--slate-700)]">
          Fotos ({photos.length}/8)
        </p>
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleFileChange}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || photos.length >= 8}
          >
            {uploading ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <ImageIcon className="mr-1.5 h-3.5 w-3.5" />
            )}
            {uploading ? "Subiendo…" : "Agregar foto"}
          </Button>
        </>
      </div>

      {sorted.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--slate-300)] px-4 py-6 text-center text-sm text-[var(--slate-500)]">
          Sin fotos. Agrega hasta 8 imágenes de esta amenidad.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {sorted.map((photo, index) => (
            <div
              key={photo.id}
              className="group relative overflow-hidden rounded-xl border border-[var(--slate-200)] bg-[var(--surface-soft)]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt={`Foto ${index + 1}`}
                className="aspect-video w-full object-cover"
              />
              {index === 0 && (
                <span className="absolute left-1.5 top-1.5 rounded-full bg-[var(--brand-700)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--on-fill)]">
                  Portada
                </span>
              )}
              <div className="absolute right-1 top-1 flex flex-col gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  type="button"
                  aria-label="Mover arriba"
                  disabled={index === 0}
                  onClick={() => void move(index, -1)}
                  className="rounded-md bg-[var(--surface-strong)]/90 p-0.5 text-[var(--slate-700)] shadow hover:bg-[var(--surface-strong)] disabled:opacity-30"
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="Mover abajo"
                  disabled={index === sorted.length - 1}
                  onClick={() => void move(index, 1)}
                  className="rounded-md bg-[var(--surface-strong)]/90 p-0.5 text-[var(--slate-700)] shadow hover:bg-[var(--surface-strong)] disabled:opacity-30"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </div>
              <button
                type="button"
                aria-label="Eliminar foto"
                disabled={deletingId === photo.id}
                onClick={() => void handleDelete(photo)}
                className="absolute bottom-1 right-1 rounded-md bg-[var(--danger-600)] p-0.5 text-[var(--on-fill)] shadow opacity-0 transition-opacity group-hover:opacity-100 disabled:opacity-50"
              >
                {deletingId === photo.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <X className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
