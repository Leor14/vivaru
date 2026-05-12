import { z } from "zod";

const requiredText = (label: string, min = 2, max?: number) => {
  let schema = z.string().trim().min(min, `${label} es obligatorio`);
  if (max !== undefined) {
    schema = schema.max(max, `${label} no puede superar ${max} caracteres`);
  }
  return schema;
};

export const surveyQuestionSchema = z
  .object({
    id: z.string().min(1),
    type: z.enum(["single_choice", "multiple_choice", "likert", "text"]),
    text: requiredText("Texto de la pregunta", 3),
    options: z.array(z.string().trim().min(1)).optional(),
    required: z.boolean(),
  })
  .superRefine((data, ctx) => {
    if (data.type === "single_choice" || data.type === "multiple_choice") {
      if (!data.options || data.options.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Las preguntas de seleccion deben tener al menos una opcion",
          path: ["options"],
        });
      }
    }
  });

export const createSurveySchema = z
  .object({
    title: requiredText("Titulo", 3, 100),
    description: z.string().trim().max(500, "La descripcion no puede superar 500 caracteres").optional(),
    questions: z
      .array(surveyQuestionSchema)
      .min(1, "La encuesta debe tener al menos una pregunta")
      .max(10, "La encuesta no puede tener mas de 10 preguntas"),
    targetAudience: z.object({
      type: z.enum(["all", "tower"]),
      tower: z.string().trim().optional(),
    }),
    minResponsesForResults: z
      .number()
      .int()
      .min(1, "El umbral minimo es 1 respuesta")
      .max(50, "El umbral maximo es 50 respuestas")
      .default(5),
    closingDate: z.coerce.date().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.targetAudience.type === "tower" && !data.targetAudience.tower) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Debes indicar la torre cuando el publico es por torre",
        path: ["targetAudience", "tower"],
      });
    }
  });

export type CreateSurveyInput = z.infer<typeof createSurveySchema>;
export type SurveyQuestionInput = z.infer<typeof surveyQuestionSchema>;
