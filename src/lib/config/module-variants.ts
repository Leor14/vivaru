/**
 * Module variants — modos de operación por módulo (eje paralelo a `residentModules`).
 *
 * A diferencia de `residentModules` (ON/OFF que solo oculta menú del residente), una variante
 * cambia el COMPORTAMIENTO de un módulo (guardia, residente, admin, reglas, notificaciones).
 *
 * Se eligen al crear el conjunto (alta de superadmin). La editabilidad posterior depende del
 * grado de afectación: ver VARIANT_EDITABILITY.
 *
 * Compatibilidad: si `moduleVariants` (o una clave) falta, el accesor aplica el default
 * (= comportamiento actual), por lo que los conjuntos existentes no requieren migración.
 */

export type VisitorsVariant = "qr_full" | "registro_simple";
export type PackagesVariant = "con_evidencia" | "aviso_simple";
export type PqrsVariant = "con_sla" | "buzon_simple";
export type CommunicationsVariant = "canal_oficial" | "tablon_simple";
// Reservados — fijos al crear (fuera del piloto Visitas + Paquetería):
export type FinanceVariant = "completa" | "solo_consulta";
export type GovernanceVariant = "formal" | "informativo";

export type ModuleVariants = {
  visitors: VisitorsVariant;
  packages: PackagesVariant;
  pqrs: PqrsVariant;
  communications: CommunicationsVariant;
  finance: FinanceVariant;
  governance: GovernanceVariant;
};

export type ModuleVariantKey = keyof ModuleVariants;

/** Defaults = comportamiento actual. Crítico para no romper conjuntos existentes. */
export const DEFAULT_MODULE_VARIANTS: ModuleVariants = {
  visitors: "qr_full",
  packages: "con_evidencia",
  pqrs: "con_sla",
  communications: "canal_oficial",
  finance: "completa",
  governance: "formal",
};

/** Valores válidos por clave (para validación en cliente y en la Cloud Function). */
export const MODULE_VARIANT_VALUES: Record<ModuleVariantKey, readonly string[]> = {
  visitors: ["qr_full", "registro_simple"],
  packages: ["con_evidencia", "aviso_simple"],
  pqrs: ["con_sla", "buzon_simple"],
  communications: ["canal_oficial", "tablon_simple"],
  finance: ["completa", "solo_consulta"],
  governance: ["formal", "informativo"],
};

/**
 * Editabilidad por grado de afectación (best-practice del análisis):
 *  - "locked" → se fija al crear; el admin NO lo cambia (estructural: dinero / legal).
 *  - "warn"   → editable con advertencia + manejo de datos en vuelo.
 *  - "free"   → editable en cualquier momento (solo cambia comportamiento futuro).
 */
export const VARIANT_EDITABILITY: Record<ModuleVariantKey, "locked" | "warn" | "free"> = {
  visitors: "warn",
  packages: "free",
  pqrs: "warn",
  communications: "free",
  finance: "locked",
  governance: "locked",
};

/** Metadatos para la UI (explicación por opción, para elegir con criterio). */
export type VariantOptionMeta = {
  value: string;
  label: string;
  /** Resumen corto de la opción. */
  description: string;
  /** Para qué tipo de conjunto/escenario conviene. */
  bestFor: string;
  /** Qué incluye / qué cambia (2–4 viñetas). */
  highlights: string[];
};
export type ModuleVariantMeta = {
  key: ModuleVariantKey;
  label: string;
  /** Explica el eje de elección del módulo (qué se está decidiendo). */
  helpText: string;
  options: VariantOptionMeta[];
  /** Implicación al cambiar de modo (solo aplica a módulos `warn`: datos en vuelo). */
  changeNote?: string;
};

export const MODULE_VARIANT_META: ModuleVariantMeta[] = [
  {
    key: "visitors",
    label: "Visitas",
    helpText: "Define cómo la portería gestiona el ingreso de visitantes.",
    changeNote: "Si pasas de QR a registro simple, las autorizaciones y QR activos dejan de usarse.",
    options: [
      {
        value: "qr_full",
        label: "Control completo (QR)",
        description:
          "El residente pre-autoriza, se genera QR y la portería registra ingreso y salida.",
        bestFor: "Conjuntos con control estricto, varias torres o alto flujo de visitas.",
        highlights: [
          "El residente pre-autoriza la visita y se genera un QR.",
          "La portería escanea y registra ingreso y salida.",
          "Soporta autorizaciones de larga duración (ingresos repetidos).",
        ],
      },
      {
        value: "registro_simple",
        label: "Registro simple",
        description:
          "La portería registra la visita al llegar y notifica al residente. Sin QR.",
        bestFor: "Conjuntos pequeños o que prefieren cero fricción.",
        highlights: [
          "La portería registra la visita al llegar, sin QR ni pre-autorización.",
          "El residente recibe la notificación de la visita.",
        ],
      },
    ],
  },
  {
    key: "packages",
    label: "Paquetería",
    helpText: "Define el nivel de control al recibir y entregar paquetes.",
    options: [
      {
        value: "con_evidencia",
        label: "Con evidencia",
        description: "Recepción con foto y firma, estados de bodega y retiro confirmado.",
        bestFor: "Conjuntos con bodega y volumen de correspondencia.",
        highlights: [
          "Recepción con foto y firma.",
          "Estados de bodega y retiro confirmado con destinatario.",
        ],
      },
      {
        value: "aviso_simple",
        label: "Aviso simple",
        description: "La portería registra el paquete y notifica al residente. Sin foto ni firma.",
        bestFor: "Conjuntos chicos sin bodega formal.",
        highlights: [
          "La portería registra “llegó un paquete” y notifica al residente.",
          "Entrega de un toque, sin foto ni firma.",
        ],
      },
    ],
  },
  {
    key: "pqrs",
    label: "PQRS",
    helpText: "Define si las solicitudes se gestionan con trazabilidad formal o como un buzón.",
    changeNote: "Los PQRS abiertos con SLA dejarán de mostrar su semáforo al pasar a buzón.",
    options: [
      {
        value: "con_sla",
        label: "Con SLA",
        description: "Radicado, categoría y semáforo de tiempo de respuesta (15 días).",
        bestFor: "Administradoras profesionales o conjuntos grandes.",
        highlights: [
          "Radicado único y categorías (petición, queja, reclamo, sugerencia).",
          "Semáforo de tiempo de respuesta (15 días hábiles) y auditoría.",
        ],
      },
      {
        value: "buzon_simple",
        label: "Buzón simple",
        description: "El residente envía un mensaje y el admin responde. Sin categorías ni semáforo.",
        bestFor: "Comunidades pequeñas que solo quieren recibir y responder.",
        highlights: [
          "El residente envía asunto + mensaje; el admin responde.",
          "Sin radicado, categorías ni semáforo.",
        ],
      },
    ],
  },
  {
    key: "communications",
    label: "Comunicaciones",
    helpText: "Define si los comunicados tienen vigencia/programación o son un muro simple.",
    options: [
      {
        value: "canal_oficial",
        label: "Canal oficial",
        description: "Comunicados con vigencia y programación (fecha de inicio y expiración).",
        bestFor: "Conjuntos que programan y dan vigencia a sus avisos.",
        highlights: [
          "Comunicados con fecha de inicio y expiración.",
          "Estados Programado/Vencido y filtros por vigencia.",
        ],
      },
      {
        value: "tablon_simple",
        label: "Tablón simple",
        description: "Muro de anuncios: publica y se ve, sin fechas de vigencia.",
        bestFor: "Comunidades que solo quieren un muro de anuncios.",
        highlights: [
          "Publicar y ver, sin fechas de vigencia ni programación.",
        ],
      },
    ],
  },
  {
    key: "finance",
    label: "Finanzas / Cartera",
    helpText: "Define si la cartera se administra dentro de Vivaru o solo se consulta.",
    options: [
      {
        value: "completa",
        label: "Gestión completa",
        description: "Cobros, conciliación, comprobantes, mora y reportes.",
        bestFor: "Administradoras que cobran y concilian en la plataforma.",
        highlights: [
          "Cobros individuales y en lote, conciliación, comprobantes y mora.",
          "Reportes y cierre de períodos.",
        ],
      },
      {
        value: "solo_consulta",
        label: "Solo consulta",
        description: "El admin publica el estado de cuenta; el residente lo consulta.",
        bestFor: "Conjuntos que llevan la contabilidad por fuera.",
        highlights: [
          "El residente consulta su estado de cuenta y sube comprobantes.",
          "Sin cobros automáticos, conciliación ni mora; el admin no gestiona cartera aquí.",
        ],
      },
    ],
  },
  {
    key: "governance",
    label: "Gobernanza",
    helpText: "Define si las decisiones del comité tienen validez formal (firma) o son informativas.",
    options: [
      {
        value: "formal",
        label: "Formal (firma / votación)",
        description: "Acuerdos con firma digital y votaciones con quórum.",
        bestFor: "Conjuntos que exigen formalidad legal en sus decisiones.",
        highlights: [
          "Acuerdos con firma digital.",
          "Seguimiento de firmas (firmados/pendientes) y modalidades obligatoria/parcial.",
        ],
      },
      {
        value: "informativo",
        label: "Informativo",
        description: "Se publican acuerdos y encuestas sin firma ni validez formal.",
        bestFor: "Comunidades informales.",
        highlights: [
          "Los acuerdos se publican sin firma y quedan como informativos.",
        ],
      },
    ],
  },
];

/** Lee la variante de un módulo aplicando el default si falta. */
export function getModuleVariant<K extends ModuleVariantKey>(
  settings: { moduleVariants?: Partial<ModuleVariants> } | null | undefined,
  key: K,
): ModuleVariants[K] {
  return (settings?.moduleVariants?.[key] ?? DEFAULT_MODULE_VARIANTS[key]) as ModuleVariants[K];
}

/** Normaliza un objeto parcial a variantes completas (rellena defaults). */
export function withVariantDefaults(
  partial?: Partial<ModuleVariants> | null,
): ModuleVariants {
  return { ...DEFAULT_MODULE_VARIANTS, ...(partial ?? {}) };
}
