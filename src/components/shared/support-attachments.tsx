"use client";

import { useRef } from "react";
import { FileText, ImageIcon, Paperclip, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  SUPPORT_ATTACHMENT_TYPES,
  SUPPORT_LIMITS,
  isAllowedAttachment,
  type SupportAttachment,
} from "@/features/support/types";
import { formatSize } from "@/features/support/upload";

/**
 * Selector de evidencia y lista de adjuntos ya enviados.
 *
 * Se comparte entre el portal del administrador y la bandeja del superadmin:
 * es la misma conversación vista desde dos lados, y dos componentes distintos
 * acabarían mostrando el mismo archivo de dos maneras.
 */

export function AttachmentPicker({
  files,
  onChange,
  disabled,
  onError,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
  onError: (message: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const lleno = files.length >= SUPPORT_LIMITS.maxAttachmentsPerMessage;

  function añadir(nuevos: FileList | null) {
    if (!nuevos) return;
    const acumulado = [...files];
    for (const file of Array.from(nuevos)) {
      if (acumulado.length >= SUPPORT_LIMITS.maxAttachmentsPerMessage) {
        onError(`Máximo ${SUPPORT_LIMITS.maxAttachmentsPerMessage} archivos.`);
        break;
      }
      // Se avisa aquí para que no descubra el problema después de esperar la
      // subida. El límite de verdad lo impone el servidor.
      const problema = isAllowedAttachment(file);
      if (problema) {
        onError(problema);
        continue;
      }
      acumulado.push(file);
    }
    onChange(acumulado);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={SUPPORT_ATTACHMENT_TYPES.join(",")}
        className="hidden"
        onChange={(e) => añadir(e.target.files)}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || lleno}
        onClick={() => inputRef.current?.click()}
      >
        <Paperclip className="mr-2 h-4 w-4" />
        {lleno ? "Máximo alcanzado" : "Adjuntar evidencia"}
      </Button>

      {files.length > 0 ? (
        <ul className="space-y-1">
          {files.map((file, i) => (
            <li
              key={`${file.name}-${i}`}
              className="flex items-center gap-2 rounded-lg border border-[var(--slate-200)] bg-[var(--surface-strong)] px-2.5 py-1.5 text-xs"
            >
              <Paperclip className="h-3.5 w-3.5 shrink-0 text-[var(--slate-500)]" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-[var(--slate-800)]">{file.name}</span>
              <span className="shrink-0 text-[var(--slate-500)]">{formatSize(file.size)}</span>
              <button
                type="button"
                aria-label={`Quitar ${file.name}`}
                onClick={() => onChange(files.filter((_, j) => j !== i))}
                className="shrink-0 rounded-sm p-0.5 text-[var(--slate-500)] hover:bg-[var(--slate-100)]"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-[var(--slate-500)]">
          Imágenes o PDF, hasta {SUPPORT_LIMITS.maxAttachmentBytes / (1024 * 1024)} MB cada uno. Una
          captura suele resolver el caso en la mitad de mensajes.
        </p>
      )}
    </div>
  );
}

/** Adjuntos ya enviados, dentro de un mensaje del hilo. */
export function AttachmentList({ attachments }: { attachments?: SupportAttachment[] }) {
  if (!attachments || attachments.length === 0) return null;
  return (
    <ul className="mt-2 flex flex-wrap gap-2">
      {attachments.map((a) => {
        const esImagen = a.contentType?.startsWith("image/");
        const Icono = esImagen ? ImageIcon : FileText;
        return (
          <li key={a.path}>
            <a
              href={a.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex max-w-[16rem] items-center gap-1.5 rounded-lg border border-[var(--slate-200)] bg-[var(--surface-strong)] px-2 py-1 text-xs text-[var(--slate-700)] [transition:border-color_150ms_var(--ease-out)] hover:border-[var(--brand-200)]"
            >
              <Icono className="h-3.5 w-3.5 shrink-0 text-[var(--slate-500)]" aria-hidden />
              <span className="truncate">{a.name}</span>
              <span className="shrink-0 text-[var(--slate-500)]">{formatSize(a.size ?? 0)}</span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}
