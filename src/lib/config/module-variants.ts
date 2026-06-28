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

/** Metadatos para la UI (etiquetas y descripción por opción). */
export type VariantOptionMeta = { value: string; label: string; description: string };
export type ModuleVariantMeta = {
  key: ModuleVariantKey;
  label: string;
  options: VariantOptionMeta[];
};

export const MODULE_VARIANT_META: ModuleVariantMeta[] = [
  {
    key: "visitors",
    label: "Visitas",
    options: [
      {
        value: "qr_full",
        label: "Control completo (QR)",
        description:
          "El residente pre-autoriza, se genera QR y la portería registra ingreso y salida.",
      },
      {
        value: "registro_simple",
        label: "Registro simple",
        description:
          "La portería registra la visita al llegar y notifica al residente. Sin QR.",
      },
    ],
  },
  {
    key: "packages",
    label: "Paquetería",
    options: [
      {
        value: "con_evidencia",
        label: "Con evidencia",
        description: "Recepción con foto y firma, estados de bodega y retiro confirmado.",
      },
      {
        value: "aviso_simple",
        label: "Aviso simple",
        description: "La portería registra el paquete y notifica al residente. Sin foto ni firma.",
      },
    ],
  },
  {
    key: "pqrs",
    label: "PQRS",
    options: [
      {
        value: "con_sla",
        label: "Con SLA",
        description: "Radicado, categoría y semáforo de tiempo de respuesta (15 días).",
      },
      {
        value: "buzon_simple",
        label: "Buzón simple",
        description: "El residente envía un mensaje y el admin responde. Sin categorías ni semáforo.",
      },
    ],
  },
  {
    key: "communications",
    label: "Comunicaciones",
    options: [
      {
        value: "canal_oficial",
        label: "Canal oficial",
        description: "Comunicados con vigencia y programación (fecha de inicio y expiración).",
      },
      {
        value: "tablon_simple",
        label: "Tablón simple",
        description: "Muro de anuncios: publica y se ve, sin fechas de vigencia.",
      },
    ],
  },
  {
    key: "finance",
    label: "Finanzas / Cartera",
    options: [
      {
        value: "completa",
        label: "Gestión completa",
        description: "Cobros, conciliación, comprobantes, mora y reportes.",
      },
      {
        value: "solo_consulta",
        label: "Solo consulta",
        description: "El admin publica el estado de cuenta; el residente lo consulta.",
      },
    ],
  },
  {
    key: "governance",
    label: "Gobernanza",
    options: [
      {
        value: "formal",
        label: "Formal (firma / votación)",
        description: "Acuerdos con firma digital y votaciones con quórum.",
      },
      {
        value: "informativo",
        label: "Informativo",
        description: "Se publican acuerdos y encuestas sin firma ni validez formal.",
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
