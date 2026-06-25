"use client";

import * as React from "react";
import { useInView, useReducedMotion } from "@/lib/marketing/hooks";
import { cn } from "@/lib/utils/cn";

/**
 * Casos de uso reales — prueba narrativa (blueprint §3.6).
 *
 * Un escenario concreto por perfil en formato Situación → Con Vivaru → Resultado.
 * Aterriza la promesa ("controla tu cartera") en una escena ("así cobras la cuota").
 * Scroll-reveal + hover lift para mantener cohesión con Solution/Differentiators.
 */

type Caso = {
  key: string;
  label: string;
  labelColor: string;
  dot: string;
  situation: string;
  withVivaru: string;
  result: string;
};

const CASOS: Caso[] = [
  {
    key: "admin",
    label: "Administrador",
    labelColor: "text-navy",
    dot: "bg-navy",
    situation: "120 unidades y la cuota de administración del mes por cobrar.",
    withVivaru:
      "Lanza una campaña a todas las unidades; el sistema notifica, los residentes suben su comprobante y los aprueba en un clic; programa un recordatorio a los pendientes a 5 días del vencimiento.",
    result:
      "El recaudo se ve al instante y cierra el mes con el reporte archivado — sin Excel ni WhatsApp.",
  },
  {
    key: "residente",
    label: "Residente",
    labelColor: "text-brand-green-resident",
    dot: "bg-brand-green-resident",
    situation: "Quiere ponerse al día con su cuota y tendrá visita el sábado.",
    withVivaru:
      "Ve su saldo en el teléfono, sube el comprobante y recibe la confirmación al aprobarse; genera un QR para su invitado.",
    result: "Cierra su mes y su visita entra sin llamadas ni esperas en portería.",
  },
  {
    key: "porteria",
    label: "Portería",
    labelColor: "text-brand-plum-dark",
    dot: "bg-brand-plum-dark",
    situation: "Llega un visitante y, al mismo tiempo, un paquete para un residente.",
    withVivaru:
      "Escanea el QR (la visita ya está autorizada), registra el paquete con foto y firma, y deja una nota con foto de una novedad.",
    result: "Todo queda registrado y el administrador lo ve en tiempo real.",
  },
  {
    key: "comite",
    label: "Comité / Presidente",
    labelColor: "text-brand-blue",
    dot: "bg-brand-blue",
    situation: "Hay asamblea trimestral el próximo mes.",
    withVivaru:
      "Genera el reporte de comité con el tablero ejecutivo y la antigüedad de cartera; en la junta registra los acuerdos con firma; exporta el informe a PDF.",
    result: "Llega a la asamblea con evidencia y acuerdos trazables, sin armar nada a mano.",
  },
];

function StepBlock({ label, text, dot }: { label: string; text: string; dot: string }) {
  return (
    <div className="flex gap-2">
      <span
        aria-hidden="true"
        className={`mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full ${dot}`}
      />
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
          {label}
        </p>
        <p className="mt-0.5 text-sm leading-relaxed text-slate-600">{text}</p>
      </div>
    </div>
  );
}

function CasoCard({ caso, index }: { caso: Caso; index: number }) {
  const reduced = useReducedMotion();
  const [ref, inView] = useInView<HTMLLIElement>(0.05);
  const delayMs = reduced ? 0 : index * 60;

  return (
    <li
      ref={ref}
      className={cn(
        "flex flex-col gap-4 rounded-2xl border border-border bg-background p-lg shadow-brand-sm",
        "transition-[opacity,transform,box-shadow] duration-[280ms] ease-out motion-reduce:transition-none",
        inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4",
        "[@media(hover:hover)_and_(pointer:fine)]:hover:-translate-y-1",
        "[@media(hover:hover)_and_(pointer:fine)]:hover:shadow-brand-lg",
      )}
      style={{ transitionDelay: reduced || inView ? "0ms" : `${delayMs}ms` }}
    >
      <p className={`text-sm font-semibold uppercase tracking-[0.12em] ${caso.labelColor}`}>
        {caso.label}
      </p>
      <StepBlock label="Situación" text={caso.situation} dot={caso.dot} />
      <StepBlock label="Con Vivaru" text={caso.withVivaru} dot={caso.dot} />
      <StepBlock label="Resultado" text={caso.result} dot={caso.dot} />
    </li>
  );
}

export function CasosDeUso() {
  return (
    <section
      id="casos-de-uso"
      aria-labelledby="casos-heading"
      className="container scroll-mt-24 py-xxl"
    >
      <h2
        id="casos-heading"
        className="max-w-3xl font-display text-h2 text-navy text-balance"
      >
        Así se ve un mes con Vivaru
      </h2>
      <p className="mt-md max-w-2xl text-base leading-relaxed text-slate-600">
        De la promesa al día a día: un caso real por perfil.
      </p>

      <ul role="list" className="mt-xl grid gap-lg sm:grid-cols-2">
        {CASOS.map((c, i) => (
          <CasoCard key={c.key} caso={c} index={i} />
        ))}
      </ul>
    </section>
  );
}
