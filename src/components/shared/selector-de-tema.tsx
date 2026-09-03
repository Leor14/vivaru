"use client";

import { Moon, Sun } from "lucide-react";
import { toast } from "sonner";

import { useTema } from "@/features/tema/tema-context";
import { TEMAS, type Tema } from "@/lib/ui/tema";
import { cn } from "@/lib/utils/cn";

const OPCIONES: { valor: Tema; etiqueta: string; Icono: typeof Sun }[] = [
  { valor: "claro", etiqueta: "Claro", Icono: Sun },
  { valor: "oscuro", etiqueta: "Oscuro", Icono: Moon },
];

/**
 * El interruptor de tema. `PRD-V-FEAT-007` entrega 3.
 *
 * No se pinta con la bandera apagada (`CA2`), y no se pinta sin sesion: el tema
 * es de una persona, y sin persona no hay nada que elegir.
 *
 * Son DOS estados y no tres: David decidio que el tema es explicito y **no sigue
 * al sistema operativo**. Añadir «Sistema» mas adelante no rompe nada — por eso
 * el campo ausente se dejo sin significado (ver `RN-10`).
 */
export function SelectorDeTema({ className }: { className?: string }) {
  const { tema, disponible, guardando, cambiarTema } = useTema();
  if (!disponible) return null;

  async function elegir(valor: Tema) {
    try {
      await cambiarTema(valor);
    } catch {
      toast.error("No pudimos guardar tu preferencia. Vuelve a intentarlo.");
    }
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {/* Sin encabezado propio: las dos pantallas lo montan dentro de una tarjeta
          que YA se titula «Apariencia», y ponerlo aqui lo duplicaba. Visto en
          staging, no deducido. */}
      <p className="max-w-[var(--medida-lectura)] text-xs text-[var(--slate-500)]">
        Solo cambia cómo lo ves tú. Nadie más lo nota, y los documentos que
        descargues o imprimas salen siempre en claro.
      </p>
      <div
        role="radiogroup"
        aria-label="Tema de la interfaz"
        className="inline-flex w-fit gap-1 rounded-xl border border-[var(--slate-200)] bg-[var(--slate-50)] p-1"
      >
        {OPCIONES.map(({ valor, etiqueta, Icono }) => {
          const activo = tema === valor;
          return (
            <button
              key={valor}
              type="button"
              role="radio"
              aria-checked={activo}
              disabled={guardando}
              onClick={() => void elegir(valor)}
              className={cn(
                "inline-flex min-h-11 items-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-700)]",
                "disabled:cursor-not-allowed disabled:opacity-60",
                activo
                  ? "bg-[var(--relleno-marca)] text-[var(--on-fill)]"
                  : "text-[var(--slate-700)] hover:bg-[var(--slate-100)]",
              )}
            >
              <Icono className="h-4 w-4" aria-hidden />
              {etiqueta}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export { TEMAS };
