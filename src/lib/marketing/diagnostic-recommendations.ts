import type { DiagnosticAnswers } from "./diagnostic-schema";

type Pillar = DiagnosticAnswers["q5_pilarDolor"];

export type Recommendation = {
  title: string;
  bullets: string[];
  recommendedTier: "operacion" | "profesional" | "enterprise";
  roiHook: string;
  accentBorder: string;
  accentText: string;
};

export const RECOMMENDATIONS: Record<Pillar, Recommendation> = {
  cartera: {
    title: "Control financiero, primero.",
    bullets: [
      "Dashboard de cartera con KPIs en tiempo real",
      "Estados de cuenta masivos en minutos, no horas",
      "Alertas automáticas de morosidad",
      "Comprobantes subidos por el residente directo al admin",
    ],
    recommendedTier: "profesional",
    roiHook: "Reducción típica de morosidad: 10% a 25% en los primeros 90 días.",
    accentBorder: "border-brand-blue",
    accentText: "text-brand-blue",
  },
  comunicacion: {
    title: "El canal oficial que tu conjunto necesita.",
    bullets: [
      "Comunicados con estados de lectura confirmada",
      "Feed cronológico oficial (adiós cadenas de WhatsApp)",
      "Directorio de residentes con filtros",
      "Carga masiva desde Excel",
    ],
    recommendedTier: "operacion",
    roiHook: "Tus residentes dejan de preguntarte lo mismo cinco veces.",
    accentBorder: "border-brand-teal",
    accentText: "text-brand-teal",
  },
  porteria: {
    title: "Portería digital que tu equipo entiende.",
    bullets: [
      "Visitantes con QR único, validados en segundos",
      "Paquetería con foto y firma del residente",
      "Panel simplificado, sin información sensible",
      "Bitácora digital del turno",
    ],
    recommendedTier: "operacion",
    roiHook: "Cero libretas. Cero llamadas para autorizar visita.",
    accentBorder: "border-brand-purpleDeep",
    accentText: "text-brand-purpleDeep",
  },
  gobernanza: {
    title: "Trazabilidad que el consejo va a agradecer.",
    bullets: [
      "Auditoría completa de operaciones sensibles",
      "Reportes exportables para asamblea",
      "3 perfiles de acceso con permisos granulares",
      "Repositorio de documentos del conjunto",
    ],
    recommendedTier: "enterprise",
    roiHook: "Llegas a juntas con datos, no con anécdotas.",
    accentBorder: "border-navy",
    accentText: "text-navy",
  },
};

export const TIER_LABELS: Record<Recommendation["recommendedTier"], string> = {
  operacion: "Operación",
  profesional: "Profesional",
  enterprise: "Enterprise",
};
