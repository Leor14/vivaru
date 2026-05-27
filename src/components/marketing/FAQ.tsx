"use client";

import * as React from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/marketing/ui/accordion";
import { track } from "@/lib/marketing/analytics";

/**
 * FAQ — plan §5.11 / journey.md §B step 9.
 *
 * 8 questions, single-open accordion. Telemetry: `faq_open` with
 * { question_id: 1-8 } on each open transition (not on close).
 *
 * HITLs:
 *   - H8 — Q4, Q6, Q8 answers pending commercial sign-off.
 *   - H3 — privacy / data-treatment annex URLs pending in Q5.
 */

type Q = { id: number; question: string; answer: React.ReactNode };

const HITL_PENDING = (
  <p className="italic text-slate-500">
    Pendiente confirmación con equipo comercial.
  </p>
);

const QUESTIONS: Q[] = [
  {
    id: 1,
    question: "¿Funciona para conjuntos de casas o solo edificios?",
    answer: (
      <p>
        Sí. Vivaru opera sobre cualquier régimen de propiedad horizontal:
        condominios verticales (edificios), conjuntos cerrados,
        fraccionamientos, privadas y comunidades residenciales en general.
        Cada conjunto se configura como un sistema independiente, sea de 50
        casas o 300 departamentos.
      </p>
    ),
  },
  {
    id: 2,
    question: "¿Qué tan rápido entra en operación mi conjunto?",
    answer: (
      <p>
        Activación promedio: 72 horas hábiles desde la firma del contrato.
        El proceso de implementación tiene 4 etapas (diagnóstico,
        configuración, piloto, go-live) que cubrimos contigo paso a paso.
      </p>
    ),
  },
  {
    id: 3,
    question: "¿Necesito conectar mi cuenta bancaria o procesador de pagos?",
    answer: (
      <p>
        No. Vivaru opera sin pasarela de pagos embebida. Los residentes
        suben su comprobante desde el teléfono y tú lo concilias en el
        portal admin. Esto baja la barrera de adopción y elimina riesgos de
        integración bancaria.
      </p>
    ),
  },
  {
    /* HITL H8 — Q4 */
    id: 4,
    question: "¿Mis residentes tienen que descargar una app?",
    answer: HITL_PENDING,
  },
  {
    id: 5,
    question: "¿Cómo se manejan los datos personales de mis residentes?",
    answer: (
      <p>
        Cumplimos con la Ley Federal de Protección de Datos Personales en
        Posesión de los Particulares (LFPDPPP). Vivaru opera como encargado
        del tratamiento — tú eres el responsable. Puedes ver el detalle en
        nuestra{" "}
        {/* HITL H3: link URL pending */}
        <a
          href="/legal/privacidad"
          className="text-brand-blue underline underline-offset-4 hover:text-navy"
        >
          Política de Privacidad
        </a>{" "}
        y el{" "}
        {/* HITL H3: link URL pending */}
        <a
          href="/legal/datos"
          className="text-brand-blue underline underline-offset-4 hover:text-navy"
        >
          Anexo de Tratamiento de Datos
        </a>
        .
      </p>
    ),
  },
  {
    /* HITL H8 — Q6 */
    id: 6,
    question: "¿Qué pasa si quiero cancelar?",
    answer: HITL_PENDING,
  },
  {
    id: 7,
    question:
      "¿Soportan integración con CCTV, torniquetes o control de acceso por hardware?",
    answer: (
      <p>
        En el modelo actual no integramos hardware de control físico (CCTV,
        torniquetes, lectores IP). Vivaru se enfoca en el flujo digital:
        visitantes con QR, paquetería trazable, panel de portería. Si tu
        conjunto tiene hardware existente, lo respetamos pero no nos
        conectamos a él.
      </p>
    ),
  },
  {
    /* HITL H8 — Q8 */
    id: 8,
    question:
      "¿En qué se diferencia de Residentify, Conjunto Feliz o gestionar todo en Excel?",
    answer: HITL_PENDING,
  },
];

export function FAQ() {
  const [open, setOpen] = React.useState<string[]>([]);

  const handleValueChange = (next: string[]) => {
    // Diff against previous to detect newly-opened items only.
    const justOpened = next.filter((id) => !open.includes(id));
    for (const id of justOpened) {
      track("faq_open", { question_id: Number(id) });
    }
    setOpen(next);
  };

  return (
    <section
      id="faq"
      aria-labelledby="faq-heading"
      className="container scroll-mt-24 py-xxl"
    >
      <h2
        id="faq-heading"
        className="max-w-3xl font-display text-h2 text-navy text-balance"
      >
        Preguntas frecuentes
      </h2>
      <p className="mt-sm max-w-2xl text-sm leading-relaxed text-slate-600">
        Lo que normalmente preguntan los administradores antes de agendar
        demo.
      </p>

      <div className="mt-xl mx-auto max-w-3xl rounded-2xl border border-border bg-background p-md sm:p-lg shadow-brand-sm">
        <Accordion value={open} onValueChange={handleValueChange}>
          {QUESTIONS.map((q) => (
            <AccordionItem key={q.id} value={String(q.id)}>
              <AccordionTrigger className="text-base font-medium text-navy py-4">
                {q.question}
              </AccordionTrigger>
              <AccordionContent className="text-slate-600 leading-relaxed">
                {q.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
