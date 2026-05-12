"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Dialog } from "@/components/ui/dialog";
import type { AmenityPhoto } from "@/features/admin/services";

interface AmenityPhotoGalleryProps {
  photos: AmenityPhoto[];
  amenityName: string;
  open: boolean;
  onClose: () => void;
}

export function AmenityPhotoGallery({
  photos,
  amenityName,
  open,
  onClose,
}: AmenityPhotoGalleryProps) {
  const sorted = [...photos].sort((a, b) => a.order - b.order);
  const [activeIndex, setActiveIndex] = useState(0);

  // Reset to first photo when gallery opens
  useEffect(() => {
    if (open) setActiveIndex(0);
  }, [open]);

  // Keyboard navigation
  useEffect(() => {
    if (!open || sorted.length === 0) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") setActiveIndex((i) => Math.max(0, i - 1));
      if (e.key === "ArrowRight") setActiveIndex((i) => Math.min(sorted.length - 1, i + 1));
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, sorted.length]);

  return (
    <Dialog open={open} onClose={onClose} className="max-w-2xl">
      <div className="flex items-center justify-between border-b border-[var(--slate-200)] px-5 py-4">
        <h2 className="text-base font-semibold text-[var(--slate-900)]">{amenityName}</h2>
        <button
          type="button"
          aria-label="Cerrar galería"
          onClick={onClose}
          className="rounded-lg p-1.5 text-[var(--slate-500)] hover:bg-[var(--slate-100)] hover:text-[var(--slate-900)]"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="p-5">
        {sorted.length === 0 ? (
          <p className="py-10 text-center text-sm text-[var(--slate-500)]">
            Esta amenidad no tiene fotos aún.
          </p>
        ) : (
          <div className="space-y-4">
            {/* Main image */}
            <div className="relative overflow-hidden rounded-xl bg-[var(--slate-100)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={sorted[activeIndex]?.url}
                alt={`${amenityName} — foto ${activeIndex + 1}`}
                className="max-h-[400px] w-full object-contain"
              />
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between">
              <button
                type="button"
                aria-label="Foto anterior"
                disabled={activeIndex === 0}
                onClick={() => setActiveIndex((i) => i - 1)}
                className="rounded-xl border border-[var(--slate-200)] p-2 text-[var(--slate-700)] hover:bg-[var(--slate-100)] disabled:opacity-30"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <span className="text-sm text-[var(--slate-600)]">
                {activeIndex + 1} / {sorted.length}
              </span>
              <button
                type="button"
                aria-label="Foto siguiente"
                disabled={activeIndex === sorted.length - 1}
                onClick={() => setActiveIndex((i) => i + 1)}
                className="rounded-xl border border-[var(--slate-200)] p-2 text-[var(--slate-700)] hover:bg-[var(--slate-100)] disabled:opacity-30"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>

            {/* Thumbnails */}
            {sorted.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {sorted.map((photo, index) => (
                  <button
                    key={photo.id}
                    type="button"
                    aria-label={`Ver foto ${index + 1}`}
                    onClick={() => setActiveIndex(index)}
                    className={`shrink-0 overflow-hidden rounded-lg border-2 transition ${
                      index === activeIndex
                        ? "border-[var(--brand-700)]"
                        : "border-transparent hover:border-[var(--slate-300)]"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.url}
                      alt={`Miniatura ${index + 1}`}
                      className="h-14 w-20 object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Dialog>
  );
}
