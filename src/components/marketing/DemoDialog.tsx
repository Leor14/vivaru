"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/marketing/ui/dialog";
import { track } from "@/lib/marketing/analytics";

/**
 * Demo booking dialog. Wraps the Calendly iframe per plan §5.x.
 *
 * Behaviour today (Sprint 1):
 *   - If `NEXT_PUBLIC_CALENDLY_URL` is set, embeds the Calendly iframe.
 *   - If empty (current state — HITL pending), shows a placeholder with the
 *     fallback mailto from journey.md §C ("Calendly iframe fallback" microcopy).
 *
 * Telemetry:
 *   - Trigger click fires `cta_primary_click` with the section that wrapped it.
 *   - Dialog open/close lifecycle will get `demo_booked` once Calendly webhook
 *     wiring lands in Sprint 6 (/api/book).
 */
export interface DemoDialogProps {
  /** The trigger button. Must be a single React element. */
  children: React.ReactNode;
  /** Section identifier for `cta_primary_click` telemetry. */
  section:
    | "topbar"
    | "hero"
    | "pricing"
    | "pilot"
    | "final"
    | "mobile_bottom"
    | "diagnostico_result";
}

export function DemoDialog({ children, section }: DemoDialogProps) {
  const calendlyUrl = process.env.NEXT_PUBLIC_CALENDLY_URL;
  const trigger = React.Children.only(children) as React.ReactElement;

  return (
    <Dialog>
      <DialogTrigger
        onClick={() => track("cta_primary_click", { section })}
        render={trigger}
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-h3 text-slate-900">
            Agenda una demo
          </DialogTitle>
          <DialogDescription>
            Te mostramos Vivaru en 30 minutos, sin compromiso. Elige el horario
            que mejor te convenga.
          </DialogDescription>
        </DialogHeader>

        {calendlyUrl ? (
          <iframe
            src={calendlyUrl}
            title="Calendly — Agenda una demo con Vivaru"
            className="h-[560px] w-full rounded-md border border-border"
            loading="lazy"
          />
        ) : (
          <div className="rounded-md border border-dashed border-border bg-slate-50 p-6 text-sm leading-relaxed text-slate-600">
            <p className="font-medium text-slate-900">
              Calendario en activación
            </p>
            <p className="mt-2">
              Mientras terminamos de configurar el calendario, escríbenos
              directamente a{" "}
              <a
                className="font-medium text-primary underline-offset-4 hover:underline"
                href="mailto:hola@grupovivaru.com?subject=Quiero%20agendar%20una%20demo%20de%20Vivaru"
              >
                hola@grupovivaru.com
              </a>{" "}
              y te respondemos en menos de 24&nbsp;horas hábiles.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
