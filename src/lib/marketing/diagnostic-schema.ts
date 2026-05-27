import { z } from "zod";

/**
 * Zod schema for the 9-question diagnostic flow.
 * Q9 is a nested contact object validated at the report submission step.
 */
export const diagnosticSchema = z.object({
  q1_conjuntos: z.enum(["1", "2-5", "6-15", "16+"]),
  q2_unidades: z.number().int().min(50).max(2000),
  q3_tipoConjunto: z
    .array(z.enum(["vertical", "horizontal", "fraccionamiento", "mixto"]))
    .min(1, "Selecciona al menos uno"),
  q4_herramientas: z
    .array(z.enum(["excel", "whatsapp", "otroSoftware", "libretas", "nada"]))
    .min(1, "Selecciona al menos una"),
  q5_pilarDolor: z.enum(["cartera", "comunicacion", "porteria", "gobernanza"]),
  q6_morosidad: z.number().int().min(0).max(50),
  q7_horasManuales: z.number().int().min(0).max(30),
  q8_timeline: z.enum(["30dias", "trimestre", "anio", "investigando"]),
  q9_contacto: z.object({
    nombre: z.string().min(2, "Ingresa tu nombre"),
    email: z.string().email("Necesitamos un correo válido para enviarte el reporte"),
    conjunto: z.string().min(2, "Nombre del conjunto principal"),
    whatsapp: z
      .string()
      .optional()
      .refine(
        (v) => !v || /^\+?\d{10,15}$/.test(v),
        { message: "Formato no válido: usa solo dígitos (10–15)" },
      ),
    consent: z
      .boolean()
      .refine((v) => v === true, {
        message: "Debes aceptar el tratamiento de datos para continuar",
      }),
  }),
});

export type DiagnosticAnswers = z.infer<typeof diagnosticSchema>;

// Per-step validation helpers (used to gate "Siguiente" button).
export const stepSchemas = {
  1: diagnosticSchema.shape.q1_conjuntos,
  2: diagnosticSchema.shape.q2_unidades,
  3: diagnosticSchema.shape.q3_tipoConjunto,
  4: diagnosticSchema.shape.q4_herramientas,
  5: diagnosticSchema.shape.q5_pilarDolor,
  6: diagnosticSchema.shape.q6_morosidad,
  7: diagnosticSchema.shape.q7_horasManuales,
  8: diagnosticSchema.shape.q8_timeline,
} as const;
